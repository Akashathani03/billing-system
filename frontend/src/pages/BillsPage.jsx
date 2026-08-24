import { useMemo, useState } from 'react';
import { useBillingHistoryQuery, useMarkPaidMutation } from '../hooks/useInvoices';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { groupByDate } from '../utils/dateGroups';
import { SearchInput } from '../components/SearchInput';
import { BillingFilterSheet } from '../components/BillingFilterSheet';
import { InvoiceCard } from '../components/InvoiceCard';

const EMPTY_FILTERS = { paymentMethod: '', paymentStatus: '', dateFrom: '', dateTo: '' };

export function BillsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [debouncedSearch, filters],
  );

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBillingHistoryQuery(queryFilters);
  const markPaid = useMarkPaidMutation();

  const invoices = data?.pages.flatMap((page) => page.invoices) || [];
  const groups = groupByDate(invoices);

  async function handleMarkPaid(id) {
    setMarkingId(id);
    try {
      await markPaid.mutateAsync(id);
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="text-xl font-semibold text-neutral-900">Bills</h1>

      <div className="mt-4 flex gap-2">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice #, name, mobile" />
        </div>
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="relative flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-700"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-700 text-xs text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {isLoading && <p className="py-8 text-center text-sm text-neutral-500">Loading bills…</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>Unable to load bills. {error.message}</p>
            <button onClick={() => refetch()} className="mt-2 font-medium underline">
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && invoices.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">No bills found.</p>
        )}

        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.label}</h2>
            <div className="space-y-2">
              {group.invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice._id}
                  invoice={invoice}
                  onMarkPaid={handleMarkPaid}
                  markingPaid={markingId === invoice._id}
                />
              ))}
            </div>
          </div>
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700 disabled:opacity-60"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        )}
      </div>

      <BillingFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />
    </div>
  );
}
