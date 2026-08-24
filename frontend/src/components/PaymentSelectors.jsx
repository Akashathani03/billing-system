const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit' },
];

const STATUSES = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
];

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md border py-2.5 text-sm font-medium ${
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

export function PaymentMethodSelect({ value, onChange }) {
  return <SegmentedControl options={METHODS} value={value} onChange={onChange} />;
}

export function PaymentStatusSelect({ value, onChange }) {
  return <SegmentedControl options={STATUSES} value={value} onChange={onChange} />;
}
