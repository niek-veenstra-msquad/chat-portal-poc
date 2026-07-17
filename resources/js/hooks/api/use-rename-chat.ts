import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRenameChat() {
    return useMutation<unknown, Error, { chatId: number; title: string }>({
        mutationFn: ({ chatId, title }) =>
            api(`/api/chats/${chatId}`, {
                method: 'PATCH',
                body: JSON.stringify({ title }),
            }),
    });
}
