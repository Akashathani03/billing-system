import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as manualBillPhotosApi from '../api/manualBillPhotos';

export function useManualBillPhotosQuery(customerId) {
  return useQuery({
    queryKey: ['manual-bills', customerId],
    queryFn: () => manualBillPhotosApi.fetchManualBillPhotos(customerId),
    enabled: Boolean(customerId),
  });
}

export function useUploadManualBillPhotoMutation(customerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file) => manualBillPhotosApi.uploadManualBillPhoto(customerId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manual-bills', customerId] }),
  });
}

export function useDeleteManualBillPhotoMutation(customerId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => manualBillPhotosApi.deleteManualBillPhoto(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manual-bills', customerId] }),
  });
}
