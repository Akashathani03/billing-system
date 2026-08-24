import { validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: errors.array()[0].msg,
        code: 'VALIDATION_ERROR',
      },
    });
  }
  next();
}
