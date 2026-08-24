import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCustomersQuery, useCreateCustomerMutation } from '../hooks/useCustomers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SearchInput } from '../components/SearchInput';
import { BottomSheet } from '../components/BottomSheet';
import { CustomerForm } from '../components/CustomerForm';

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, error, refetch } = useCustomersQuery(debouncedSearch);
  const createCustomer = useCreateCustomerMutation();
  const [addOpen, setAddOpen] = useState(false);

  async function handleCreate(values) {
    await createCustomer.mutateAsync(values);
    setAddOpen(false);
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-xl font-semibold text-neutral-900">Customers</h1>

      <div className="mt-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or mobile" />
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>Couldn't load customers — {error.message}</p>
            <button onClick={() => refetch()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.customers.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            {debouncedSearch ? `No customers found for "${debouncedSearch}"` : 'No customers yet — add one to get started.'}
          </p>
        )}

        {data?.customers.map((customer) => (
          <Link
            key={customer._id}
            to={`/customers/${customer._id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-4 active:bg-neutral-50"
          >
            <p className="font-medium text-neutral-900">{customer.name}</p>
            <p className="text-sm text-neutral-500">{customer.mobile}</p>
          </Link>
        ))}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/30"
        aria-label="Add customer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-7 w-7">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <BottomSheet open={addOpen} title="Add Customer" onClose={() => setAddOpen(false)}>
        <CustomerForm onSubmit={handleCreate} submitting={createCustomer.isPending} submitLabel="Add Customer" />
      </BottomSheet>
    </div>
  );
}
