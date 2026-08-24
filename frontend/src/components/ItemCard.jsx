export function ItemCard({ item, onQuantityChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900">{item.name}</p>
        <p className="text-sm text-neutral-500">
          ₹{item.price.toFixed(2)}
          {item.unit ? ` / ${item.unit}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onQuantityChange(Math.max(1, item.quantity - 1))}
          disabled={item.quantity <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-lg text-neutral-700 disabled:opacity-40"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span className="w-8 text-center font-medium text-neutral-900">{item.quantity}</span>
        <button
          type="button"
          onClick={() => onQuantityChange(item.quantity + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-lg text-neutral-700"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <p className="w-20 shrink-0 text-right font-semibold text-neutral-900">
        ₹{(item.price * item.quantity).toFixed(2)}
      </p>

      <button type="button" onClick={onRemove} aria-label="Remove item" className="shrink-0 text-red-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
