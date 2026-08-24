import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as invoicesApi from '../api/invoices';

export function useDraftsQuery() {
  return useQuery({
    queryKey: ['invoices', { status: 'draft' }],
    queryFn: () => invoicesApi.fetchInvoices({ status: 'draft' }),
  });
}

const HISTORY_PAGE_SIZE = 20;

/**
 * Server-side offset pagination (page/limit — the same simple pattern
 * already used everywhere else in this app), surfaced to the UI as an
 * accumulating "Load More" list via useInfiniteQuery. This is the simplest
 * maintainable combination for this scale: no cursor encoding, no extra
 * dependency, and changing a filter naturally resets to page 1 because the
 * filters are part of the query key.
 */
export function useBillingHistoryQuery(filters) {
  return useInfiniteQuery({
    queryKey: ['invoices', 'billing-history', filters],
    queryFn: ({ pageParam }) =>
      invoicesApi.fetchInvoices({ status: 'finalized', page: pageParam, limit: HISTORY_PAGE_SIZE, ...filters }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedSoFar = lastPage.page * lastPage.limit;
      return loadedSoFar < lastPage.total ? lastPage.page + 1 : undefined;
    },
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

export function useDeleteDraftMutation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: invoicesApi.deleteDraft,
    onSuccess: invalidate,
  });
}

export function useMarkPaidMutation() {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: invoicesApi.markInvoicePaid,
    onSuccess: invalidate,
  });
}

export function useCustomerInvoicesQuery(customerId) {
  return useQuery({
    queryKey: ['customers', customerId, 'invoices'],
    queryFn: () => invoicesApi.fetchCustomerInvoices(customerId),
    enabled: Boolean(customerId),
  });
}
