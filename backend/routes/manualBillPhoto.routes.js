import { Router } from 'express';
import { param, query } from 'express-validator';
import multer from 'multer';
import { upload, list, getImage, remove } from '../controllers/manualBillPhoto.controller.js';
import { uploadMiddleware } from '../services/manualBillPhoto.service.js';
import { handleValidation } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

// Wraps multer so its errors (bad type, too large) become the same JSON
// error shape as everywhere else, instead of falling through to the
// generic 500 handler.
function handleUpload(req, res, next) {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: { message: 'Photo is too large (max 10MB)', code: 'FILE_TOO_LARGE' },
        });
      }
      return res.status(400).json({ error: { message: 'Upload failed', code: 'UPLOAD_ERROR' } });
    }
    if (err) {
      return res.status(err.status || 400).json({
        error: { message: err.message, code: err.code || 'INVALID_FILE_TYPE' },
      });
    }
    next();
  });
}

router.get('/', query('customerId').isMongoId(), handleValidation, list);
router.post('/', handleUpload, upload);
router.get('/:id/image', param('id').isMongoId(), handleValidation, getImage);
router.delete('/:id', param('id').isMongoId(), handleValidation, remove);

export default router;
