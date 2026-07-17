import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeleteChat() {
    return useMutation<unknown, Error, number>({
        mutationFn: (chatId) =>
            api(`/api/chats/${chatId}`, {
                method: 'DELETE',
            }),
    });
}
