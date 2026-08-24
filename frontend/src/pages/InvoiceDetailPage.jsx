import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInvoiceQuery, useMarkPaidMutation } from '../hooks/useInvoices';
import { InvoiceActions } from '../components/InvoiceActions';

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
};

export function InvoiceDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useInvoiceQuery(id);
  const markPaid = useMarkPaidMutation();
  const [feedback, setFeedback] = useState('');

  async function handleMarkPaid() {
    setFeedback('');
    try {
      await markPaid.mutateAsync(id);
      setFeedback('success');
    } catch (err) {
      setFeedback(err.message);
    }
  }

  if (isLoading) {
    return <p className="px-4 py-8 text-center text-sm text-neutral-500">Loading…</p>;
  }

  if (isError) {
    return (
      <div className="px-4 pt-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>Couldn't load this invoice — {error.message}</p>
          <button onClick={() => refetch()} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { invoice } = data;

  return (
    <div className="px-4 pt-6 pb-8">
      <Link to="/bills" className="text-sm text-blue-700">
        ← Back to Bills
      </Link>

      {invoice.status === 'cancelled' && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-red-700">
          Cancelled
        </div>
      )}

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{invoice.invoiceNumber}</p>
            <p className="text-sm text-neutral-500">
              {new Date(invoice.finalizedAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[invoice.paymentStatus]}`}
          >
            {invoice.paymentStatus}
          </span>
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="text-sm text-neutral-500">Customer</p>
          <p className="font-medium text-neutral-900">{invoice.customer.name}</p>
          <p className="text-sm text-neutral-600">{invoice.customer.mobile}</p>
          {invoice.customer.address && <p className="text-sm text-neutral-500">{invoice.customer.address}</p>}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Items</h2>
        <div className="mt-2 divide-y divide-neutral-100">
          {invoice.items.map((item) => (
            <div key={item._id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-neutral-900">{item.name}</p>
                <p className="text-sm text-neutral-500">
                  ₹{item.price.toFixed(2)} × {item.quantity}
                  {item.unit ? ` ${item.unit}` : ''}
                </p>
              </div>
              <p className="font-semibold text-neutral-900">₹{item.lineTotal.toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-neutral-200 pt-3">
          <div className="flex justify-between text-sm text-neutral-600">
            <span>Subtotal</span>
            <span>₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm text-neutral-600">
            <span>GST {(invoice.taxRate * 100).toFixed(0)}%</span>
            <span>₹{invoice.taxAmount.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
            <span>Total</span>
            <span>₹{invoice.total.toFixed(2)}</span>
          </div>
        </div>

        <p className="mt-3 rounded-md bg-neutral-50 p-3 text-sm text-neutral-600">{invoice.amountInWords}</p>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">Payment Method</span>
          <span className="font-medium uppercase text-neutral-900">{invoice.paymentMethod}</span>
        </div>

        {invoice.paymentStatus === 'pending' && (
          <>
            {feedback === 'success' ? (
              <p className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                Marked as paid.
              </p>
            ) : (
              <>
                {feedback && feedback !== 'success' && (
                  <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {feedback}
                  </p>
                )}
                <button
                  onClick={handleMarkPaid}
                  disabled={markPaid.isPending}
                  className="mt-3 w-full rounded-md bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {markPaid.isPending ? 'Marking as Paid…' : 'Mark as Paid'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {invoice.status !== 'draft' && <InvoiceActions invoice={invoice} />}
    </div>
  );
}
