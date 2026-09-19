# Billing System

A generic multi-shop billing platform with an AI billing assistant called **Clerk**. Each shop gets its own isolated customers, products and invoices, and can ask Clerk questions about its billing data in plain language — including generating downloadable PDF reports.

## Overview

Small retail businesses often track bills, payments and outstanding balances by hand or in spreadsheets, and answering a simple question ("who still owes me money?") means digging through records. This project is a mobile-first billing application that covers day-to-day billing and puts a natural-language assistant on top of it.

- **Billing platform** — manages customers, products, draft and finalized invoices, payment status (paid / pending), payment methods, sales summaries, invoice PDFs and manual bill photos.
- **Clerk** — an AI assistant that answers questions about the signed-in shop's billing data and how to use the system, and can generate PDF reports on request.
- **Multi-shop by design** — every record belongs to exactly one shop, and the shop is always taken from the authenticated session, never from client input.

The system is not tied to any one business type. Two things are currently fixed for every shop rather than configurable per shop: amounts are in Indian rupees, and the business day (used for "today" and month boundaries) is `Asia/Kolkata`. Tax/GST calculation is not implemented; an invoice total is the sum of its line totals.

## Key Features

- Multi-shop billing with shop-level data isolation
- Authentication with JWT sessions in an HTTP-only cookie
- Customer management and per-customer bill history
- Product management
- Invoice/bill management: draft → finalized, per-shop sequential invoice numbers, invoice PDFs
- Paid / Pending payment tracking with payment history, and payment methods (cash, UPI, card, credit)
- Sales information: dashboard summary, 7-day trend, monthly sales
- Outstanding customer balances
- Manual bill photo uploads (S3-compatible object storage; in-memory fallback for development and tests)
- **Clerk — AI billing assistant**
  - Natural-language billing queries
  - Gemini function calling over a fixed set of backend tools
  - RAG-based billing knowledge (help and how-to questions)
  - AI-generated PDF reports
  - Gemini rate-limit and error handling
- Installable PWA shell (only static assets are cached; API data is never cached)

## Clerk — AI Billing Assistant

Clerk lets a shop owner ask things like *"show me the pending bills"*, *"what are my top products?"*, *"how do I add a customer?"* or *"make a PDF of my August bills"* instead of navigating screens and filters. It is available in the app as the **Clerk** tab.

### How it works

Clerk uses Gemini **function calling**. The backend gives the model a fixed list of tool declarations; the model can only *ask* for one of those tools by name. The backend validates the request, runs it, and returns the result to the model, which then writes the reply.

**Gemini does not access MongoDB.** It has no database connection, credentials or query interface. It can only request predefined backend tools, and the backend validates and executes every one of them.

```
User
↓
Clerk UI
↓
POST /api/ai/chat
↓
Authentication
↓
AI Orchestrator
↓
Gemini
↓
Validated Tool
↓
Billing Service
↓
MongoDB
↓
Tool Result
↓
Gemini
↓
Clerk Response
```

The orchestrator (`backend/services/ai/orchestrator.service.js`) runs a manual tool-calling loop, bounded to 3 tool rounds per message. Each request is stateless — no chat history is stored on the server.

### Backend tools

| Tool | Purpose |
|---|---|
| `get_bills` | List bills, filtered by status, payment status, date range or search text |
| `get_payment_totals` | Money collected by payment method, plus the pending total |
| `get_outstanding_amount` | Total pending amount across finalized bills |
| `get_sales_by_month` | Finalized sales by month |
| `get_top_products` | Best-selling products by quantity |
| `get_customers_with_outstanding_balance` | Customers who currently owe money |
| `retrieve_knowledge` | Look up help / how-to documentation (see RAG below) |
| `generate_billing_report` | Generate a PDF report and return a reference to it |

List-style tool results (bills, products, customers) are projected down to the fields needed to answer a question and capped at 20 rows. The frontend renders replies with a small, safe Markdown subset (bold, lists, line breaks) and never as raw HTML.

### How reports work with Clerk

When a report is requested, `generate_billing_report` builds the PDF on the server and stores it. Only a small reference (`reportId`, `filename`) is returned to Gemini and to the chat response — the PDF bytes never pass through the model. The frontend then downloads the file through a separate authenticated endpoint.

## RAG Architecture

The knowledge base is a small set of Markdown files in `backend/knowledge/` (`billing-help.md`, `invoice-guide.md`, `payment-guide.md`, `product-guide.md`, `faq.md`). It covers *how to use the system* — creating a bill, adding customers and products, what "pending" means — not live shop data. Live numbers always come from the billing tools.

The current implementation is a **dependency-free lexical retrieval** approach. It does **not** use a vector database, embeddings, or any external retrieval service.

