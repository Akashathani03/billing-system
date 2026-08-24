import { apiFetch } from './client';

export function fetchCustomers({ search, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  return apiFetch(`/customers?${params.toString()}`);
}

export function fetchCustomer(id) {
  return apiFetch(`/customers/${id}`);
}

export function createCustomer(data) {
  return apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) });
}

export function updateCustomer(id, data) {
  return apiFetch(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
