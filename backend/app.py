import os
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from auth_service import authenticate_user, log_login, generate_otp, send_otp_email, store_otp, verify_otp, supabase, get_device_ip
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

@app.route('/')
def index():
    return app.send_static_file('login.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    ip_address = get_device_ip(request.remote_addr)

    user = authenticate_user(email, password)

    if user:
        # Step 1 Success: Generate OTP and store it immediately
        otp = generate_otp()
        store_otp(email, otp)

        # Send the OTP email in a background thread so the response is instant
        email_thread = threading.Thread(
            target=send_otp_email,
            args=(email, otp),
            daemon=True
        )
        email_thread.start()

        return jsonify({"success": True, "message": "OTP sent to email", "step": "otp_sent"})
    else:
        # Log failed login in background so response is instant
        log_thread = threading.Thread(
            target=log_login,
            args=(email, ip_address, "Failed Login"),
            daemon=True
        )
        log_thread.start()

        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/verify-otp', methods=['POST'])
def verify_otp_route():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    ip_address = get_device_ip(request.remote_addr)

    is_valid, message = verify_otp(email, otp)

    if is_valid:
        # Log successful login in background so response is instant
        log_thread = threading.Thread(
            target=log_login,
            args=(email, ip_address, "Login Success"),
            daemon=True
        )
        log_thread.start()

        return jsonify({"success": True, "message": "Login successful"})
    else:
        # Log failed OTP in background
        fail_thread = threading.Thread(
            target=log_login,
            args=(email, ip_address, "Failed OTP"),
            daemon=True
        )
        fail_thread.start()

        return jsonify({"success": False, "message": message}), 401

@app.route('/user-details', methods=['GET'])
def get_user_details():
    email = request.args.get('email')
    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400

    try:
        table_name = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        # Fetch the most recent successful login for this user
        response = supabase.table(table_name)\
            .select('ip_address, created_at')\
            .eq('user_email', email)\
            .eq('status', 'Login Success')\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()

        if response.data:
            return jsonify({
                "success": True,
                "ip_address": response.data[0]['ip_address'],
                "last_login": response.data[0]['created_at']
            })
        else:
            # Fallback: return the current request's local device IP if Supabase is empty or timed out
            return jsonify({
                "success": True,
                "ip_address": get_device_ip(request.remote_addr),
                "last_login": None
            })
    except Exception as e:
        print(f"Error fetching user details: {type(e).__name__}: {e}")
        return jsonify({
            "success": False,
            "message": "Server error",
            "ip_address": get_device_ip(request.remote_addr)
        }), 500

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True') == 'True'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port)
