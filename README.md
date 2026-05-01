# ContinuAuth 
Behavioral Biometric Continuous Authentication System

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | React 18 + Vite + React Router    |
| Backend  | FastAPI + Python 3.11+            |
| ML       | scikit-learn (OneClassSVM, LOF)        |
| Database | Supabase (PostgreSQL)             |

## Project Structure

```
continuauth/
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── requirements.txt
│   ├── .env.example               # copy to .env and fill in
│   ├── database/
│   │   ├── config.py              # Supabase client
│   │   └── db.py                  # user CRUD
│   ├── pipelines/
│   │   ├── keystroke_pipeline.py  # feature extraction (47-dim)
│   │   └── model_pipeline.py      # OneClassSVM train/score
│   └── routers/
│       ├── auth.py                # /api/auth/*
│       ├── enroll.py              # /api/enroll/*
│       └── session.py             # /api/session/*
└── frontend/
    ├── package.json
    ├── vite.config.js             # proxies /api → localhost:8000
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx                # React Router
        ├── api/client.js          # fetch wrappers
        ├── hooks/useKeystroke.js  # real keydown/keyup capture 
        ├── components/
        │   ├── Header.jsx
        │   └── styles.js
        └── pages/
            ├── HomePage.jsx
            ├── EnrollPage.jsx
            └── SessionPage.jsx
```

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_KEY in .env

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn main:app --reload       # Runs on http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                     # Runs on http://localhost:5173
```

Vite proxies `/api/*` → `http://localhost:8000` automatically.

## Key Improvement Over Streamlit Version

The React frontend captures **real** `keydown` and `keyup` DOM events with
`Date.now()` timestamps — no approximation. This gives more accurate timing
data and should improve model EER beyond the notebook's 8.34% baseline.

## API Endpoints

| Method | Path                              | Description              |
|--------|-----------------------------------|--------------------------|
| POST   | /api/auth/register                | Create account           |
| POST   | /api/auth/login                   | Verify password          |
| POST   | /api/enroll/attempt               | Save one typing attempt  |
| POST   | /api/enroll/train                 | Train OneClassSVM model  |
| GET    | /api/enroll/status/{user_id}      | Check attempt count      |
| POST   | /api/session/score                | Continuous auth check    |
| POST   | /api/session/login-score          | Login keystroke score    |
| GET    | /api/session/logs/{uid}/{sid}     | Fetch session audit log  |

## Supabase Schema

Same schema as v1 — no migrations needed if upgrading from Streamlit version.
Required tables: `users`, `user_models`, `auth_logs`, `login_attempts`
