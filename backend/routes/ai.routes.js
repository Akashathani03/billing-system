import { Router } from 'express';
import { body, param } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { chat, downloadReport } from '../controllers/ai.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// Each request here calls a paid, rate-limited external LLM API, so this
// gets its own tighter cap beyond auth alone — same express-rate-limit
// already used for login (routes/auth.routes.js), not a new dependency.
// Skipped in tests for the same reason the login limiter is.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many requests. Please slow down and try again shortly.', code: 'RATE_LIMITED' } },
});

router.post(
  '/chat',
  chatLimiter,
  [
    body('message')
      .isString()
      .withMessage('message must be text')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('message is required')
      .isLength({ max: 500 })
      .withMessage('message must be 500 characters or fewer'),
  ],
  handleValidation,
  chat,
);

// reportId is a crypto.randomUUID() from report.service.js's in-memory
// store, never a filesystem path — isUUID() rejects anything else before
// it even reaches the controller, and downloadReport() then re-checks the
// report belongs to req.user.shopId before returning any bytes.
router.get('/reports/:reportId', param('reportId').isUUID(), handleValidation, downloadReport);

export default router;
