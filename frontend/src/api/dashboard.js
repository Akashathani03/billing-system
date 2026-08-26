import { apiFetch } from './client';

export function fetchDashboardSummary() {
  return apiFetch('/dashboard/summary');
}

export function fetchMonthlySalesForYear(year) {
  return apiFetch(`/dashboard/monthly-sales?year=${year}`);
}

export function fetchSalesYears() {
  return apiFetch('/dashboard/sales-years');
}
