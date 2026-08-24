import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { create, list, getOne, update, finalize } from '../controllers/invoice.controller.js';
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

router.get('/', query('status').optional().isIn(['draft', 'finalized', 'cancelled']), handleValidation, list);

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

export default router;
