import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

export function useSendMessage(chatId: number) {
    return useMutation<Message, Error, string>({
        mutationFn: (content) =>
            api<Message>(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content }),
            }),
    });
}
