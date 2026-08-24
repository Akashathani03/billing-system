import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
};

export function InvoiceCard({ invoice, onMarkPaid, markingPaid }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <Link to={`/invoices/${invoice._id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{invoice.invoiceNumber}</p>
            <p className="truncate text-sm text-neutral-500">{invoice.customer.name}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold text-neutral-900">₹{invoice.total.toFixed(2)}</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-medium uppercase text-neutral-500">{invoice.paymentMethod}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[invoice.paymentStatus]}`}
          >
            {invoice.paymentStatus}
          </span>
        </div>
      </Link>

      {invoice.paymentStatus === 'pending' && onMarkPaid && (
        <button
          onClick={() => onMarkPaid(invoice._id)}
          disabled={markingPaid}
          className="mt-3 w-full rounded-md border border-green-200 bg-green-50 py-2 text-sm font-semibold text-green-700 disabled:opacity-60"
        >
          {markingPaid ? 'Marking as Paid…' : 'Mark as Paid'}
        </button>
      )}
    </div>
  );
}
