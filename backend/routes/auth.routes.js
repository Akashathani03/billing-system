import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { login, logout, me } from '../controllers/auth.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' } },
});

router.post(
  '/login',
  loginLimiter,
  [
    body('username').trim().toLowerCase().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidation,
  login,
);

router.post('/logout', logout);

router.get('/me', requireAuth, me);

export default router;
