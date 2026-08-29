import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDraftsQuery, useDeleteDraftMutation } from '../hooks/useInvoices';
import { formatRelativeTime } from '../utils/relativeTime';
import { PageHeader } from '../components/PageHeader';

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
      <PageHeader title="Drafts" />

      <div className="mt-4 space-y-4">
        {isLoading && (
          <p className="py-8 text-center text-sm text-neutral-500">
            Loading…
          </p>
        )}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>Couldn't load drafts — {error.message}</p>

            <button
              onClick={() => refetch()}
              className="mt-2 font-medium underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.invoices.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-300 py-8 text-center">
            <p className="text-sm font-medium text-neutral-700">
              No saved drafts yet.
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              Create a bill and save it as a draft to continue later.
            </p>
          </div>
        )}

        {data?.invoices.map((invoice) => (
          <div
            key={invoice._id}
            className="relative rounded-lg border border-neutral-200 bg-white p-4"
          >
            <Link
              to={`/new-bill/${invoice._id}`}
              className="block pr-12"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium text-neutral-900">
                  {invoice.customer.name}
                </p>

                <p className="shrink-0 font-semibold text-neutral-900">
                  ₹{invoice.total.toFixed(2)}
                </p>
              </div>

              <p className="mt-1 text-sm text-neutral-500">
                Saved {formatRelativeTime(invoice.updatedAt)}
              </p>
            </Link>

            <button
              onClick={() => handleDelete(invoice._id)}
              disabled={deletingId === invoice._id}
              aria-label="Delete draft"
              className="absolute right-4 top-4 rounded-full p-2 text-red-500 disabled:opacity-40"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-6 w-6"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}