import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCustomerQuery, useUpdateCustomerMutation } from '../hooks/useCustomers';
import { useCustomerInvoicesQuery } from '../hooks/useInvoices';
import { BottomSheet } from '../components/BottomSheet';
import { CustomerForm } from '../components/CustomerForm';
import { BillListCard } from '../components/BillListCard';
import { PageHeader } from '../components/PageHeader';

export function CustomerDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error, refetch } = useCustomerQuery(id);
  const invoiceHistory = useCustomerInvoicesQuery(id);
  const updateCustomer = useUpdateCustomerMutation(id);
  const [editOpen, setEditOpen] = useState(false);

  async function handleUpdate(values) {
    await updateCustomer.mutateAsync(values);
    setEditOpen(false);
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <PageHeader title="Customer" />

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
            <p className="text-xl font-semibold text-neutral-900">{data.customer.name}</p>
            <p className="mt-1 text-neutral-600">{data.customer.mobile}</p>
            {data.customer.address && <p className="mt-1 text-sm text-neutral-500">{data.customer.address}</p>}

            <button
              onClick={() => setEditOpen(true)}
              className="mt-4 w-full rounded-md border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700"
            >
              Edit
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-neutral-900">{invoiceHistory.data?.totalBills ?? '—'}</p>
              <p className="text-xs text-neutral-500">Total Bills</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-neutral-900">
                {invoiceHistory.data ? `₹${invoiceHistory.data.totalPurchaseValue.toFixed(2)}` : '—'}
              </p>
              <p className="text-xs text-neutral-500">Total Purchases</p>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-sm font-semibold text-neutral-700">Recent Bills</h2>
            <div className="mt-2 space-y-2">
              {invoiceHistory.isLoading && (
                <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>
              )}
              {invoiceHistory.isError && (
                <p className="py-4 text-center text-sm text-red-700">Unable to load billing history.</p>
              )}
              {invoiceHistory.data?.invoices.length === 0 && (
                <p className="py-4 text-center text-sm text-neutral-500">No bills yet for this customer.</p>
              )}
              {invoiceHistory.data?.invoices.map((invoice) => (
                <BillListCard key={invoice._id} invoice={invoice} />
              ))}
            </div>
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
