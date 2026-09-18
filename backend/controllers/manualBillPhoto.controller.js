import * as manualBillPhotoService from '../services/manualBillPhoto.service.js';

function toPublicPhoto(photo) {
  return { _id: photo._id, customerId: photo.customerId, createdAt: photo.createdAt };
}

export async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'A photo file is required', code: 'FILE_REQUIRED' } });
  }

  try {
    const photo = await manualBillPhotoService.attachPhotoToCustomer({
      customerId: req.body.customerId,
      file: req.file,
      createdBy: req.user.id,
      shopId: req.user.shopId,
    });
    res.status(201).json({ photo: toPublicPhoto(photo) });
  } catch (err) {
    if (err instanceof manualBillPhotoService.ManualBillPhotoError) {
      return res.status(err.status).json({ error: { message: err.message, code: err.code } });
    }
    throw err;
  }
}

export async function list(req, res) {
  const photos = await manualBillPhotoService.listPhotosForCustomer(req.query.customerId, req.user.shopId);
  res.json({ photos: photos.map(toPublicPhoto) });
}

// Fetches the image from object storage and streams the bytes through this
// authenticated endpoint — the bucket itself is never made public, and the
// frontend's <img> URL (/api/manual-bills/:id/image) doesn't change.
export async function getImage(req, res) {
  const photo = await manualBillPhotoService.getPhotoById(req.params.id, req.user.shopId);
  if (!photo) {
    return res.status(404).json({ error: { message: 'Photo not found', code: 'NOT_FOUND' } });
  }

  try {
    const { buffer, contentType } = await manualBillPhotoService.getPhotoObject(photo);
    res.setHeader('Content-Type', contentType || photo.mimeType);
    res.send(buffer);
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return res.status(404).json({ error: { message: 'Photo file not found', code: 'FILE_MISSING' } });
    }
    throw err;
  }
}

export async function remove(req, res) {
  const photo = await manualBillPhotoService.deletePhoto(req.params.id, req.user.shopId);
  if (!photo) {
    return res.status(404).json({ error: { message: 'Photo not found', code: 'NOT_FOUND' } });
  }
  res.status(204).send();
}
