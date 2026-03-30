import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Resolve the .env path relative to this file's actual location on disk,
# regardless of what directory the server is launched from.
_this_dir = os.path.dirname(os.path.abspath(__file__))
_env_path  = os.path.abspath(os.path.join(_this_dir, '..', '.env'))
load_dotenv(dotenv_path=_env_path, override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

print(f"[SupabaseClient] URL loaded: {bool(SUPABASE_URL)}")
print(f"[SupabaseClient] SERVICE_KEY loaded: {bool(SUPABASE_KEY)} (starts: {(SUPABASE_KEY or '')[:12]}...)")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError(
        f"Supabase credentials not found. .env path checked: {_env_path}\n"
        "Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set."
    )

def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = get_supabase_client()
