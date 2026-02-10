import os
from supabase_client import supabase
from dotenv import load_dotenv

load_dotenv()

BUCKET_NAME = os.getenv("STORAGE_BUCKET_NAME")
RAW_DATA_PATH = os.getenv("RAW_DATA_PATH", "../data/raw/")

def download_files_from_storage():
    files = supabase.storage.from_(BUCKET_NAME).list()
    
    for file in files:
        file_name = file['name']
        if file_name.endswith('.csv'):
            data = supabase.storage.from_(BUCKET_NAME).download(file_name)
            
            with open(os.path.join(RAW_DATA_PATH, file_name), 'wb') as f:
                f.write(data)
            
            print(f"Downloaded: {file_name}")

if __name__ == "__main__":
    download_files_from_storage()
