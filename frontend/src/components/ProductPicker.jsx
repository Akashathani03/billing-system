import { useState } from 'react';
import { useProductsQuery, useCreateProductMutation } from '../hooks/useProducts';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { BottomSheet } from './BottomSheet';
import { SearchInput } from './SearchInput';
import { ProductForm } from './ProductForm';

export function ProductPicker({ open, onClose, onSelect }) {
  const [mode, setMode] = useState('search');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const { data, isLoading } = useProductsQuery(debouncedSearch);
  const createProduct = useCreateProductMutation();

  function handleClose() {
    setMode('search');
    setSearch('');
    onClose();
  }

  async function handleCreate(values) {
    const { product } = await createProduct.mutateAsync(values);
    onSelect(product);
    setMode('search');
  }

  return (
    <BottomSheet open={open} title={mode === 'search' ? 'Add Product' : 'New Product'} onClose={handleClose}>
      {mode === 'search' ? (
        <>
          <SearchInput value={search} onChange={setSearch} placeholder="Search products" />
          <button
            onClick={() => setMode('add')}
            className="mt-3 w-full rounded-md border border-blue-200 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700"
          >
            + Add New Product
          </button>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {isLoading && <p className="py-4 text-center text-sm text-neutral-500">Loading…</p>}
            {!isLoading && data?.products.length === 0 && (
              <p className="py-4 text-center text-sm text-neutral-500">No products found.</p>
            )}
            {data?.products.map((product) => (
              <button
                key={product._id}
                onClick={() => onSelect(product)}
                className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 text-left active:bg-neutral-50"
              >
                <div>
                  <p className="font-medium text-neutral-900">{product.name}</p>
                  {product.unit && <p className="text-sm text-neutral-500">{product.unit}</p>}
                </div>
                <p className="font-semibold text-neutral-900">₹{product.price.toFixed(2)}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-neutral-400">Tap a product to add it — keep tapping to add more.</p>
        </>
      ) : (
        <ProductForm onSubmit={handleCreate} submitting={createProduct.isPending} submitLabel="Add & Select" />
      )}
    </BottomSheet>
  );
}
