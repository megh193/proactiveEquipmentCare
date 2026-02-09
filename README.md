# Proactive Equipment Care

Predictive maintenance system for motor equipment using LSTM neural networks.

## Setup

1. Install dependencies:
```
pip install -r requirements.txt
```

2. Configure .env file with your Supabase credentials

3. Create Supabase tables:
```sql
create table login_logs (
  id uuid default gen_random_uuid(),
  user_email text,
  login_time timestamp,
  ip_address text,
  dashboard_accessed text
);

create table model_predictions (
  timestamp timestamp,
  motor_id text,
  failure_probability float
);
```

4. Run the workflow:
   - Download data: `python backend/download_raw_data.py`
   - Run notebooks 01-05 in sequence
   - Generate predictions: `python backend/predict_and_export.py`
   - Start server: `python backend/app.py`
   - Open `frontend/login.html`

## Project Structure

- backend/ - Python scripts and Flask API
- frontend/ - HTML/CSS/JS login and dashboard
- notebooks/ - Jupyter notebooks for data processing and ML
- data/ - Raw and processed data
- dashboard/ - Prediction outputs for Tableau
- docs/ - Documentation
