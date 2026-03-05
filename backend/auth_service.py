import os
import uuid
import socket
import smtplib
import ssl
import random
import string
import time
from datetime import datetime
import re
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv()

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

This code will expire in 2 minutes.
"""

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message)
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
    stored_otp = data["otp"] # Ensure this matches the generated OTP type (string)
    
    # Check expiration (e.g., 2 minutes = 120 seconds)
    if time.time() - timestamp > 120:
        del otp_storage[email]
        return False, "OTP expired."
        
    if entered_otp == stored_otp:
        del otp_storage[email] # Clear OTP after successful verification
        return True, "OTP Verified"
    
    return False, "Incorrect OTP."

def authenticate_user(email, password):
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return None # Invalid format
        
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

def log_login(user_email, ip_address, dashboard_accessed="Tableau Dashboard", status="Success"):
    try:
        # Resolve actual device IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            device_ip = s.getsockname()[0]
            s.close()
        except Exception:
            device_ip = ip_address

        # Get table name from environment
        table_name = os.getenv('SUPABASE_TABLE_NAME', 'login_logs')
        
        # Parse admin emails to give them a deterministic static ID
        admin_credentials_str = os.getenv("ADMIN_CREDENTIALS", "prathamprajapati133@gmail.com:ibm@1234")
        admin_emails = [pair.split(':')[0].strip() for pair in admin_credentials_str.split(',') if ':' in pair]
        
        supabase.table(table_name).insert({
            "user_email": user_email,
            "user_id": "admin_id" if user_email in admin_emails else str(uuid.uuid4()),
            "status": status,
            "ip_address": device_ip,
            "created_at": datetime.now().isoformat()
        }).execute()
        
    except Exception as e:
        print(f"Logging failed: {e}")
