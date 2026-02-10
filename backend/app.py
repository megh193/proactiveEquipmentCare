from flask import Flask, request, jsonify
from flask_cors import CORS
from auth_service import authenticate_user, log_login

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
        log_login(email, ip_address)
        return jsonify({"success": True, "message": "Login successful"})
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

if __name__ == '__main__':
    app.run(debug=True, port=5000)
