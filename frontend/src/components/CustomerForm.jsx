import { useState } from 'react';

export function CustomerForm({ initialValues, submitting, onSubmit, submitLabel = 'Save' }) {
  const [name, setName] = useState(initialValues?.name || '');
  const [mobile, setMobile] = useState(initialValues?.mobile || '');
  const [address, setAddress] = useState(initialValues?.address || '');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ name, mobile, address });
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

      <label className="block text-sm font-medium text-neutral-700" htmlFor="customer-name">
        Customer Name
      </label>
      <input
        id="customer-name"
        type="text"
        className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <label className="block text-sm font-medium text-neutral-700" htmlFor="customer-mobile">
        Mobile Number
      </label>
      <input
        id="customer-mobile"
        type="tel"
        className="mt-1 mb-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        required
      />

      <label className="block text-sm font-medium text-neutral-700" htmlFor="customer-address">
        Address (optional)
      </label>
      <input
        id="customer-address"
        type="text"
        className="mt-1 mb-6 w-full rounded-md border border-neutral-300 px-3 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-700 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
