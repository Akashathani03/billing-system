import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { create, list, getOne, update, finalize, updatePaymentStatus } from '../controllers/invoice.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

const PAYMENT_METHODS = ['cash', 'upi', 'card', 'credit'];
const PAYMENT_STATUSES = ['paid', 'pending'];

const itemValidators = [
  body('items').optional().isArray().withMessage('items must be an array'),
  body('items.*.productId').isMongoId().withMessage('Each item must reference a valid product'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
];

router.get(
  '/',
  [
    query('status').optional().isIn(['draft', 'finalized', 'cancelled']),
    query('paymentMethod').optional().isIn(PAYMENT_METHODS),
    query('paymentStatus').optional().isIn(PAYMENT_STATUSES),
    query('dateFrom').optional().isISO8601().withMessage('dateFrom must be a valid date'),
    query('dateTo').optional().isISO8601().withMessage('dateTo must be a valid date'),
  ],
  handleValidation,
  list,
);

router.post(
  '/',
  [
    body('customerId').isMongoId().withMessage('A valid customer is required'),
    ...itemValidators,
    body('paymentMethod').optional().isIn(PAYMENT_METHODS),
    body('paymentStatus').optional().isIn(PAYMENT_STATUSES),
  ],
  handleValidation,
  create,
);

router.get('/:id', param('id').isMongoId(), handleValidation, getOne);

router.patch(
  '/:id',
  param('id').isMongoId(),
  [
    body('customerId').optional().isMongoId(),
    ...itemValidators,
    body('paymentMethod').optional().isIn(PAYMENT_METHODS),
    body('paymentStatus').optional().isIn(PAYMENT_STATUSES),
  ],
  handleValidation,
  update,
);

router.post('/:id/finalize', param('id').isMongoId(), handleValidation, finalize);

router.patch(
  '/:id/payment-status',
  param('id').isMongoId(),
  body('paymentStatus').isIn(PAYMENT_STATUSES).withMessage('paymentStatus must be "paid" or "pending"'),
  handleValidation,
  updatePaymentStatus,
);

export default router;
