import { apiFetch } from './client';

export function fetchInvoices({ status, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  return apiFetch(`/invoices?${params.toString()}`);
}

export function fetchInvoice(id) {
  return apiFetch(`/invoices/${id}`);
}

export function createInvoice(data) {
  return apiFetch('/invoices', { method: 'POST', body: JSON.stringify(data) });
}

export function updateInvoice(id, data) {
  return apiFetch(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function finalizeInvoice(id) {
  return apiFetch(`/invoices/${id}/finalize`, { method: 'POST' });
}
