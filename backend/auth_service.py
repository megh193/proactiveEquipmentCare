from supabase_client import supabase
from datetime import datetime

def authenticate_user(email, password):
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return response.user
    except Exception as e:
        print(f"Authentication failed: {e}")
        return None

def log_login(user_email, ip_address, dashboard_accessed="Tableau Dashboard"):
    supabase.table("login_logs").insert({
        "user_email": user_email,
        "login_time": datetime.now().isoformat(),
        "ip_address": ip_address,
        "dashboard_accessed": dashboard_accessed
    }).execute()
