import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as customersApi from '../api/customers';

export function useCustomersQuery(search) {
  return useQuery({
    queryKey: ['customers', { search }],
    queryFn: () => customersApi.fetchCustomers({ search }),
    placeholderData: (previous) => previous,
  });
}

export function useCustomerQuery(id) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customersApi.fetchCustomer(id),
    enabled: Boolean(id),
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customersApi.createCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomerMutation(id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => customersApi.updateCustomer(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}
