import crypto from 'crypto';
import multer from 'multer';
import mongoose from 'mongoose';
import ManualBillPhoto from '../models/ManualBillPhoto.js';
import Customer from '../models/Customer.js';
import * as objectStorage from './objectStorage.service.js';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// SVG is deliberately excluded even though browsers treat it as an image —
// it can embed scripts and would be an XSS vector if ever rendered inline.
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export class ManualBillPhotoError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.expose = true;
  }
}

function fileFilter(req, file, cb) {
  if (!EXT_BY_MIME[file.mimetype]) {
    return cb(new ManualBillPhotoError('Only JPEG, PNG, WEBP, or HEIC photos are allowed', 'INVALID_FILE_TYPE', 400));
  }
  cb(null, true);
}

// Buffered in memory, not written to a local disk — the backend's
// filesystem is not assumed to be persistent in production. The buffer is
// uploaded straight to object storage in attachPhotoToCustomer below.
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('photo');

/**
 * Persists an in-memory upload against a customer. Customer validation
 * happens BEFORE anything is written to storage, so an invalid/missing
 * customer never creates an object to clean up in the first place. The one
 * remaining failure window — object storage succeeds but the DB write then
 * fails — is handled by deleting the just-uploaded object, so a failed
 * request never leaves an orphaned object behind.
 */
export async function attachPhotoToCustomer({ customerId, file, createdBy, shopId }) {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new ManualBillPhotoError('A valid customerId is required', 'INVALID_CUSTOMER', 400);
  }
  // Scoped to shopId — a customerId belonging to another shop resolves to
  // nothing, the same as a nonexistent customerId, so a photo can never be
  // attached to a customer outside the uploader's own shop.
  const customer = await Customer.findOne({ _id: customerId, shopId });
  if (!customer) {
    throw new ManualBillPhotoError('Customer not found', 'CUSTOMER_NOT_FOUND', 404);
  }

  const storageKey = `manual-bills/${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype]}`;
  await objectStorage.uploadObject(storageKey, file.buffer, file.mimetype);

  try {
    return await ManualBillPhoto.create({
      shopId,
      customerId: customer._id,
      storageKey,
      mimeType: file.mimetype,
      size: file.size,
      createdBy,
    });
  } catch (err) {
    await objectStorage.deleteObject(storageKey).catch(() => {});
    throw err;
  }
}

export function listPhotosForCustomer(customerId, shopId) {
  return ManualBillPhoto.find({ customerId, shopId }).sort({ createdAt: -1 });
}

export function getPhotoById(id, shopId) {
  return ManualBillPhoto.findOne({ _id: id, shopId });
}

/** Fetches the actual image bytes for an already-looked-up photo record. */
export function getPhotoObject(photo) {
  return objectStorage.getObject(photo.storageKey);
}

/**
 * Deletes the DB record first — it's the source of truth for whether the
 * photo "exists" through the API — then best-effort removes the object in
 * storage. The reverse order would risk a record pointing at an object
 * that's already gone; this way a failed delete just leaves a harmless
 * orphan in the bucket instead of a broken reference in the app.
 */
export async function deletePhoto(id, shopId) {
  const photo = await ManualBillPhoto.findOneAndDelete({ _id: id, shopId });
  if (!photo) return null;
  await objectStorage.deleteObject(photo.storageKey).catch(() => {});
  return photo;
}
