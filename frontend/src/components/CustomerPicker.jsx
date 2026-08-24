import { useState } from 'react';
import { useCustomersQuery, useCreateCustomerMutation } from '../hooks/useCustomers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { BottomSheet } from './BottomSheet';
import { SearchInput } from './SearchInput';
import { CustomerForm } from './CustomerForm';

export function CustomerPicker({ open, onClose, onSelect }) {
  const [mode, setMode] = useState('search');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading } = useCustomersQuery(debouncedSearch);
  const createCustomer = useCreateCustomerMutation();

  function handleClose() {
    setMode('search');
    setSearch('');
    onClose();
  }

  function handleSelect(customer) {
    onSelect(customer);
    handleClose();
  }

  async function handleCreate(values) {
    const { customer } = await createCustomer.mutateAsync(values);
    handleSelect(customer);
  }

  return (
    <BottomSheet open={open} title={mode === 'search' ? 'Select Customer' : 'Add Customer'} onClose={handleClose}>
      {mode === 'search' ? (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or mobile" />
          <button
            onClick={() => setMode('add')}
            className="mt-3 w-full rounded-md border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700"
          >
            + Add New Customer
          </button>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {isLoading && <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>}
            {!isLoading && data?.customers.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">No customers found.</p>
            )}
            {data?.customers.map((customer) => (
              <button
                key={customer._id}
                onClick={() => handleSelect(customer)}
                className="block w-full rounded-lg border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50"
              >
                <p className="font-medium text-neutral-900">{customer.name}</p>
                <p className="text-sm text-neutral-500">{customer.mobile}</p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <CustomerForm onSubmit={handleCreate} submitting={createCustomer.isPending} submitLabel="Add & Select" />
      )}
    </BottomSheet>
  );
}
