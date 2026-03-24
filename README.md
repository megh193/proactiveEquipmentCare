# Proactive Equipment Care

A predictive maintenance system for industrial motor equipment. It uses a stacked LSTM neural network to predict machine failure probability from past static sensor data, served through a Flask REST API with a role-based web dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| ML Model | TensorFlow / Keras (LSTM) |
| Backend | Python, Flask, Flask-CORS |
| Auth | Supabase Auth + OTP via Gmail SMTP |
| Database | Supabase (PostgreSQL) |
| Frontend | HTML, CSS, Vanilla JavaScript, Chart.js |
| Data | pandas, NumPy, scikit-learn |

---

## Project Structure

```
AI Codebase/
├── backend/
│   ├── app.py                  # Flask API server (main entry point)
│   ├── auth_service.py         # Two-tier auth, OTP generation & email
│   ├── supabase_client.py      # Supabase client initialisation
│   ├── file_validator.py       # CSV upload validation
│   ├── download_raw_data.py    # Downloads raw sensor CSV from Supabase storage
│   └── predict_and_export.py   # Batch prediction script (offline use)
├── frontend/
│   ├── login.html/js/css               # Login page with OTP modal
│   ├── default_dashboard.html/js/css   # Dashboard (viewer role)
│   ├── admin_dashboard.html/js         # Dashboard (admin role)
│   ├── super_admin_dashboard.html/js   # Dashboard (super admin role)
│   ├── analyse.html/js/css             # Prediction charts & analysis
│   ├── manage_users.html/js/css        # User management (super admin only)
│   ├── profile.html/js/css             # User profile & avatar
│   ├── admin_profile.html/js/css       # Admin profile page
│   └── super_admin_profile.html/js/css # Super admin profile page
├── notebooks/
│   ├── 01_data_loading.ipynb       # Load & merge raw CSVs
│   ├── 02_data_preprocessing.ipynb # Clean & StandardScaler normalisation
│   ├── 03_feature_selection.ipynb  # Select 5 sensor features + target
│   ├── 04_sequence_builder.ipynb   # Build (9224, 30, 5) LSTM sequences
│   └── 05_lstm_model.ipynb         # Train, evaluate & save LSTM model
├── data/
│   ├── raw/                    # Raw sensor CSVs (downloaded via script)
│   ├── processed/              # Normalised CSV + .npy sequence arrays
│   └── profiles.json           # User avatar data (local store)
├── models/
│   └── motor_lstm_model.h5     # Trained LSTM model
├── dashboard/
│   └── motor_failure_predictions.csv  # Batch prediction output
├── docs/                       # Project documentation & reports
├── .env                        # Environment variables (see below)
└── requirements.txt
```

---

## Model Architecture

The LSTM model takes sequences of 30 timesteps × 5 sensor features and outputs a failure probability (0–1) via sigmoid activation.

```
Input: (batch, 30, 5)
  → LSTM(64, return_sequences=True)
  → Dropout(0.2)
  → LSTM(32)
  → Dropout(0.2)
  → Dense(16, relu)
  → Dense(1, sigmoid)

Total params: 30,881
Optimizer: Adam | Loss: Binary Crossentropy
```

**Input features:**
- Air temperature [K]
- Process temperature [K]
- Rotational speed [rpm]
- Torque [Nm]
- Tool wear [min]

---

## Authentication Flow

1. User submits email + password → Flask `/login`
2. Backend performs two-tier auth:
   - **Tier 1:** Supabase Auth (`sign_in_with_password`)
   - **Tier 2 fallback:** Direct DB password check (for legacy users)
3. On success, a 6-digit OTP is generated and emailed via Gmail SMTP
4. User submits OTP → Flask `/verify-otp` → role-based redirect

**Roles:** `super_admin` → `admin`

---

## User Roles & Access

