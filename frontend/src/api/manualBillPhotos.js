import { apiFetch, API_BASE_URL } from './client';

export function fetchManualBillPhotos(customerId) {
  return apiFetch(`/manual-bills?customerId=${customerId}`);
}

export function uploadManualBillPhoto(customerId, file) {
  const form = new FormData();
  form.append('customerId', customerId);
  form.append('photo', file);
  return apiFetch('/manual-bills', { method: 'POST', body: form });
}

export function deleteManualBillPhoto(id) {
  return apiFetch(`/manual-bills/${id}`, { method: 'DELETE' });
}

export function manualBillPhotoImageUrl(id) {
  return `${API_BASE_URL}/manual-bills/${id}/image`;
}
