import { apiFetch } from './client';

export function fetchInvoices({
  status,
  page = 1,
  limit = 20,
  search,
  dateFrom,
  dateTo,
  paymentMethod,
  paymentStatus,
} = {}) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (paymentMethod) params.set('paymentMethod', paymentMethod);
  if (paymentStatus) params.set('paymentStatus', paymentStatus);
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

export function markInvoicePaid(id) {
  return apiFetch(`/invoices/${id}/payment-status`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus: 'paid' }),
  });
}

export function fetchCustomerInvoices(customerId, { page = 1, limit = 5 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return apiFetch(`/customers/${customerId}/invoices?${params.toString()}`);
}
