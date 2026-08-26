import { useState } from 'react';
import { useProductsQuery, useCreateProductMutation, useUpdateProductMutation } from '../hooks/useProducts';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { SearchInput } from '../components/SearchInput';
import { BottomSheet } from '../components/BottomSheet';
import { ProductForm } from '../components/ProductForm';
import { PageHeader } from '../components/PageHeader';

function EditProductSheet({ product, onClose }) {
  const updateProduct = useUpdateProductMutation(product._id);

  async function handleUpdate(values) {
    await updateProduct.mutateAsync(values);
    onClose();
  }

  async function handleToggleActive() {
    await updateProduct.mutateAsync({ isActive: !product.isActive });
    onClose();
  }

  return (
    <BottomSheet open title="Edit Product" onClose={onClose}>
      <ProductForm initialValues={product} onSubmit={handleUpdate} submitting={updateProduct.isPending} />
      <button
        onClick={handleToggleActive}
        disabled={updateProduct.isPending}
        className={`mt-3 w-full rounded-md border py-2.5 text-sm font-semibold disabled:opacity-60 ${
          product.isActive
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-green-200 bg-green-50 text-green-700'
        }`}
      >
        {product.isActive ? 'Deactivate Product' : 'Reactivate Product'}
      </button>
    </BottomSheet>
  );
}

export function ProductsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading, isError, error, refetch } = useProductsQuery(debouncedSearch, {
    includeInactive: true,
  });
  const createProduct = useCreateProductMutation();
  const [addOpen, setAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  async function handleCreate(values) {
    await createProduct.mutateAsync(values);
    setAddOpen(false);
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <PageHeader title="Products" />

      <div className="mt-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products" />
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="py-8 text-center text-sm text-neutral-500">Loading…</p>}

        {isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>Couldn't load products — {error.message}</p>
            <button onClick={() => refetch()} className="mt-2 font-medium underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && data?.products.length === 0 && (
          <p className="py-8 text-center text-sm text-neutral-500">
            {debouncedSearch ? `No products found for "${debouncedSearch}"` : 'No products yet — add one to get started.'}
          </p>
        )}

        {data?.products.map((product) => (
          <button
            key={product._id}
            onClick={() => setEditingProduct(product)}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 text-left active:bg-neutral-50"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {product.name}
                {!product.isActive && (
                  <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                    Inactive
                  </span>
                )}
              </p>
              {product.unit && <p className="text-sm text-neutral-500">{product.unit}</p>}
            </div>
            <p className="font-semibold text-neutral-900">₹{product.price.toFixed(2)}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-28 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/30"
        aria-label="Add product"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-7 w-7">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <BottomSheet open={addOpen} title="Add Product" onClose={() => setAddOpen(false)}>
        <ProductForm onSubmit={handleCreate} submitting={createProduct.isPending} submitLabel="Add Product" />
      </BottomSheet>

      {editingProduct && (
        <EditProductSheet product={editingProduct} onClose={() => setEditingProduct(null)} />
      )}
    </div>
  );
}
