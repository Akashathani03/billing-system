import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
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
