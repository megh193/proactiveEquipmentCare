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
| Deployment | Vercel (frontend), Render (backend) |
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
│   ├── landing.html/js/css             # Public landing page
│   ├── login.html/js/css               # Login page with OTP modal
│   ├── admin_dashboard.html/js/css     # Dashboard (admin role)
│   ├── super_admin_dashboard.html/js/css # Dashboard (super admin role)
│   ├── analyse.html/js/css             # Prediction charts & analysis
│   ├── manage_users.html/js/css        # User management (super admin only)
│   ├── profile.html/js/css             # Shared profile base
│   ├── admin_profile.html/js/css       # Admin profile page
│   ├── super_admin_profile.html/js/css # Super admin profile page
│   ├── dashboard_core.js               # Shared upload, preview, predict & audit logic
│   ├── dark_mode.js/css                # Dark mode toggle (shared)
│   ├── config.js                       # API base URL config (swap for deployment)
│   ├── vercel.json                     # Vercel frontend deployment config
│   └── default_avatar.svg              # Fallback profile avatar
├── notebooks/
│   ├── 01_data_loading.ipynb       # Load & merge raw CSVs
│   ├── 02_data_preprocessing.ipynb # Clean & StandardScaler normalisation
│   ├── 03_feature_selection.ipynb  # Select 5 sensor features + target
│   ├── 04_sequence_builder.ipynb   # Build (19970, 30, 5) LSTM sequences
│   └── 05_lstm_model.ipynb         # Train, evaluate & save LSTM model
├── data/
│   ├── raw/                    # Raw sensor CSVs (downloaded via script)
│   ├── processed/              # Normalised CSV + .npy sequence arrays
│   └── profiles.json           # User avatar data (local store)
├── models/
│   ├── motor_lstm_model.h5     # Trained LSTM model
│   └── scaler.pkl              # Fitted StandardScaler (saved during preprocessing)
├── dashboard/
│   └── motor_failure_predictions.csv  # Batch prediction output
├── docs/                       # Project documentation & reports
├── .env                        # Environment variables (see below)
└── requirements.txt
```

---

## Model Architecture

The LSTM model takes sequences of 30 timesteps × 5 sensor features and outputs a failure probability (0–1) via sigmoid activation.

**Improved Architecture (v2.0):**

```
Input: (batch, 30, 5)
  → LSTM(128, return_sequences=True, L2=0.00005)
  → Dropout(0.15)
  → LSTM(64, return_sequences=False, L2=0.00005)
  → Dropout(0.15)
  → Dense(32, relu)
  → BatchNormalization
  → Dropout(0.1)
  → Dense(16, relu)
  → BatchNormalization
  → Dropout(0.1)
  → Dense(1, sigmoid)

Total params: 57,505
Optimizer: Adam(lr=0.001) with ReduceLROnPlateau
Loss: Binary Crossentropy
Class Weights: Sqrt-scaled for balanced training
Threshold Method: Youden's Index
Expected Accuracy: 60%+
```

**Improvements over v1.0:**
- Larger LSTM capacity (128→64 units) for better feature extraction
- BatchNormalization layers for training stability
- Reduced dropout (0.15) to prevent underfitting
- Lighter L2 regularization (0.00005) for more flexibility
- Sqrt-scaled class weights for better imbalance handling
- ReduceLROnPlateau callback for dynamic learning rate adjustment
- Youden's Index threshold for balanced sensitivity/specificity

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
   - **Tier 2 fallback:** Direct DB bcrypt password check (for users who changed their password via the app)
3. On success, a 6-digit OTP is generated and emailed via Gmail SMTP (expires in 2 minutes)
4. User submits OTP → Flask `/verify-otp` → role-based redirect

**Roles:** `super_admin` → `admin`

---

## User Roles & Access

| Feature | User | Admin |
|---|:---:|:---:|
| Upload CSV & view predictions | ✅ | ✅ |
| Single motor prediction (live sensor input) | ✅ | ✅ |
| Analyse charts | ✅ | ✅ |
| Download predictions CSV | ✅ | ✅ |
| Dark mode toggle | ✅ | ✅ |
| Change own password (OTP-verified) | ✅ | ✅ |
| Update profile avatar | ✅ | ✅ |
| Manage users (add/edit/delete) | ❌ | ✅ |
| View all registered users | ❌ | ✅ |
| View prediction audit logs | ❌ | ✅ |
| View login logs | ❌ | ✅ |
| Export audit & login logs as CSV | ❌ | ✅ |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Step 1 auth — validates credentials, sends OTP |
| `POST` | `/verify-otp` | Step 2 auth — verifies OTP, returns role |
| `POST` | `/api/logout` | Logout |
| `POST` | `/predict` | Run LSTM prediction on uploaded CSV |
| `POST` | `/api/signup` | Self-register a new admin account |
| `GET` | `/api/users` | List all users (super admin) |
| `POST` | `/api/users` | Create new user (super admin) |
| `PUT` | `/api/users/<id>` | Update user (super admin) |
| `DELETE` | `/api/users/<id>` | Delete user (super admin) |
| `GET` | `/api/profile` | Get user profile + last login |
| `POST` | `/api/profile/avatar` | Update profile avatar |
| `POST` | `/api/validate-csv` | Validate uploaded CSV format |
| `POST` | `/api/change-password/request-otp` | Send OTP to verify password change |
| `POST` | `/api/change-password/verify` | Verify OTP and update password |
| `POST` | `/api/audit-logs` | Log a prediction run (user, CSV name, row count) |
| `GET` | `/api/audit-logs` | Retrieve all prediction audit logs (super admin) |
| `GET` | `/api/login-logs` | Retrieve all login logs (super admin) |
| `POST` | `/api/predict-single` | Run prediction on a single set of sensor readings |

The `/predict` endpoint accepts a CSV file and returns JSON predictions including `failure_probability`, sensor readings, `timestamp`, and `motor_id`. Pass `?download=true` to receive a CSV file instead.

---

## Audit Trail

Every time a prediction is run (via Analyse or Download Predictions), the system automatically logs:

- **Who** ran it — the logged-in user's email
- **When** — UTC timestamp of the run
- **What data** — the uploaded CSV filename and row count

These logs are stored in the `prediction_audit_logs` table and are accessible only to Super Admins via the **Audit Logs** tab on the Super Admin Dashboard. Logs can be exported as a CSV file for compliance or reporting purposes.

Login activity (successful and failed attempts) is similarly viewable and exportable from the **Login Logs** tab.

---

## Supabase Tables

```sql
-- Login activity log
create table login_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text,
  user_id uuid,
  status text,
  ip_address text,
  created_at timestamp with time zone default now()
);

