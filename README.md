# Mahaveer Electrical Shop — Billing System

Mobile-first billing app for Mahaveer Electrical Shop. React + Vite + Tailwind frontend,
Node/Express + MongoDB backend. See the approved implementation blueprint for full
architecture, schemas, API spec and the phase-by-phase build plan.

This repo is being built in small phases (Phase 0 = this baseline). No business
functionality — auth, billing, invoicing — exists yet.

## Prerequisites

- Node.js 20+ and npm
- MongoDB running locally (or a connection string to a remote instance)
  - Windows: install via the MongoDB Community MSI, runs as the `MongoDB` service
  - WSL/Linux: `sudo apt install mongodb` or run `mongod` yourself
- Git

## Project structure

```
mahaveer-billing/
├── backend/     Express API (MongoDB via Mongoose)
├── frontend/    React + Vite + Tailwind SPA
└── README.md
```

## Environment setup

Both apps read config from `.env`, which is **git-ignored** — only `.env.example`
is committed. Copy the example and fill in real values before running anything:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env` variables:

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | session token signing |
| `COOKIE_NAME` | name of the httpOnly auth cookie |
| `CLIENT_ORIGIN` | frontend origin, for CORS (default `http://localhost:5173`) |
| `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | used once by `npm run seed` to create the first login |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_PHONE`, `SHOP_GST`, `SHOP_EMAIL`, `SHOP_LOGO_PATH`, `INVOICE_TERMS`, `TAX_RATE` | centralized shop identity used on every invoice/PDF |

`frontend/.env` variables:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | base URL the SPA calls (default `http://localhost:5000/api`) |

Never commit a real `.env` file. If you accidentally stage one, unstage it before committing.

## MongoDB setup

The app expects a reachable MongoDB instance at `MONGODB_URI`. For local development:

- **Windows service**: confirm it's running with `Get-Service MongoDB` in PowerShell —
  `Status` should read `Running`. The default URI `mongodb://127.0.0.1:27017/mahaveer_billing`
  will work as-is; the database is created automatically on first write.
- **WSL/manual**: start `mongod` yourself and point `MONGODB_URI` at it.

No manual database creation is needed — Mongoose creates the database and collections
on first use.

## Installation

Install each app's dependencies separately:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Development commands

Run both apps in separate terminals:

```bash
# terminal 1 — API on http://localhost:5000
cd backend
npm run dev

# terminal 2 — SPA on http://localhost:5173
cd frontend
npm run dev
```

## Verifying the baseline

1. **Backend health check** — with the backend running:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Expect `{"status":"ok","time":"...","db":"connected"}`. `db` reads `"connected"`
   only once MongoDB is reachable.

2. **Frontend ↔ backend** — open `http://localhost:5173` in a browser. The page calls
   `/api/health` on load and displays the result; a green "Backend: ok" line confirms
   the two apps can talk to each other end to end.

## Seeding the first login

Not available yet — added in Phase 1 along with authentication.
