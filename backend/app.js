import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import manualBillPhotoRoutes from './routes/manualBillPhoto.routes.js';

const app = express();

// Production hosting (Render, Railway, etc.) puts this app behind exactly
// one reverse-proxy hop, which sets X-Forwarded-For. Without telling
// Express to trust it, req.ip resolves to the proxy's address for every
// request — express-rate-limit (used on login) detects that mismatch and
// throws rather than risk an attacker spoofing X-Forwarded-For to bypass
// the limiter. This has no effect on cookie security: the Secure flag is
// driven directly by NODE_ENV elsewhere, not by Express's proxy-derived
// req.secure.
app.set('trust proxy', 1);

// This is a JSON-only API — it never renders HTML, so helmet's default
// Content-Security-Policy (meant for HTML pages with scripts/styles) is
// inert here and just adds noise; disabled for clarity rather than left on
// unused. crossOriginResourcePolicy is set to 'cross-origin' because the
// frontend and backend are deployed on different domains.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// CLIENT_ORIGIN may be a comma-separated list — e.g. the local dev origin
// plus a LAN address for testing on another device on the same network.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (e.g. curl, server-to-server) — nothing to check against.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/manual-bills', manualBillPhotoRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Not found',
      code: 'NOT_FOUND',
    },
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    error: {
      message: err.expose ? err.message : 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    },
  });
});

export default app;