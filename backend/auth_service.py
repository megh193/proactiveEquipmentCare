import os
import socket
import smtplib
import ssl
import random
import string
import re
import bcrypt
from datetime import datetime, timezone, timedelta
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv(override=True)

def generate_otp(length=6):
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

def store_otp(email, otp, role):
    """Upsert OTP into Supabase otp_store table with 2-minute expiry."""
    try:
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        res = supabase.table("otp_store").upsert({
            "email": email,
            "otp": otp,
            "role": role,
            "expires_at": expires_at
        }).execute()
        print(f"[OTP] Stored OTP for {email}: {res.data}")
    except Exception as e:
        print(f"[OTP] Failed to store OTP for {email}: {e}")

def verify_otp(email, entered_otp):
    """Verify OTP from Supabase otp_store."""
    try:
        res = supabase.table("otp_store").select("*").eq("email", email).execute()
        if not res.data:
            return False, "OTP not generated or expired."

        row = res.data[0]
        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            supabase.table("otp_store").delete().eq("email", email).execute()
            return False, "OTP expired."

        if entered_otp == row["otp"]:
            supabase.table("otp_store").delete().eq("email", email).execute()
            return True, "OTP Verified"

        return False, "Incorrect OTP."
    except Exception as e:
        print(f"OTP verification error: {e}")
        return False, "OTP verification failed."


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
    # Skip Tier 1 if user has updated their password via the app (DB is source of truth)
    supabase_auth_ok = False
    try:
        pw_check = supabase.table(user_table).select("password_updated").eq("email", email).execute()
        password_updated = pw_check.data[0].get("password_updated", False) if pw_check.data else False
    except Exception:
        password_updated = False

    if not password_updated:
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

    # ── Tier 2: Fallback — DB bcrypt password check ────
    try:
        response = supabase.table(user_table).select("email, Role, password").eq("email", email).execute()
        users = response.data

        if users and len(users) > 0:
            user = users[0]
            stored_pw = user.get("password", "")
            password_match = False
            try:
                password_match = bcrypt.checkpw(password.encode(), stored_pw.encode())
            except Exception:
                # Legacy plaintext fallback (one-time migration path)
                password_match = (stored_pw == password)

            if password_match:
                role_val = user.get("Role") or user.get("role") or "admin"
                normalized_role = role_val.lower().strip().replace(" ", "_")
                if normalized_role == "superadmin":
                    normalized_role = "super_admin"
                print(f"[Auth] User {email} authenticated via DB fallback.")
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
        
        # Insert log — omit user_id and created_at to avoid FK/column conflicts.
        # Supabase table defaults handle created_at automatically.
        insert_data = {
            "user_email": user_email,
            "status": status,
            "ip_address": device_ip,
        }
        
        result = supabase.table(table_name).insert(insert_data).execute()
        print(f"[Log] Login logged for {user_email} ({status}) from IP {device_ip}")
        
    except Exception as e:
        print(f"Logging failed: {e}")
