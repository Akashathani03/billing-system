import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCustomerQuery, useUpdateCustomerMutation } from '../hooks/useCustomers';
import { BottomSheet } from '../components/BottomSheet';
import { CustomerForm } from '../components/CustomerForm';

export function CustomerDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useCustomerQuery(id);
  const updateCustomer = useUpdateCustomerMutation(id);
  const [editOpen, setEditOpen] = useState(false);

  async function handleUpdate(values) {
    await updateCustomer.mutateAsync(values);
    setEditOpen(false);
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <Link to="/more" className="text-sm text-blue-700">
        ← Back
      </Link>

      {isLoading && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}

      {isError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>Couldn't load this customer — {error.message}</p>
          <button onClick={() => refetch()} className="mt-2 font-medium underline">
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
            <h1 className="text-xl font-semibold text-neutral-900">{data.customer.name}</h1>
            <p className="mt-1 text-neutral-600">{data.customer.mobile}</p>
            {data.customer.address && <p className="mt-1 text-sm text-neutral-500">{data.customer.address}</p>}

            <button
              onClick={() => setEditOpen(true)}
              className="mt-4 w-full rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700"
            >
              Edit
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-700">Billing History</h2>
            <p className="mt-2 text-sm text-neutral-500">
              No invoices yet — billing history will appear here once invoicing is live.
            </p>
          </div>

          <BottomSheet open={editOpen} title="Edit Customer" onClose={() => setEditOpen(false)}>
            <CustomerForm
              initialValues={data.customer}
              onSubmit={handleUpdate}
              submitting={updateCustomer.isPending}
            />
          </BottomSheet>
        </>
      )}
    </div>
  );
}
