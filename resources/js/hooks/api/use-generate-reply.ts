import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

export function useGenerateReply(chatId: number) {
    return useMutation<Message, Error>({
        mutationFn: () =>
            api<Message>(`/api/chats/${chatId}/generate-reply`, {
                method: 'POST',
            }),
    });
}
