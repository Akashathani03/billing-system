import { useState } from 'react';

export function ProductForm({ initialValues, submitting, onSubmit, submitLabel = 'Save' }) {
  const [name, setName] = useState(initialValues?.name || '');
  const [price, setPrice] = useState(initialValues?.price ?? '');
  const [unit, setUnit] = useState(initialValues?.unit || '');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ name, price: Number(price), unit });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block text-sm font-medium text-neutral-700" htmlFor="product-name">
        Product Name
      </label>
      <input
        id="product-name"
        type="text"
        className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="product-price">
            Price (₹)
          </label>
          <input
            id="product-price"
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700" htmlFor="product-unit">
            Unit (optional)
          </label>
          <input
            id="product-unit"
            type="text"
            placeholder="pcs, mtr…"
            className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 w-full rounded-md bg-blue-700 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
