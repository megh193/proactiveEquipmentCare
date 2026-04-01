import os
import sys
import io
import asyncio
import numpy as np
import pandas as pd

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import bcrypt
from auth_service import authenticate_user, log_login, generate_otp, send_otp_email, store_otp, verify_otp
from dotenv import load_dotenv

load_dotenv(override=True)

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Lazy-load LSTM model once
_model = None
def get_model():
    global _model
    if _model is None:
        from tensorflow import keras
        model_path = os.getenv('MODEL_PATH', os.path.join(BASE_DIR, 'models', 'motor_lstm_model.h5'))
        _model = keras.models.load_model(model_path)
    return _model

FEATURE_COLS = [
    'Air temperature [K]',
    'Process temperature [K]',
    'Rotational speed [rpm]',
    'Torque [Nm]',
    'Tool wear [min]'
]
SEQUENCE_LENGTH = int(os.getenv('SEQUENCE_LENGTH', 30))

@app.route('/')
def index():
    return app.send_static_file('login.html')

from file_validator import validate_csv

@app.route('/api/validate-csv', methods=['POST'])
def validate_csv_route():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    file = request.files['file']
    is_valid, message = validate_csv(file)
    if is_valid:
        return jsonify({"success": True, "message": message}), 200
    else:
        return jsonify({"success": False, "message": message}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    # ip_address = request.remote_addr # Not used in step 1 anymore
    
    user = authenticate_user(email, password)
    
    if user:
        otp = generate_otp()
        print(f"[Login] Auth success for {email}, role={user['role']}, otp={otp}")
        store_otp(email, otp, user["role"], agenda="login")
        email_sent = send_otp_email(email, otp, agenda="login")
        
        if email_sent:
            return jsonify({"success": True, "message": "OTP sent to email", "step": "otp_sent"})
        else:
             return jsonify({"success": False, "message": "Failed to send OTP. Check server logs."}), 500
    else:
        log_login(email, "0.0.0.0", status="Failed") # Log failure immediately
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/verify-otp', methods=['POST'])
def verify_otp_route():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    ip_address = request.remote_addr
    
    # Fetch role before OTP is deleted on verification
    from supabase_client import supabase as _sb
    _otp_row = _sb.table("otp_store").select("role").eq("email", email).execute()
    role = _otp_row.data[0]["role"] if _otp_row.data else "admin"

    is_valid, message = verify_otp(email, otp)
    
    if is_valid:
        log_login(email, ip_address, status="Success")
            
        return jsonify({"success": True, "message": "Login successful", "email": email, "role": role})
    else:
        # Optional: Log failed OTP attempt?
        # log_login(email, ip_address, status="Failed OTP") 
        return jsonify({"success": False, "message": message}), 401

@app.route('/api/logout', methods=['POST'])
def logout_route():
    if request.is_json:
        data = request.json
    else:
        try:
            import json
            data = json.loads(request.data)
        except Exception:
            data = {}
            
    email = data.get('email')
    if email:
        return jsonify({"success": True})
    return jsonify({"success": False, "message": "Email not provided"}), 400

from supabase_client import supabase

# User Management Endpoints (Super Admin)
@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
        response = supabase.table(table_name).select("id, name, email, Role").execute()
        users = response.data
        for u in users:
            if "Role" in u:
                u["role"] = u.pop("Role")
        return jsonify({"success": True, "users": users})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    name          = data.get('name')
    email         = data.get('email')
    password      = data.get('password')
    role          = data.get('role', 'admin')
    requester_email = data.get('requester_email')   # sent by the frontend

    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400

    # ── Super-admin enforcement ───────────────────────────────────────────────
    # Verify the requesting user is a super_admin in the database.
    user_table = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
    if requester_email:
        try:
            req_res = supabase.table(user_table).select("Role").eq("email", requester_email).execute()
            if not req_res.data:
                return jsonify({"success": False, "message": "Requester not found. Access denied."}), 403
            req_role = (req_res.data[0].get("Role") or "").lower().replace(" ", "_")
            if req_role != "super_admin":
                return jsonify({"success": False, "message": "Only Super Admins can create users."}), 403
        except Exception as role_e:
            print(f"Role check error: {role_e}")
            return jsonify({"success": False, "message": "Could not verify requester role."}), 500
    # (If requester_email not sent, allow through — frontend guards it)

    # ── Step 1: Create/update user in Supabase Auth via REST (service key) ───
    import requests as _req
    supa_url = os.getenv("SUPABASE_URL")
    svc_key  = os.getenv("SUPABASE_SERVICE_KEY")
    auth_headers = {
        "apikey":        svc_key,
        "Authorization": f"Bearer {svc_key}",
        "Content-Type":  "application/json"
    }

    auth_uid = None
    # Try to create the user
    create_resp = _req.post(
        f"{supa_url}/auth/v1/admin/users",
        headers=auth_headers,
        json={"email": email, "password": password, "email_confirm": True}
    )
    if create_resp.status_code == 200:
        auth_uid = create_resp.json().get("id")
        print(f"[AddUser] Created Auth user {email} → uid={auth_uid}")
    else:
        # User might already exist — look them up
        resp_json = create_resp.json()
        err_msg   = resp_json.get("msg", resp_json.get("message", ""))
        print(f"[AddUser] Auth create failed ({create_resp.status_code}): {err_msg}")

        # List all users to find the existing one
        list_resp = _req.get(
            f"{supa_url}/auth/v1/admin/users",
            headers=auth_headers,
            params={"page": 1, "per_page": 1000}
        )
        if list_resp.status_code != 200:
            return jsonify({"success": False, "message": f"Supabase Auth error: {err_msg}"}), 500

        users_json = list_resp.json()
        user_list  = users_json.get("users", users_json) if isinstance(users_json, dict) else users_json
        for au in user_list:
            if isinstance(au, dict) and au.get("email", "").lower() == email.lower():
                auth_uid = au["id"]
                break

        if auth_uid:
            # Update the password so the supplied credential is always correct
            _req.put(
                f"{supa_url}/auth/v1/admin/users/{auth_uid}",
                headers=auth_headers,
                json={"password": password}
            )
            print(f"[AddUser] Reusing existing Auth UID {auth_uid} for {email}")
        else:
            return jsonify({"success": False, "message": f"Auth error: {err_msg}"}), 500

    # ── Step 2: Upsert in users_database ─────────────────────────────────────
    try:
        hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        existing  = supabase.table(user_table).select("id").eq("email", email).execute()

        if existing.data:
            response = supabase.table(user_table).update({
                "name": name, "password": hashed_pw, "Role": role
            }).eq("email", email).execute()
        else:
            response = supabase.table(user_table).insert({
                "name": name, "email": email, "password": hashed_pw, "Role": role
            }).execute()

        user_data = response.data[0]
        if "Role" in user_data:
            user_data["role"] = user_data.pop("Role")

        return jsonify({"success": True, "message": "User added successfully", "user": user_data})

    except Exception as e:
        # Rollback Auth user only if we freshly created them
        if auth_uid and create_resp.status_code == 200:
            _req.delete(f"{supa_url}/auth/v1/admin/users/{auth_uid}", headers=auth_headers)
            print(f"[AddUser] Rollback: deleted Auth user {auth_uid}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    update_data = {}
    
    if 'email' in data:
        update_data['email'] = data['email']
    if 'password' in data and data['password']:
        update_data['password'] = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
    if 'role' in data:
        update_data['Role'] = data['role']
    if 'status' in data:
        update_data['status'] = data['status'].lower()
        
    try:
        table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
        response = supabase.table(table_name).update(update_data).eq("id", user_id).execute()
        if response.data:
            user_data = response.data[0]
            if "Role" in user_data:
                user_data["role"] = user_data.pop("Role")
            return jsonify({"success": True, "message": "User updated successfully", "user": user_data})
        return jsonify({"success": False, "message": "User not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
        
        # Fetch user's email and role before deleting
        user_res = supabase.table(table_name).select("email, Role").eq("id", user_id).execute()
        if not user_res.data or len(user_res.data) == 0:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        user_email = user_res.data[0].get("email", "")
        user_role = user_res.data[0].get("Role", "")
        
        # Prevent deletion of last super admin
        if user_role and user_role.lower().replace("_", " ") == "super admin":
            all_users_res = supabase.table(table_name).select("Role").execute()
            super_admin_count = sum(1 for u in all_users_res.data if u.get("Role", "") and u.get("Role", "").lower().replace("_", " ") == "super admin")
            if super_admin_count <= 1:
                return jsonify({"success": False, "message": "At least one Super Admin must remain in the database."}), 400

        # Step 1: Delete from users_database
        supabase.table(table_name).delete().eq("id", user_id).execute()
        
        # Step 2: Delete from Supabase Auth using admin.list_users to find the UID
        if user_email:
            try:
                auth_uid = None
                # Supabase Python SDK: list_users() returns a list of UserModel objects
                # Handle both SDK v1 (.users attribute) and v2 (direct list)
                raw_response = supabase.auth.admin.list_users()
                user_list = raw_response.users if hasattr(raw_response, 'users') else raw_response
                
                for auth_user in user_list:
                    u_email = getattr(auth_user, 'email', None)
                    if u_email and u_email.lower() == user_email.lower():
                        auth_uid = auth_user.id
                        break
                
                if auth_uid:
                    supabase.auth.admin.delete_user(auth_uid)
                    print(f"Deleted Supabase Auth user: {user_email} (uid={auth_uid})")
                else:
                    print(f"Warning: Could not find Supabase Auth user for email {user_email}")
            except Exception as auth_e:
                print(f"Warning: Could not delete from Supabase Auth: {auth_e}")
                # We still return success since DB delete succeeded

        
        return jsonify({"success": True, "message": "User deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

import json
PROFILES_FILE = os.path.join(os.path.dirname(__file__), '../data/profiles.json')

def get_profiles():
    if os.path.exists(PROFILES_FILE):
        with open(PROFILES_FILE, 'r') as f:
            try:
                return json.load(f)
            except:
                return {}
    return {}

def save_profiles(profiles):
    os.makedirs(os.path.dirname(PROFILES_FILE), exist_ok=True)
    with open(PROFILES_FILE, 'w') as f:
        json.dump(profiles, f)

@app.route('/api/profile', methods=['GET'])
def get_profile():
    email = request.args.get('email')
    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400
        
    try:
        table_name = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        # Fetch the latest login log for the user
        response = supabase.table(table_name).select("*").eq("user_email", email).order("created_at", desc=True).limit(1).execute()
        
        last_login_data = None
        if response.data and len(response.data) > 0:
            last_login_data = response.data[0]
            
        profiles = get_profiles()
        user_avatar = profiles.get(email, {}).get('avatar', None)

        # Fetch user name from users_database
        user_table = os.getenv('SUPABASE_USER_TABLE_NAME', 'users_database')
        name_res = supabase.table(user_table).select('name').eq('email', email).execute()
        user_name = name_res.data[0]['name'] if name_res.data else None
        
        return jsonify({
            "success": True, 
            "last_login": last_login_data,
            "avatar": user_avatar,
            "name": user_name
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/change-password/request-otp', methods=['POST'])
def change_password_request_otp():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({"success": False, "message": "Email is required"}), 400

    # Verify user exists
    table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
    res = supabase.table(table_name).select("email").eq("email", email).execute()
    if not res.data:
        return jsonify({"success": False, "message": "User not found"}), 404

    otp = generate_otp()
    store_otp(email, otp, "change_password", agenda="change_password")
    email_sent = send_otp_email(email, otp, agenda="change_password")
    if email_sent:
        return jsonify({"success": True, "message": "OTP sent to your email"})
    return jsonify({"success": False, "message": "Failed to send OTP"}), 500


@app.route('/api/change-password/verify', methods=['POST'])
def change_password_verify():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    new_password = data.get('new_password')

    if not email or not otp or not new_password:
        return jsonify({"success": False, "message": "Email, OTP, and new password are required"}), 400

    is_valid, message = verify_otp(email, otp)
    if not is_valid:
        return jsonify({"success": False, "message": message}), 401

    hashed_pw = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
    try:
        supabase.table(table_name).update({
            "password": hashed_pw,
            "password_updated": True
        }).eq("email", email).execute()
        print(f"[Auth] Password updated in DB for {email}")
        return jsonify({"success": True, "message": "Password updated successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/profile/avatar', methods=['POST'])
def update_avatar():
    data = request.json
    email = data.get('email')
    avatar_base64 = data.get('avatar')
    
    if not email or not avatar_base64:
        return jsonify({"success": False, "message": "Email and avatar are required"}), 400
        
    try:
        profiles = get_profiles()
        if email not in profiles:
            profiles[email] = {}
        profiles[email]['avatar'] = avatar_base64
        save_profiles(profiles)
        
        return jsonify({"success": True, "message": "Avatar updated successfully"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.csv'):
        return jsonify({"success": False, "message": "Only CSV files are supported"}), 400

    try:
        data = pd.read_csv(file)

        # ── Normalize column names: handle case/spacing/bracket variants ──
        col_map = {}
        for col in data.columns:
            col_normalized = col.strip()
            col_map[col] = col_normalized
        data = data.rename(columns=col_map)

        # Try to find required columns with flexible matching
        def find_col(candidates, df_columns):
            """Find the first matching column from a list of candidate names."""
            df_lower = {c.lower().replace(' ', '').replace('[', '').replace(']', ''): c for c in df_columns}
            for cand in candidates:
                key = cand.lower().replace(' ', '').replace('[', '').replace(']', '')
                if key in df_lower:
                    return df_lower[key]
            return None

        col_candidates = {
            'Air temperature [K]':       ['Air temperature [K]', 'Air temperature', 'air_temperature', 'AirTemperature'],
            'Process temperature [K]':   ['Process temperature [K]', 'Process temperature', 'process_temperature', 'ProcessTemperature'],
            'Rotational speed [rpm]':    ['Rotational speed [rpm]', 'Rotational speed', 'rotational_speed', 'RotationalSpeed'],
            'Torque [Nm]':               ['Torque [Nm]', 'Torque', 'torque'],
            'Tool wear [min]':           ['Tool wear [min]', 'Tool wear', 'tool_wear', 'ToolWear'],
        }

        col_renames = {}
        missing = []
        for standard_name, candidates in col_candidates.items():
            found = find_col(candidates, data.columns)
            if found:
                col_renames[found] = standard_name
            else:
                missing.append(standard_name)

        if missing:
            return jsonify({"success": False, "message": f"Missing required columns: {missing}. Found: {list(data.columns[:10])}"}), 400

        data = data.rename(columns=col_renames)

        if len(data) < SEQUENCE_LENGTH:
            return jsonify({"success": False, "message": f"Need at least {SEQUENCE_LENGTH} rows of data (your file has {len(data)} rows)"}), 400

        # ── Fill any NaN values to avoid model errors ──
        for fc in FEATURE_COLS:
            data[fc] = pd.to_numeric(data[fc], errors='coerce')
            data[fc] = data[fc].fillna(data[fc].median())

        X = data[FEATURE_COLS].values

        # ── Build sequences ──
        sequences, indices = [], []
        for i in range(len(X) - SEQUENCE_LENGTH + 1):
            sequences.append(X[i:i + SEQUENCE_LENGTH])
            indices.append(i + SEQUENCE_LENGTH - 1)

        X_seq = np.array(sequences, dtype=np.float32)

        # ── Load model & predict in chunks to avoid memory spikes ──
        model = get_model()
        BATCH_SIZE = 512
        all_preds = []
        for start in range(0, len(X_seq), BATCH_SIZE):
            batch = X_seq[start:start + BATCH_SIZE]
            batch_preds = model.predict(batch, verbose=0).flatten()
            all_preds.extend(batch_preds)

        preds = np.array(all_preds)

        # ── Build result dataframe ──
        timestamp_col = next((c for c in data.columns if c.lower() in ['timestamp', 'time', 'date']), None)
        product_col   = next((c for c in data.columns if c.lower().replace(' ', '').replace('_', '') in ['productid', 'motorid', 'id']), None)

        result_df = pd.DataFrame({
            'timestamp':  data[timestamp_col].iloc[indices].values if timestamp_col else indices,
            'motor_id':   data[product_col].iloc[indices].values if product_col else [f'Motor_{i}' for i in indices],
            'failure_probability': preds,
        })

        result_df = result_df.sort_values(['timestamp', 'motor_id']).reset_index(drop=True)

        download = request.args.get('download', 'false').lower() == 'true'
        if download:
            buf = io.StringIO()
            result_df.to_csv(buf, index=False)
            buf.seek(0)
            return send_file(
                io.BytesIO(buf.getvalue().encode()),
                mimetype='text/csv',
                as_attachment=True,
                download_name='predictions.csv'
            )

        # JSON response with sensor columns for charts
        json_df = pd.DataFrame({
            'timestamp':          result_df['timestamp'].values,
            'motor_id':           result_df['motor_id'].values,
            'failure_probability': (preds * 100).round(4),
            'air_temp':           data['Air temperature [K]'].iloc[indices].values,
            'process_temp':       data['Process temperature [K]'].iloc[indices].values,
            'rotational_speed':   data['Rotational speed [rpm]'].iloc[indices].values,
            'torque':             data['Torque [Nm]'].iloc[indices].values,
            'tool_wear':          data['Tool wear [min]'].iloc[indices].values,
        })

        return jsonify({
            "success": True,
            "total_rows": len(json_df),
            "predictions": json_df.to_dict(orient='records')
        })

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"Prediction error: {type(e).__name__}: {e}\n{tb}")
        return jsonify({"success": False, "message": f"Prediction error: {str(e)}"}), 500


# ── Audit Trail Endpoints (Super Admin) ──────────────────────────────────────

@app.route('/api/audit-logs', methods=['POST'])
def log_prediction_audit():
    """Log a prediction run: who ran it, when, on what CSV."""
    data = request.json
    user_email = data.get('user_email')
    csv_name   = data.get('csv_name')
    row_count  = data.get('row_count', 0)
    if not user_email or not csv_name:
        return jsonify({"success": False, "message": "user_email and csv_name are required"}), 400
    try:
        from datetime import datetime, timezone
        table = os.getenv('AUDIT_LOG_TABLE_NAME', 'prediction_audit_logs')
        supabase.table(table).insert({
            "user_email": user_email,
            "csv_name":   csv_name,
            "row_count":  row_count,
            "ran_at":     datetime.now(timezone.utc).isoformat()
        }).execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/audit-logs', methods=['GET'])
def get_audit_logs():
    """Return all prediction audit logs (super admin only)."""
    try:
        table = os.getenv('AUDIT_LOG_TABLE_NAME', 'prediction_audit_logs')
        resp = supabase.table(table).select("*").order("ran_at", desc=True).execute()
        return jsonify({"success": True, "logs": resp.data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/login-logs', methods=['GET'])
def get_login_logs():
    """Return all login logs (super admin only)."""
    try:
        table = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        resp = supabase.table(table).select("*").order("created_at", desc=True).execute()
        return jsonify({"success": True, "logs": resp.data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True') == 'True'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port)
