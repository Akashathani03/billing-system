import { BottomSheet } from './BottomSheet';

const METHODS = [
  { value: '', label: 'All' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
];

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
            value === option.value
              ? 'border-blue-700 bg-blue-700 text-white'
              : 'border-neutral-300 bg-white text-neutral-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Payment status is deliberately not a filter here — the Bills page's
// Paid/Pending toggle is the single, primary control for it, so having a
// second independent "Payment Status" chip in this sheet as well would be
// a duplicate control that could disagree with the toggle.
export function BillingFilterSheet({ open, onClose, filters, onChange, onClear }) {
  return (
    <BottomSheet open={open} title="Filters" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-700">Payment Method</h3>
          <div className="mt-2">
            <ChipGroup
              options={METHODS}
              value={filters.paymentMethod || ''}
              onChange={(v) => onChange({ ...filters, paymentMethod: v })}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-700">Date Range</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="filter-date-from">
                From
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="filter-date-to">
                To
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClear}
            className="flex-1 rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700"
          >
            Clear
          </button>
          <button onClick={onClose} className="flex-1 rounded-md bg-blue-700 py-2.5 text-sm font-semibold text-white">
            Apply
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
