import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from auth_service import authenticate_user, log_login, generate_otp, send_otp_email, store_otp, verify_otp, supabase
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
    ip_address = request.remote_addr
    
    user = authenticate_user(email, password)
    
    if user:
        # Step 1 Success: Generate and Send OTP
        otp = generate_otp()
        store_otp(email, otp)
        email_sent = send_otp_email(email, otp)
        
        if email_sent:
            return jsonify({"success": True, "message": "OTP sent to email", "step": "otp_sent"})
        else:
             return jsonify({"success": False, "message": "Failed to send OTP. Check server logs."}), 500
    else:
        log_login(email, ip_address, status="Failed Login")
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/verify-otp', methods=['POST'])
def verify_otp_route():
    data = request.json
    email = data.get('email')
    otp = data.get('otp')
    ip_address = request.remote_addr
    
    is_valid, message = verify_otp(email, otp)
    
    if is_valid:
        log_login(email, ip_address, status="Login Success")
        return jsonify({"success": True, "message": "Login successful"})
    else:
        log_login(email, ip_address, status="Failed OTP")
        return jsonify({"success": False, "message": message}), 401

@app.route('/user-details', methods=['GET'])
def get_user_details():
    email = request.args.get('email')
    if not email:
        return jsonify({"success": False, "message": "Email required"}), 400
        
    try:
        table_name = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        # Fetch the most recent login for this user
        response = supabase.table(table_name).select('ip_address, created_at').eq('user_email', email).order('created_at', desc=True).limit(1).execute()
        
        if response.data:
            return jsonify({
                "success": True, 
                "ip_address": response.data[0]['ip_address'],
                "last_login": response.data[0]['created_at']
            })
        else:
            return jsonify({
                "success": True, 
                "ip_address": request.remote_addr,
                "last_login": None
            })
    except Exception as e:
        print(f"Error fetching user details: {e}")
        return jsonify({"success": False, "message": "Server error", "ip_address": request.remote_addr}), 500

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True') == 'True'
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=debug_mode, port=port)