-- User accounts
create table users_database (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text unique,
  password text,
  "Role" text,
  password_updated boolean default false,
  created_at timestamp with time zone default now()
);

-- OTP store (login & password change)
create table otp_store (
  email text primary key,
  otp text,
  role text,
  agenda text,
  expires_at timestamp with time zone
);

-- Prediction audit log
create table prediction_audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  csv_name text not null,
  row_count integer default 0,
  ran_at timestamp with time zone default now()
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
AUDIT_LOG_TABLE_NAME=prediction_audit_logs

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
01_data_loading.ipynb       → Merges raw CSVs, removes duplicates
02_data_preprocessing.ipynb → Cleans data, normalizes with StandardScaler
03_feature_selection.ipynb  → Selects 5 features + target variable
04_sequence_builder.ipynb   → Creates (19970, 30, 5) sequences for LSTM
05_lstm_model.ipynb         → Trains improved LSTM, evaluates with confusion matrix, saves model
```

**Model Training Details:**
- **Dataset:** 19,970 sequences (6.18% failures, 93.82% no-failures)
- **Train/Test:** 80/20 split with stratification (15,976 / 3,994)
- **Epochs:** 100 with early stopping based on validation accuracy
- **Batch Size:** 32
- **Class Balancing:** Sqrt-scaled weights (no-fail: 1.0, fail: 3.9)
- **Expected Accuracy:** 60%+ with balanced sensitivity/specificity
- **Threshold:** Youden's Index (≈0.50) for optimal balance

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

**Via single motor prediction (real-time):**
1. On the Dashboard, switch to the **Single Prediction** tab
2. Enter live sensor readings for all 5 fields
3. Click "Predict Failure" to instantly see the failure probability gauge and risk level

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

> The `/predict` endpoint performs flexible column name matching — common variants such as `air_temperature`, `AirTemperature`, and `Rotational speed` are automatically recognised and mapped to the standard names.

---

## Risk Thresholds

The LSTM model outputs a failure probability (0–100%). The system classifies each prediction into one of three risk tiers:

| Risk Level | Threshold | Action |
|---|---|---|
| 🔴 High | ≥ 70% | Immediate maintenance required |
| 🟡 Medium | 30–70% | Monitor closely, plan preventive maintenance |
| 🟢 Low | < 30% | Operating normally |

These thresholds apply across the dashboard metrics, analyse charts, and single motor prediction gauge.

**Threshold Calculation:**
The model uses **Youden's Index** (Sensitivity + Specificity - 1) to automatically select the optimal decision threshold that balances catching real failures against false alarms. This is more robust than a fixed 0.5 threshold, especially with imbalanced data.

---

## Dark Mode

All pages support a persistent dark mode toggle. The preference is saved to `localStorage` and automatically applied on every page load. Chart colours update dynamically when toggled.

---

## Deployment

| Layer | Platform |
|---|---|
| Frontend | [Vercel](https://vercel.com) — static hosting via `vercel.json` |
| Backend | [Render](https://render.com) — Python/Flask web service |

To point the frontend at your deployed backend, update `frontend/config.js`:

```js
const CONFIG = {
    API_BASE_URL: 'https://your-backend.onrender.com'
};
```
