import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDraftsQuery, useDeleteDraftMutation } from '../hooks/useInvoices';
import { formatRelativeTime } from '../utils/relativeTime';

export function DraftsPage() {
  const { data, isLoading, isError, error, refetch } = useDraftsQuery();
  const deleteDraft = useDeleteDraftMutation();
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(id) {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteDraft.mutateAsync(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <Link to="/more" className="text-sm text-blue-700">
        ← Back
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-neutral-900">Drafts</h1>

      <Link
        to="/new-bill"
        className="mt-4 block w-full rounded-md bg-blue-700 py-3 text-center text-sm font-semibold text-white"
      >
        + New Bill
      </Link>

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
          <div className="rounded-lg border border-dashed border-neutral-300 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">No saved drafts yet.</p>
            <p className="mt-1 text-sm text-neutral-500">
              Create a bill and save it as a draft to continue later.
            </p>
          </div>
        )}

        {data?.invoices.map((invoice) => (
          <div
            key={invoice._id}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <Link to={`/new-bill/${invoice._id}`} className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium text-neutral-900">{invoice.customer.name}</p>
                <p className="shrink-0 font-semibold text-neutral-900">₹{invoice.total.toFixed(2)}</p>
              </div>
              <p className="mt-1 text-sm text-neutral-500">Saved {formatRelativeTime(invoice.updatedAt)}</p>
              <span className="mt-2 inline-block text-sm font-semibold text-blue-700">Continue →</span>
            </Link>

            <button
              onClick={() => handleDelete(invoice._id)}
              disabled={deletingId === invoice._id}
              aria-label="Delete draft"
              className="shrink-0 rounded-full p-2 text-red-500 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
