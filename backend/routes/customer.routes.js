import { Router } from 'express';
import { body, param } from 'express-validator';
import { list, create, getOne, update } from '../controllers/customer.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

const customerBody = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('mobile')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^[0-9+\-\s()]{7,15}$/)
    .withMessage('Enter a valid mobile number'),
  body('address').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
];

router.get('/', list);
router.post('/', customerBody, handleValidation, create);
router.get('/:id', param('id').isMongoId(), handleValidation, getOne);
router.patch(
  '/:id',
  param('id').isMongoId(),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
    body('mobile')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Mobile number cannot be empty')
      .matches(/^[0-9+\-\s()]{7,15}$/)
      .withMessage('Enter a valid mobile number'),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 200 }),
  ],
  handleValidation,
  update,
);

export default router;
