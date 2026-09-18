# Billing System

A generic, multi-shop billing application: each shop (business) gets fully isolated
customers, products, and invoices under its own account, so the same deployment can
serve many independent businesses. Mahaveer Electrical Shop is the current example
deployment, but nothing in the system is tied to that or any other specific business
type. Built as a React/Vite single-page frontend and a Node.js/Express API backed by
MongoDB through Mongoose.

## Features

- Owner login using JWT sessions stored in an HTTP-only cookie
- Multi-shop data isolation — every customer, product, and invoice belongs to exactly
  one shop, enforced at the data layer, with each shop's own business identity
  (name, address, phone, email, invoice terms)
- Protected dashboard and application routes
- Customer and product management
- New bills, draft bills, invoice details, and monthly sales views
- Invoice/PDF-related backend services
- Manual bill photo uploads
- Dashboard and reporting endpoints
- Health-check endpoint for deployment and local verification
- Security middleware including Helmet, CORS, rate limiting, validation, and centralized error handling

## Tech stack

- **Frontend:** React 19, Vite, React Router, TanStack React Query, Tailwind CSS 4, PWA support
- **Backend:** Node.js 20+, Express 5, ES modules
- **Database:** MongoDB with Mongoose
- **Authentication:** JSON Web Tokens, bcryptjs, HTTP-only cookies
- **Documents and uploads:** PDFKit, Multer, AWS S3 SDK
- **Testing:** Jest, Supertest, MongoDB Memory Server

## Repository structure

```text
billing-system/
├── backend/
│   ├── app.js                 # Express application and API middleware
│   ├── server.js              # Database connection and HTTP server entry point
│   ├── config/                # Database and application configuration
│   ├── controllers/           # Request handlers
│   ├── middleware/            # Authentication, validation, and error middleware
│   ├── models/                # Mongoose models
│   ├── routes/                # Health, auth, customer, product, invoice, and dashboard routes
│   ├── services/              # Business logic, PDFs, and storage integrations
│   ├── utils/                 # Shared utilities and admin seeding
│   └── __tests__/             # Backend tests
├── frontend/
│   ├── src/App.jsx            # Router, providers, and protected application shell
│   ├── src/api/               # API client functions
│   ├── src/components/        # Reusable UI components
│   ├── src/context/           # Authentication and application context
│   ├── src/hooks/              # Reusable React hooks
│   ├── src/layouts/            # Shared application layouts
│   ├── src/pages/              # Login, billing, customer, product, and reporting screens
│   ├── src/routes/             # Protected route handling
│   └── src/utils/              # Frontend helpers
└── README.md
```

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB running locally or a reachable MongoDB deployment
- Git

## Setup

```bash
git clone https://github.com/Akashathani03/billing-system.git
cd billing-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd backend && npm install
cd ../frontend && npm install
```

## Configuration

`backend/.env` variables:

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | session token signing |
| `COOKIE_NAME` | name of the httpOnly auth cookie |
| `CLIENT_ORIGIN` | frontend origin, for CORS (default `http://localhost:5173`) |
| `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | used once by `npm run seed` to create the first login |
| `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_PHONE`, `SHOP_EMAIL`, `INVOICE_TERMS` | shop identity, applied once when `npm run seed` / `npm run migrate:shops` creates a shop |

`frontend/.env` variables:

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | base URL the SPA calls (default `http://localhost:5000/api`) |

Never commit a real `.env` file — only `.env.example` is tracked. If you accidentally stage one, unstage it before committing.

## MongoDB setup

The app expects a reachable MongoDB instance at `MONGODB_URI`. For local development:

- **Windows service**: confirm it's running with `Get-Service MongoDB` in PowerShell —
  `Status` should read `Running`. The default URI `mongodb://127.0.0.1:27017/mahaveer_billing`
  will work as-is; the database is created automatically on first write.
- **WSL/manual**: start `mongod` yourself and point `MONGODB_URI` at it.

No manual database creation is needed — Mongoose creates the database and collections
on first use.

## Run locally

Start MongoDB, then use two terminals:

```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

The API runs on `http://localhost:5000` by default and the Vite app runs on `http://localhost:5173`.

Useful commands:

```bash
cd backend
npm start       # production-style server
npm test        # Jest test suite
npm run seed    # seed the first owner account from environment variables

cd ../frontend
npm run build
npm run lint
npm run preview
```

## Health check

```bash
curl http://localhost:5000/api/health
```

A successful response includes `status: "ok"` and reports the MongoDB connection state.

## Security notes

The backend trusts one reverse-proxy hop for deployment, restricts credentialed CORS to configured origins, uses Helmet, validates requests, rate-limits sensitive routes, and avoids exposing internal errors to clients. Keep JWT secrets, database credentials, storage credentials, and seed passwords outside source control.
