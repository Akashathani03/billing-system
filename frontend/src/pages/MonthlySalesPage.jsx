import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useMonthlySalesForYearQuery, useSalesYearsQuery } from '../hooks/useDashboard';

function formatINR(amount) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MonthlySalesPage() {
  const yearsQuery = useSalesYearsQuery();

  const [selectedYear, setSelectedYear] = useState(null);
  const years = yearsQuery.data || [];
  // Years are sorted newest-first by the backend, so [0] is the current
  // business year — used as the default only until the user picks one.
  const effectiveYear = selectedYear ?? years[0];
  const monthsQuery = useMonthlySalesForYearQuery(effectiveYear);

  const yearTotalSales = monthsQuery.data?.reduce((sum, m) => sum + m.sales, 0) ?? 0;
  const yearTotalBills = monthsQuery.data?.reduce((sum, m) => sum + m.bills, 0) ?? 0;

  return (
    <div className="px-4 pt-6 pb-6">
      <PageHeader title="Monthly Sales" />

      {yearsQuery.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>Unable to load sales years — {yearsQuery.error.message}</p>
          <button onClick={() => yearsQuery.refetch()} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="sales-year" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Sales Year
        </label>
        <select
          id="sales-year"
          value={effectiveYear ?? ''}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          disabled={years.length === 0}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base font-semibold text-neutral-900 disabled:opacity-60"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {effectiveYear ? `${effectiveYear} Total` : 'Total'}
        </p>
        {yearsQuery.isLoading || monthsQuery.isLoading ? (
          <p className="mt-2 text-sm text-neutral-500">Loading…</p>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{formatINR(yearTotalSales)}</p>
            <p className="mt-0.5 text-sm text-neutral-500">
              {yearTotalBills} bill{yearTotalBills === 1 ? '' : 's'}
            </p>
          </>
        )}
      </div>

      {monthsQuery.isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>Unable to load {effectiveYear}'s sales — {monthsQuery.error.message}</p>
          <button onClick={() => monthsQuery.refetch()} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {monthsQuery.data && (
        <div className="mt-4 space-y-2">
          {monthsQuery.data.map((month) => (
            <div key={month.month} className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="font-medium text-neutral-900">{month.label}</p>
              <p className="mt-1 text-xl font-bold text-neutral-900">{formatINR(month.sales)}</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {month.bills} bill{month.bills === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
