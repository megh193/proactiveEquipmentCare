import os
import uuid
import smtplib
import ssl
import random
import string
import time
from datetime import datetime
import re
import socket
from supabase import create_client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client directly in auth_service
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    options = ClientOptions(postgrest_client_timeout=5)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=options)

def get_device_ip(request_ip):
    """Retrieve the actual local device IP (e.g. 10.x.x.x) which is used in this project setup."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # connect to a public DNS server to find the outbound network interface IP
        s.connect(("8.8.8.8", 80))
        device_ip = s.getsockname()[0]
        s.close()
        return device_ip
    except Exception:
        return request_ip

# Temporary OTP storage (In production, use Redis or a database)
otp_storage = {}

def generate_otp(length=6):
    """Generate a numeric OTP of given length."""
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(receiver_email, otp):
    """Send OTP via email using SMTP."""
    sender_email = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")

    if not sender_email or not password:
        print("Error: Mail credentials not found in environment variables.")
        return False

    message = f"""\
Subject: Your Login Verification Code

Your verification code is: {otp}

This code will expire in 5 minutes.
"""

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message)
        print(f"OTP email sent successfully to {receiver_email}")
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def store_otp(email, otp):
    """Store OTP with a timestamp."""
    otp_storage[email] = {
        "otp": otp,
        "timestamp": time.time()
    }

def verify_otp(email, entered_otp):
    """Verify the entered OTP."""
    if email not in otp_storage:
        return False, "OTP not generated or expired."
    
    data = otp_storage[email]
    timestamp = data["timestamp"]
    stored_otp = data["otp"]
    
    # Check expiration (5 minutes = 300 seconds)
    if time.time() - timestamp > 300:
        del otp_storage[email]
        return False, "OTP expired."
        
    if entered_otp == stored_otp:
        del otp_storage[email]  # Clear OTP after successful verification
        return True, "OTP Verified"
    
    return False, "Incorrect OTP."

def authenticate_user(email, password):
    """Authenticate user against credentials stored in .env."""
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return None  # Invalid format

    # Fetch admin credentials from .env
    # Format: email1:pass1,email2:pass2
    admin_credentials_str = os.getenv("ADMIN_CREDENTIALS", "prathamprajapati133@gmail.com:ibm@1234")
    
    # Parse the credentials into a dictionary
    valid_users = {}
    for pair in admin_credentials_str.split(','):
        if ':' in pair:
            e, p = pair.split(':', 1)
            valid_users[e.strip()] = p.strip()
    
    # Check against valid admin credentials
    if email in valid_users and password == valid_users[email]:
        return {"email": email, "role": "admin"}
    
    return None

def log_login(user_email, ip_address, status="Success"):
    """Log a login attempt to the Supabase login_logs table."""
    try:
        # Get table name from environment
        table_name = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        
        # Parse admin emails to give them a deterministic static ID
        admin_credentials_str = os.getenv("ADMIN_CREDENTIALS", "prathamprajapati133@gmail.com:ibm@1234")
        admin_emails = [pair.split(':')[0].strip() for pair in admin_credentials_str.split(',') if ':' in pair]

        # Use the request IP directly (passed in from Flask's request.remote_addr)
        log_ip = ip_address if ip_address else "Unknown"

        result = supabase.table(table_name).insert({
            "user_email": user_email,
            "user_id": "admin_id" if user_email in admin_emails else str(uuid.uuid4()),
            "status": status,
            "ip_address": log_ip,
            "created_at": datetime.now().isoformat()
        }).execute()

        print(f"Login logged: {user_email} | {status} | IP: {log_ip} | Result: {result}")

    except Exception as e:
        print(f"Logging failed for {user_email}: {type(e).__name__}: {e}")
