import { useMutation } from '@tanstack/react-query';
import { sendChatMessage } from '../api/ai';

export function useSendChatMessageMutation() {
  return useMutation({
    mutationFn: sendChatMessage,
  });
}
