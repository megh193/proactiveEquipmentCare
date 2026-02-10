import uuid
import socket
from datetime import datetime
from supabase_client import supabase 

def authenticate_user(email, password):
    # Static authentication
    if email == "admin" and password == "admin":
        # Return a simple user object/dict
        return {"email": email, "role": "admin"}
    
    # Log failed attempt
    # We pass a dummy IP because log_login resolves the device IP internally
    log_login(email, "0.0.0.0", status="Failed")
    return None

def log_login(user_email, ip_address, dashboard_accessed="Tableau Dashboard", status="Success"):
    try:
        # Resolve actual device IP (LAN IP) instead of using the passed ip_address (which might be loopback)
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            # connecting to public DNS (doesn't send data) to determine outgoing interface IP
            s.connect(("8.8.8.8", 80))
            device_ip = s.getsockname()[0]
            s.close()
        except Exception:
            device_ip = ip_address # Fallback to passed IP if resolution fails

        # Insert into Supabase 'login_logs' table matching the screenshot schema:
        # id (auto-gen), user_email, user_id, status, ip_address, created_at
        supabase.table("login_logs").insert({
            "user_email": user_email,
            "user_id": "admin_static_id" if user_email == "admin" else str(uuid.uuid4()), # Placeholder ID
            "status": status,
            "ip_address": device_ip,
            "created_at": datetime.now().isoformat()
        }).execute()
        
    except Exception as e:
        print(f"Logging failed: {e}")