- Each file is split into chunks on `##` headings.
- Text is lower-cased, tokenized, stripped of stop words and crudely singularized.
- A chunk's score is the number of query terms it contains, with terms in its heading counted double.
- Chunks that share no terms with the query are dropped, and the top 3 by score are returned to Gemini as the tool result; Gemini writes the answer from them.
- If nothing is relevant, the tool reports that nothing was found and Clerk is instructed to say so rather than guess.
- `retrieve_knowledge` takes free text only; user input is never used to build a file path, and only the five listed files can be read.

## Security / Multi-Shop Isolation

- **Authentication** — login issues a JWT stored in an HTTP-only cookie; passwords are hashed with bcrypt; login is rate limited. `requireAuth` protects every AI route.
- **Shop context comes from the token** — `shopId` is read from the verified JWT payload (`req.user.shopId`). A `shopId` sent in a request body is ignored for AI queries (covered by a test).
- **AI tools do not take a `shopId`** — no tool schema declares one, so the model has no argument to fill. The server passes the authenticated `shopId` to each tool separately.
- **Scoped queries** — billing queries filter by the authenticated shop.
- **Validated arguments** — every tool validates its arguments (enums, dates, bounded integers, string lengths) before running.
- **Allowlist only** — unknown tool names are rejected; tools are looked up in a `Map`, so names like `constructor` cannot resolve to anything.
- **No arbitrary queries or code** — tools call fixed service functions; the model cannot submit MongoDB queries, run code, read files or supply URLs.
- **Reports are shop-scoped** — report ids are random UUIDs, validated on the route, and a report can only be downloaded by the shop that created it. A wrong-shop id and a nonexistent id both return the same 404.
- **Input limits** — chat messages must be non-empty strings of at most 500 characters, and `/api/ai/chat` is rate limited (10 requests per minute per IP).
- **Secrets stay on the backend** — the Gemini API key is read from the backend environment only; the frontend never receives it. Helmet, an origin-restricted CORS policy and sanitized error responses are also in place.

These controls are enforced in application code and covered by automated tests; this project has not had a formal third-party security review.

Known data-minimization gap: the `get_customers_with_outstanding_balance` result sent to Gemini includes each customer's mobile number. The bill-listing tool omits mobile numbers.

## AI Reliability and Error Handling

Gemini availability and quota are external dependencies, so failures are handled explicitly (`backend/services/ai/geminiClient.js` and the orchestrator):

| Gemini response | Behavior |
|---|---|
| `429 RESOURCE_EXHAUSTED` | **Not retried.** Clerk returns a specific "usage limit reached, try again later" message. |
| `408`, `500`, `502`, `503`, `504` | Retried with bounded backoff: up to 4 attempts in total (1 initial + 3 retries), 1–8 s backoff, 15 s timeout per attempt. |
| Other errors (auth, bad request, missing configuration) | Not retried; Clerk returns a generic "assistant isn't available right now" message. |

- User-facing messages are fixed sentences. Gemini error payloads, quota identifiers and stack traces are never sent to the client; details are logged server-side only.
- If `GEMINI_API_KEY` is not set, Clerk returns the generic unavailable message instead of failing the request.
- The API key is used only by the backend.

## PDF Reports

Five report types are supported, requested through Clerk:

- **Bills**
- **Payments**
- **Sales**
- **Top Products**
- **Outstanding Customers**

Reports are rendered with PDFKit, reusing the same shop header and formatting as invoice PDFs. Report tables are capped at 50 rows (with a note when results are truncated), filenames are generated by the backend from a fixed pattern, and no filesystem path is ever exposed. Clients download a report with `GET /api/ai/reports/:reportId`, which requires authentication and returns the PDF as an attachment.

**Current architectural limitation:** generated report PDFs are held temporarily in an in-memory store inside the backend process (15-minute lifetime, at most 200 reports). That is suitable for the current single-process deployment, but reliable operation across multiple backend instances — or across restarts — would need shared or object storage.

## Tech Stack

**Backend**
- Node.js (ES modules), Express 5
- MongoDB with Mongoose 9
- JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cookie-parser`
- `express-validator`, `express-rate-limit`, Helmet, CORS, Morgan
- Gemini API via `@google/genai`
- PDFKit for PDF generation
- Multer and the AWS S3 SDK (S3-compatible object storage) for manual bill photos

**Frontend**
- React 19 with Vite
- React Router 7
- TanStack React Query
- Tailwind CSS 4
- `vite-plugin-pwa`
- oxlint

**Testing:** Jest, Supertest, MongoDB Memory Server (backend)

## Project Structure

```text
billing-system/
├── backend/
│   ├── app.js, server.js
│   ├── config/            # Database and shop configuration
│   ├── controllers/       # Request handlers (including ai.controller.js)
│   ├── middleware/        # Authentication and validation
│   ├── models/            # Mongoose models
│   ├── routes/            # Express routes (including ai.routes.js)
│   ├── services/
│   │   ├── ai/            # Clerk: orchestrator, Gemini client, knowledge, reports
│   │   │   └── tools/     # Allowlisted tools and argument validators
│   │   └── ...            # Billing, dashboard, PDF and storage services
│   ├── knowledge/         # Markdown files used by retrieval
│   ├── utils/
│   └── __tests__/         # Jest tests (AI tests in __tests__/ai/)
└── frontend/
    └── src/
        ├── api/           # API client functions
        ├── components/
        ├── context/
        ├── hooks/
        ├── layouts/
        ├── pages/         # Including the Clerk page
        ├── routes/
        └── utils/
