import { Link } from 'react-router-dom';
import { useDraftsQuery } from '../hooks/useInvoices';

export function DraftsPage() {
  const { data, isLoading, isError, error, refetch } = useDraftsQuery();

  return (
    <div className="px-4 pt-6 pb-4">
      <Link to="/more" className="text-sm text-blue-700">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Drafts</h1>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>Couldn't load drafts — {error.message}</p>
            <button onClick={() => refetch()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.invoices.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">No drafts saved.</p>
        )}

        {data?.invoices.map((invoice) => (
          <Link
            key={invoice._id}
            to={`/new-bill/${invoice._id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-4 active:bg-neutral-50"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-neutral-900">{invoice.customer.name}</p>
              <p className="font-semibold text-neutral-900">₹{invoice.total.toFixed(2)}</p>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
