import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useInvoiceQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useFinalizeInvoiceMutation,
} from '../hooks/useInvoices';
import { calcPreviewTotals } from '../utils/moneyPreview';
import { CustomerPicker } from '../components/CustomerPicker';
import { ProductPicker } from '../components/ProductPicker';
import { ItemCard } from '../components/ItemCard';
import { PaymentMethodSelect, PaymentStatusSelect } from '../components/PaymentSelectors';
import { PageHeader } from '../components/PageHeader';

function InvoiceGeneratedScreen({ invoice, onNewBill }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="mt-4 text-xl font-semibold text-neutral-900">
        Bill Generated
      </h1>

      <p className="mt-1 text-sm text-neutral-500">Invoice</p>

      <p className="text-lg font-semibold text-neutral-900">
        {invoice.invoiceNumber}
      </p>

      <p className="mt-3 text-sm text-neutral-500">Total</p>

      <p className="text-2xl font-bold text-neutral-900">
        ₹{invoice.total.toFixed(2)}
      </p>

      <button
        onClick={onNewBill}
        className="mt-8 w-full max-w-xs rounded-md bg-blue-700 py-3 text-base font-semibold text-white"
      >
        New Bill
      </button>
    </div>
  );
}

function customerFromInvoice(invoice) {
  return {
    _id: invoice.customer.customerId,
    name: invoice.customer.name,
    mobile: invoice.customer.mobile,
    address: invoice.customer.address,
  };
}

function itemsFromInvoice(invoice) {
  return invoice.items.map((i) => ({
    productId: i.productId,
    name: i.name,
    price: i.price,
    unit: i.unit,
    quantity: i.quantity,
  }));
}

/**
 * The actual form. Mounted only once its initial data (a fresh bill, or an
 * existing draft already fetched by the parent) is available, and remounted
 * via `key` whenever the route's draft id changes.
 */