```

## API / AI Endpoint

### `POST /api/ai/chat`

Sends a natural-language message to Clerk. **Authentication is required** (session cookie). The backend derives the shop context from the authenticated user; the request only contains the message.

```json
{ "message": "show me the pending bills" }
```

Normal response:

```json
{ "reply": "..." }
```

When the request results in a generated PDF report, the response also carries a small reference:

```json
{ "reply": "...", "report": { "reportId": "<uuid>", "filename": "billing-report-<period>.pdf" } }
```

Errors: `400` for an invalid message (missing, non-string, empty, or over 500 characters), `401` when not authenticated, `429` from the request rate limiter. A Gemini failure is not an HTTP error — Clerk answers with one of the safe messages described above.

### `GET /api/ai/reports/:reportId`

Downloads a previously generated report as `application/pdf`. Requires authentication; `reportId` must be a UUID; a report is only available to the shop that generated it. An unknown, expired or other-shop report returns `404`.

## Testing

Backend tests use Jest, Supertest and an in-memory MongoDB. Gemini is never called for real in tests — the AI tests either mock the client or run the real client against a local mock server.

```bash
cd backend
npm test
```

Current status:

- AI and PDF/report suites: **81 / 81 passing**
- Full backend suite: **271 / 272 passing**
- One known failure remains, in `__tests__/auth.test.js` (production cookie topology): the test expects `SameSite=Strict`, while the implementation sets `SameSite=None; Secure` in production, which a cross-origin frontend/API deployment requires. This mismatch has not been reconciled yet.

The frontend has no automated test suite; it is checked with `npm run lint` and `npm run build`.

## Environment Variables

Names only — never commit real values. `backend/.env` is local-only and must not be committed (it is git-ignored); create your own from the templates in `backend/.env.example` and `frontend/.env.example`.

**Backend (`backend/.env`)**

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV` | Server port and environment |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session token signing and lifetime |
| `COOKIE_NAME` | Name of the HTTP-only auth cookie |
| `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS |
| `GEMINI_API_KEY` | Gemini API key for Clerk (backend only) |
| `SEED_OWNER_USERNAME`, `SEED_OWNER_PASSWORD`, `SEED_SHOP_NAME` | Used by `npm run seed` to create the first owner and their shop; all three are required |
| `SHOP_ADDRESS`, `SHOP_PHONE`, `SHOP_EMAIL`, `INVOICE_TERMS` | Optional shop details, applied only when the seed (or migration) script creates a new shop |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | S3-compatible object storage for manual bill photos (required in production; in development without `R2_ENDPOINT`, an in-memory store is used) |
| `MIGRATE_TO_USERNAME`, `MIGRATE_TO_SHOP_NAME` | Used only by the one-off `npm run migrate:shops` script |

**Frontend (`frontend/.env`)**

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

## Local Development

Prerequisites: Node.js 20.19 or newer (required by Mongoose 9), npm, and a running MongoDB instance.

```bash
git clone https://github.com/Akashathani03/billing-system.git
cd billing-system
```

Backend:

```bash
cd backend
cp .env.example .env     # then edit .env with your own values
npm install
npm run seed             # creates the first owner and shop from the SEED_* variables
npm run dev
```

Frontend (in a second terminal):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The backend health check is `GET /api/health`. Other scripts: `npm start` (backend), `npm run build`, `npm run lint` and `npm run preview` (frontend).

Clerk needs a valid `GEMINI_API_KEY`. Without one, the rest of the application works and Clerk replies that it is unavailable.

## Future Improvements

These are ideas, not implemented features:

- Shared or object storage for generated reports, so downloads work across multiple backend instances and restarts
- Stronger observability: structured logs and metrics for AI requests, tool calls and errors
- Embedding-based retrieval if the knowledge base grows beyond what lexical matching handles well
- AI evaluation datasets to measure answer quality and tool selection
- Scalable LLM quota and rate management
- Removing customer mobile numbers from the outstanding-customers tool result
- Per-shop currency and timezone settings
- Automated frontend tests, and reconciling the known cookie-policy test

## Screenshots

Screenshots can be added here.

## Author

Built by [Akashathani03](https://github.com/Akashathani03).
