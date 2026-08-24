import { Router } from 'express';
import { body, param } from 'express-validator';
import { list, create, getOne, update } from '../controllers/product.controller.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', list);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    body('unit').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  ],
  handleValidation,
  create,
);

router.get('/:id', param('id').isMongoId(), handleValidation, getOne);

router.patch(
  '/:id',
  param('id').isMongoId(),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 100 }),
    body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
    body('unit').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
    body('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
  ],
  handleValidation,
  update,
);

export default router;
