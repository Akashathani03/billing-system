import { Router } from 'express';
import { query } from 'express-validator';
import { summary, monthlySales, salesYears } from '../controllers/dashboard.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', summary);

router.get(
  '/monthly-sales',
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('year must be a valid 4-digit year'),
  handleValidation,
  monthlySales,
);

router.get('/sales-years', salesYears);

export default router;
