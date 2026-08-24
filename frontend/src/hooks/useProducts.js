import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as productsApi from '../api/products';

export function useProductsQuery(search, { includeInactive = false } = {}) {
  return useQuery({
    queryKey: ['products', { search, includeInactive }],
    queryFn: () => productsApi.fetchProducts({ search, includeInactive }),
    placeholderData: (previous) => previous,
  });
}

export function useCreateProductMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProductMutation(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => productsApi.updateProduct(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}
