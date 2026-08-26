import { useQuery } from '@tanstack/react-query';
import { fetchDashboardSummary, fetchMonthlySalesForYear, fetchSalesYears } from '../api/dashboard';

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary,
  });
}

export function useSalesYearsQuery() {
  return useQuery({
    queryKey: ['dashboard', 'sales-years'],
    queryFn: fetchSalesYears,
  });
}

/** React Query caches each year's data separately (it's part of the key), so switching years re-fetches only what isn't already cached. */
export function useMonthlySalesForYearQuery(year) {
  return useQuery({
    queryKey: ['dashboard', 'monthly-sales', { year }],
    queryFn: () => fetchMonthlySalesForYear(year),
    enabled: Boolean(year),
  });
}
