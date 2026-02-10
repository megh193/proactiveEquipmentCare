import os
import uuid
import socket
from datetime import datetime
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv()

def authenticate_user(email, password):
    # Get admin credentials from environment variables
    admin_email = os.getenv('ADMIN_EMAIL', 'admin')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin')
    
    if email == admin_email and password == admin_password:
        return {"email": email, "role": "admin"}
    
    log_login(email, "0.0.0.0", status="Failed")
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
        admin_email = os.getenv('ADMIN_EMAIL', 'admin')
        
        supabase.table(table_name).insert({
            "user_email": user_email,
            "user_id": "admin_static_id" if user_email == admin_email else str(uuid.uuid4()),
            "status": status,
            "ip_address": device_ip,
            "created_at": datetime.now().isoformat()
        }).execute()
        
    except Exception as e:
        print(f"Logging failed: {e}")