| Feature | Admin | Super Admin |
|---|:---:|:---:|
| Upload CSV & view predictions | ✅ | ✅ |
| Analyse charts | ✅ | ✅ |
| Download predictions CSV | ✅ | ✅ |
| Manage users (add/delete) | ❌ | ✅ |
| View all registered users | ❌ | ✅ |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Step 1 auth — validates credentials, sends OTP |
| `POST` | `/verify-otp` | Step 2 auth — verifies OTP, returns role |
| `POST` | `/api/logout` | Logout |
| `POST` | `/predict` | Run LSTM prediction on uploaded CSV |
| `GET` | `/api/users` | List all users (super admin) |
| `POST` | `/api/users` | Create new user (super admin) |
| `PUT` | `/api/users/<id>` | Update user (super admin) |
| `DELETE` | `/api/users/<id>` | Delete user (super admin) |
| `GET` | `/api/profile` | Get user profile + last login |
| `POST` | `/api/profile/avatar` | Update profile avatar |
| `POST` | `/api/validate-csv` | Validate uploaded CSV format |

The `/predict` endpoint accepts a CSV file and returns JSON predictions including `failure_probability`, sensor readings, `timestamp`, and `motor_id`. Pass `?download=true` to receive a CSV file instead.

---

## Supabase Tables

```sql
-- Login audit log
create table login_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text,
  status text,
  ip_address text,
  created_at timestamp default now()
);

-- User accounts
create table users_database (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text unique,
  password text,
  "Role" text,
  created_at timestamp default now()
);
```

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure `.env`

Create a `.env` file in the project root with the following keys:

```env
# Supabase
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_KEY=<your_service_role_key>

# Database
SUPABASE_DATABASE_URL=<your_postgres_connection_string>
SUPABASE_DATABASE_USER=<db_user>
SUPABASE_DATABASE_PASSWORD=<db_password>
SUPABASE_DATABASE_NAME=postgres
SUPABASE_DATABASE_PORT=6543
SUPABASE_TABLE_NAME=login_logs
SUPABASE_USER_TABLE_NAME=users_database

# Storage
STORAGE_BUCKET_NAME=motor-raw-data

# Flask
FLASK_DEBUG=True
FLASK_PORT=5000

# Raw data download (signed URL from Supabase Storage)
DOWNLOAD_RAW_DATA_URL=<your_signed_url>

# Gmail SMTP (for OTP emails)
MAIL_USERNAME=<your_gmail_address>
MAIL_PASSWORD=<your_gmail_app_password>
```

> All file paths (model, data, output) are resolved dynamically using `os.path` relative to the project root — no path configuration needed.

### 3. Create Supabase tables

Run the SQL from the [Supabase Tables](#supabase-tables) section above in your Supabase SQL editor.

### 4. Download raw data

```bash
python backend/download_raw_data.py
```

### 5. Run the ML pipeline (one-time)

Run the notebooks in order from the `notebooks/` directory:

```
01_data_loading.ipynb       → merges raw CSVs
02_data_preprocessing.ipynb → cleans & normalises sensor data
03_feature_selection.ipynb  → selects 5 features + target
04_sequence_builder.ipynb   → builds sequences: X(9224,30,5), y(9224,)
05_lstm_model.ipynb         → trains, saves motor_lstm_model.h5
```

### 6. Start the server

```bash
cd backend
python app.py
```

The server starts at `http://localhost:5000`. Open `http://localhost:5000` in your browser to access the login page.

---

## Running Predictions

**Via the web dashboard (recommended):**
1. Log in and navigate to the Dashboard
2. Upload a sensor CSV file with the required columns
3. Click "Analyse" to view interactive charts
4. Click "Download Predictions" to export results as CSV

**Via batch script (offline):**
```bash
python backend/predict_and_export.py
```
Output is saved to `dashboard/motor_failure_predictions.csv`.

---

## Required CSV Columns

When uploading sensor data for prediction, the CSV must contain these columns:

```
Air temperature [K]
Process temperature [K]
Rotational speed [rpm]
Torque [Nm]
Tool wear [min]
```

Optional columns used for output enrichment: `Timestamp`, `Product ID`

Minimum rows required: **30** (one full sequence)
