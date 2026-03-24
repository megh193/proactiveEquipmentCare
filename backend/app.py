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
from auth_service import authenticate_user, log_login, generate_otp, send_otp_email, store_otp, verify_otp
from dotenv import load_dotenv

load_dotenv(override=True)

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Lazy-load LSTM model once
_model = None
def get_model():
    global _model
    if _model is None:
        from tensorflow import keras
        model_path = os.getenv('MODEL_PATH')
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
        # Step 1 Success: Generate and Send OTP
        otp = generate_otp()
        # Enhanced store_otp to hold user role
        from auth_service import otp_storage
        import time
        otp_storage[email] = {
            "otp": otp,
            "timestamp": time.time(),
            "role": user["role"]
        }
        
        email_sent = send_otp_email(email, otp)
        
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
    
    # Grab role before verification clears the storage
    from auth_service import otp_storage
    role = otp_storage.get(email, {}).get("role", "admin")
    
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
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'admin')
    # Force status to inactive on user creation
    status = 'inactive'
    
    if not name or not email or not password:
        return jsonify({"success": False, "message": "Name, email, and password are required"}), 400
    
    auth_uid = None
    try:
        # Step 1: Create user in Supabase Auth
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        if not auth_response or not auth_response.user:
            return jsonify({"success": False, "message": "Failed to create user in Supabase Auth"}), 500
        auth_uid = auth_response.user.id
    except Exception as e:
        print(f"Supabase Auth create_user failed: {e}")
        return jsonify({"success": False, "message": f"Auth error: {str(e)}"}), 500

    try:
        # Step 2: Insert into users_database (no status column)
        table_name = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
        response = supabase.table(table_name).insert({
            "name": name,
            "email": email,
            "password": password,
            "Role": role
        }).execute()
        
        user_data = response.data[0]
        if "Role" in user_data:
            user_data["role"] = user_data.pop("Role")
            
        return jsonify({"success": True, "message": "User added successfully", "user": user_data})
    except Exception as e:
        # Rollback: delete the Auth user we just created
        if auth_uid:
            try:
                supabase.auth.admin.delete_user(auth_uid)
                print(f"Rollback: deleted Supabase Auth user {auth_uid}")
            except Exception as rb_e:
                print(f"Rollback failed: {rb_e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    update_data = {}
    
    if 'email' in data:
        update_data['email'] = data['email']
    if 'password' in data and data['password']:
        update_data['password'] = data['password']
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
        
        return jsonify({
            "success": True, 
            "last_login": last_login_data,
            "avatar": user_avatar
        })
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

        missing = [c for c in FEATURE_COLS if c not in data.columns]
        if missing:
            return jsonify({"success": False, "message": f"Missing columns: {missing}"}), 400

        if len(data) < SEQUENCE_LENGTH:
            return jsonify({"success": False, "message": f"Need at least {SEQUENCE_LENGTH} rows of data"}), 400

        X = data[FEATURE_COLS].values
        sequences, indices = [], []
        for i in range(len(X) - SEQUENCE_LENGTH + 1):
            sequences.append(X[i:i + SEQUENCE_LENGTH])
            indices.append(i + SEQUENCE_LENGTH - 1)

        X_seq = np.array(sequences)
        model = get_model()
        preds = model.predict(X_seq, verbose=0).flatten()

        result_df = pd.DataFrame({
            'timestamp': data['Timestamp'].iloc[indices].values if 'Timestamp' in data.columns else indices,
            'motor_id': data['Product ID'].iloc[indices].values if 'Product ID' in data.columns else [f'Motor_{i}' for i in indices],
            'failure_probability': preds,
        })

        # Sort by timestamp then motor_id to match reference output
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

        # For JSON (analyse page charts) also include sensor cols
        json_df = pd.DataFrame({
            'timestamp': data['Timestamp'].iloc[indices].values if 'Timestamp' in data.columns else indices,
            'motor_id': data['Product ID'].iloc[indices].values if 'Product ID' in data.columns else [f'Motor_{i}' for i in indices],
            'failure_probability': (preds * 100).round(4),
            'air_temp': data['Air temperature [K]'].iloc[indices].values,
            'process_temp': data['Process temperature [K]'].iloc[indices].values,
            'rotational_speed': data['Rotational speed [rpm]'].iloc[indices].values,
            'torque': data['Torque [Nm]'].iloc[indices].values,
            'tool_wear': data['Tool wear [min]'].iloc[indices].values,
        })

        return jsonify({
            "success": True,
            "total_rows": len(json_df),
            "predictions": json_df.to_dict(orient='records')
        })

    except Exception as e:
        print(f"Prediction error: {type(e).__name__}: {e}")
        return jsonify({"success": False, "message": f"Prediction failed: {str(e)}"}), 500


if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True') == 'True'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port)
