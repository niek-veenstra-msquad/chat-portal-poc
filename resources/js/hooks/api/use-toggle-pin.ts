import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTogglePin() {
    return useMutation<unknown, Error, number>({
        mutationFn: (chatId) =>
            api(`/api/chats/${chatId}/toggle-pin`, {
                method: 'POST',
            }),
    });
}
