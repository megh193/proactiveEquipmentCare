import os
import requests
from dotenv import load_dotenv

load_dotenv()

DOWNLOAD_RAW_DATA_URL = os.getenv("DOWNLOAD_RAW_DATA_URL")

if not DOWNLOAD_RAW_DATA_URL:
    raise ValueError("DOWNLOAD_RAW_DATA_URL not found in .env file")

# Get project root directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# data/raw path
RAW_DATA_DIR = os.path.join(BASE_DIR, "data", "raw")

# Ensure folder exists
os.makedirs(RAW_DATA_DIR, exist_ok=True)

# Final file path
file_path = os.path.join(RAW_DATA_DIR, "merged_sensorData.csv")

# Download file
response = requests.get(DOWNLOAD_RAW_DATA_URL)

if response.status_code == 200:
    with open(file_path, "wb") as f:
        f.write(response.content)
    print("CSV saved in data/raw")
else:
    print("Download failed:", response.status_code)
