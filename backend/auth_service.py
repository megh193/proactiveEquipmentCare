import os
import uuid
import socket
import smtplib
import ssl
import random
import string
import time
import re
from datetime import datetime, timezone
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv(override=True)

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
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=10) as server:
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
    stored_otp = data["otp"]
    
    # Check expiration (2 minutes = 120 seconds)
    if time.time() - timestamp > 120:
        del otp_storage[email]
        return False, "OTP expired."
        
    if entered_otp == stored_otp:
        del otp_storage[email]  # Clear OTP after successful verification
        return True, "OTP Verified"
    
    return False, "Incorrect OTP."


def authenticate_user(email, password):
    """
    Two-tier authentication:
    1. Try Supabase Auth (sign_in_with_password) — works for users created via the new dashboard.
    2. Fallback to users_database plaintext check — works for pre-existing users not yet in Supabase Auth.
    On success, returns {"email": ..., "role": ...}. Returns None on failure.
    """
    # Validate email format
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        return None

    user_table = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")

    # ── Tier 1: Supabase Auth ──────────────────────────────
    supabase_auth_ok = False
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        if auth_response and auth_response.user:
            supabase_auth_ok = True
    except Exception as e:
        print(f"Supabase Auth sign-in failed (will try DB fallback): {e}")

    if supabase_auth_ok:
        # Fetch role from users_database
        try:
            response = supabase.table(user_table).select("email, Role").eq("email", email).execute()
            if response.data and len(response.data) > 0:
                user = response.data[0]
                role_val = user.get("Role") or user.get("role") or "admin"
                normalized_role = role_val.lower().strip().replace(" ", "_")
                if normalized_role == "superadmin":
                    normalized_role = "super_admin"
                return {"email": email, "role": normalized_role}
        except Exception as e:
            print(f"Error fetching role after Supabase Auth success: {e}")
        return None

    # ── Tier 2: Fallback — DB plaintext password check ────
    # Handles existing users who pre-date Supabase Auth migration.
    try:
        response = supabase.table(user_table).select("email, Role, password").eq("email", email).execute()
        users = response.data

        if users and len(users) > 0:
            user = users[0]
            if user.get("password") == password:
                role_val = user.get("Role") or user.get("role") or "admin"
                normalized_role = role_val.lower().strip().replace(" ", "_")
                if normalized_role == "superadmin":
                    normalized_role = "super_admin"
                print(f"[Auth] User {email} authenticated via DB fallback (not yet in Supabase Auth).")
                return {"email": email, "role": normalized_role}
    except Exception as e:
        print(f"DB fallback auth error: {e}")

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
        
        # Fetch User from users_database
        user_table = os.getenv("SUPABASE_USER_TABLE_NAME", "users_database")
        user_res = supabase.table(user_table).select("id, Role").eq("email", user_email).execute()
        
        user_id = str(uuid.uuid4())  # Default fallback
        if user_res.data and len(user_res.data) > 0:
            db_id = user_res.data[0].get("id")
            if db_id:
                user_id = str(db_id)
        
        supabase.table(table_name).insert({
            "user_email": user_email,
            "user_id": user_id,
            "status": status,
            "ip_address": device_ip,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
    except Exception as e:
        print(f"Logging failed: {e}")
