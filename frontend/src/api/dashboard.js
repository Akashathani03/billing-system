import { apiFetch } from './client';

export function fetchDashboardSummary() {
  return apiFetch('/dashboard/summary');
}
