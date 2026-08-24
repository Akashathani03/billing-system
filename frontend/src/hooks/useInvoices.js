import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as invoicesApi from '../api/invoices';

export function useDraftsQuery() {
  return useQuery({
    queryKey: ['invoices', { status: 'draft' }],
    queryFn: () => invoicesApi.fetchInvoices({ status: 'draft' }),
  });
}

export function useInvoiceQuery(id) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.fetchInvoice(id),
    enabled: Boolean(id),
  });
}

function useInvalidateInvoices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['invoices'] });
}

export function useCreateInvoiceMutation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: invoicesApi.createInvoice,
    onSuccess: invalidate,
  });
}

export function useUpdateInvoiceMutation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: ({ id, data }) => invoicesApi.updateInvoice(id, data),
    onSuccess: invalidate,
  });
}

export function useFinalizeInvoiceMutation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: invoicesApi.finalizeInvoice,
    onSuccess: invalidate,
  });
}
