# Mahaveer Electrical Shop Billing System

A mobile-first billing application for Mahaveer Electrical Shop. The project is organized as a React/Vite single-page frontend and a Node.js/Express API backed by MongoDB through Mongoose.

## Features

- Owner login using JWT sessions stored in an HTTP-only cookie
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

Configure `backend/.env` with `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and the shop/invoice settings documented in `backend/.env.example`. Configure `VITE_API_BASE_URL` in `frontend/.env` if the API is not running at `http://localhost:5000/api`. Never commit real environment files.

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
