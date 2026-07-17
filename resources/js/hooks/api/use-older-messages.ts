import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

interface OlderMessagesResponse {
    messages: Message[];
    hasMore: boolean;
}

export function useOlderMessages(chatId: number, oldestMessageId: number | null) {
    return useInfiniteQuery<OlderMessagesResponse>({
        queryKey: ['chats', chatId, 'older-messages', oldestMessageId],
        queryFn: ({ pageParam }) =>
            api<OlderMessagesResponse>(`/api/chats/${chatId}/messages?before=${pageParam}`),
        initialPageParam: oldestMessageId,
        getNextPageParam: (lastPage, _allPages, lastPageParam) =>
            lastPage.hasMore ? lastPage.messages[0]?.id ?? lastPageParam : undefined,
        enabled: false,
    });
}
