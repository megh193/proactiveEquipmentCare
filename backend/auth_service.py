import os
import uuid
import socket
import smtplib
import ssl
import random
import string
import re
import bcrypt
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timezone, timedelta
from supabase_client import supabase
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=_env_path, override=True)

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(receiver_email, otp, agenda="login"):
    """Send OTP via email using SMTP."""
    sender_email = os.getenv("MAIL_USERNAME")
    password = os.getenv("MAIL_PASSWORD")

    if not sender_email or not password:
        print("Error: Mail credentials not found in environment variables.")
        return False

    if agenda == "change_password":
        subject = "Your Password Change Verification Code"
        body = f"Your verification code to change your password is: {otp}\n\nThis code will expire in 2 minutes.\nIf you did not request this, please ignore this email."
    else:
        subject = "Your Login Verification Code"
        body = f"Your login verification code is: {otp}\n\nThis code will expire in 2 minutes."

    message = f"Subject: {subject}\n\n{body}"

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=10) as server:
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

def store_otp(email, otp, role, agenda="login"):
    """Upsert OTP into Supabase otp_store table with 2-minute expiry."""
    try:
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat()
        res = supabase.table("otp_store").upsert({
            "email": email,
            "otp": otp,
            "role": role,
            "agenda": agenda,
            "expires_at": expires_at
        }).execute()
        print(f"[OTP] Stored OTP for {email} (agenda={agenda}): {res.data}")
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
            def _supabase_signin():
                return supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": password
                })
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_supabase_signin)
                auth_response = future.result(timeout=5)  # fail fast after 5 s
            if auth_response and auth_response.user:
                supabase_auth_ok = True
        except FuturesTimeoutError:
            print("Supabase Auth sign-in timed out (will try DB fallback)")
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