function NewBillForm({ initialInvoice }) {
  const navigate = useNavigate();

  const [currentId, setCurrentId] = useState(
    () => initialInvoice?._id || null,
  );

  const [customer, setCustomer] = useState(
    () => (initialInvoice ? customerFromInvoice(initialInvoice) : null),
  );

  const [items, setItems] = useState(
    () => (initialInvoice ? itemsFromInvoice(initialInvoice) : []),
  );

  const [paymentMethod, setPaymentMethod] = useState(
    () => initialInvoice?.paymentMethod || 'cash',
  );

  const [paymentStatus, setPaymentStatus] = useState(
    () => initialInvoice?.paymentStatus || 'paid',
  );

  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [finalizedInvoice, setFinalizedInvoice] = useState(null);

  const createInvoice = useCreateInvoiceMutation();
  const updateInvoice = useUpdateInvoiceMutation();
  const finalizeInvoiceMutation = useFinalizeInvoiceMutation();

  const saving = createInvoice.isPending || updateInvoice.isPending;
  const finalizing = finalizeInvoiceMutation.isPending;

  function resetForm() {
    setCurrentId(null);
    setCustomer(null);
    setItems([]);
    setPaymentMethod('cash');
    setPaymentStatus('paid');
    setError('');
    setFinalizedInvoice(null);
    navigate('/new-bill', { replace: true });
  }

  function handleSelectProduct(product) {
    setItems((prev) => {
      const existingItem = prev.find(
        (i) => i.productId === product._id,
      );

      if (existingItem) {
        return prev.map((i) =>
          i.productId === product._id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }

      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          quantity: 1,
        },
      ];
    });
  }

  function handleQuantityChange(productId, quantity) {
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity }
          : i,
      ),
    );
  }

  function handleRemoveItem(productId) {
    setItems((prev) =>
      prev.filter((i) => i.productId !== productId),
    );
  }

  function buildPayload() {
    return {
      customerId: customer._id,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      paymentMethod,
      paymentStatus,
    };
  }

  async function ensureSaved() {
    const payload = buildPayload();

    if (currentId) {
      const { invoice } = await updateInvoice.mutateAsync({
        id: currentId,
        data: payload,
      });

      return invoice;
    }

    const { invoice } = await createInvoice.mutateAsync(payload);

    setCurrentId(invoice._id);

    return invoice;
  }

  async function handleSaveDraft() {
    setError('');

    if (!customer) {
      setError('Please select a customer first');
      return;
    }

    try {
      await ensureSaved();
      navigate('/more/drafts');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateInvoice() {
    setError('');

    if (!customer) {
      setError('Please select a customer first');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one product');
      return;
    }

    try {
      const saved = await ensureSaved();

      const { invoice } =
        await finalizeInvoiceMutation.mutateAsync(saved._id);

      setFinalizedInvoice(invoice);
    } catch (err) {
      setError(err.message);
    }
  }

  if (finalizedInvoice) {
    return (
      <InvoiceGeneratedScreen
        invoice={finalizedInvoice}
        onNewBill={resetForm}
      />
    );
  }

  const preview = calcPreviewTotals(items);

  return (
    <div className="px-4 pt-6 pb-44">
      <PageHeader title="New Bill" />

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-neutral-700">
          Customer
        </h2>

        {customer ? (
          <button
            onClick={() => setCustomerPickerOpen(true)}
            className="mt-2 flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-left"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {customer.name}
              </p>

              <p className="text-sm text-neutral-500">
                {customer.mobile}
              </p>
            </div>

            <span className="text-sm text-blue-700">
              Change
            </span>
          </button>
        ) : (
          <button
            onClick={() => setCustomerPickerOpen(true)}
            className="mt-2 w-full rounded-lg border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-600"
          >
            Select Customer
          </button>
        )}
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">
            Items
          </h2>

          <button
            onClick={() => setProductPickerOpen(true)}
            className="text-sm font-semibold text-blue-700"
          >
            + Add Product
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-neutral-300 py-6 text-center text-sm text-neutral-500">
              No items yet — tap "+ Add Product" to get started.
            </p>
          )}

          {items.map((item) => (
            <ItemCard
              key={item.productId}
              item={item}
              onQuantityChange={(q) =>
                handleQuantityChange(item.productId, q)
              }
              onRemove={() =>
                handleRemoveItem(item.productId)
              }
            />
          ))}
        </div>
      </section>

      {items.length > 0 && (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex justify-between text-sm text-neutral-600">
            <span>Subtotal</span>
            <span>₹{preview.subtotal.toFixed(2)}</span>
          </div>

          <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
            <span>Total</span>
            <span>₹{preview.total.toFixed(2)}</span>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">
          Payment Method
        </h2>

        <div className="mt-2">
          <PaymentMethodSelect
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-semibold text-neutral-700">
          Payment Status
        </h2>

        <div className="mt-2">
          <PaymentStatusSelect
            value={paymentStatus}
            onChange={setPaymentStatus}
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-24 z-10 flex gap-3 border-t border-neutral-200 bg-white px-4 py-3">
        <button
          onClick={handleSaveDraft}
          disabled={saving || finalizing}
          className="flex-1 rounded-md border border-neutral-300 py-3 text-sm font-semibold text-neutral-700 disabled:opacity-60"
        >
          Save Draft
        </button>

        <button
          onClick={handleGenerateInvoice}
          disabled={saving || finalizing}
          className="flex-1 rounded-md bg-blue-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {finalizing ? 'Generating…' : 'Generate Bill'}
        </button>
      </div>

      <CustomerPicker
        open={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={setCustomer}
      />

      <ProductPicker
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={handleSelectProduct}
      />
    </div>
  );
}

/**
 * Route-level wrapper: resolves which draft (if any) is being opened and
 * waits for it to load before ever mounting the form.
 */
export function NewBillPage() {
  const { id: routeId } = useParams();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useInvoiceQuery(routeId);

  if (routeId && isLoading) {
    return (
      <p className="px-4 py-8 text-center text-sm text-neutral-500">
        Loading…
      </p>
    );
  }

  if (routeId && isError) {
    return (
      <div className="px-4 pt-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>
            Couldn't load this draft — {error.message}
          </p>

          <button
            onClick={() => refetch()}
            className="mt-2 font-medium underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <NewBillForm
      key={routeId || 'new'}
      initialInvoice={data?.invoice}
    />
  );
}
