import { apiFetch } from './client';

export function fetchProducts({ search, page = 1, limit = 20, includeInactive = false } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (search) params.set('search', search);
  if (includeInactive) params.set('includeInactive', 'true');
  return apiFetch(`/products?${params.toString()}`);
}

export function createProduct(data) {
  return apiFetch('/products', { method: 'POST', body: JSON.stringify(data) });
}

export function updateProduct(id, data) {
  return apiFetch(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
