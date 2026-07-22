import { useCallback, useRef, useState } from 'react';

interface StreamState {
    isStreaming: boolean;
    content: string;
    toolCalls: ToolCallEvent[];
    error: string | null;
    messageId: number | null;
    createdAt: string | null;
}

export interface ToolCallEvent {
    name: string;
    status: 'running' | 'done';
    result?: string;
}

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export function useStreamReply(chatId: number) {
    const [state, setState] = useState<StreamState>({
        isStreaming: false,
        content: '',
        toolCalls: [],
        error: null,
        messageId: null,
        createdAt: null,
    });
    const abortRef = useRef<AbortController | null>(null);

    const start = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setState({
            isStreaming: true,
            content: '',
            toolCalls: [],
            error: null,
            messageId: null,
            createdAt: null,
        });

        try {
            const response = await fetch(`/api/chats/${chatId}/generate-reply`, {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    error: 'Verbinding met server mislukt.',
                }));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    const eventMatch = part.match(/^event:\s*(.+)$/m);
                    const dataMatch = part.match(/^data:\s*(.+)$/m);

                    if (!eventMatch || !dataMatch) continue;

                    const event = eventMatch[1];
                    const data = JSON.parse(dataMatch[1]);

                    switch (event) {
                        case 'token':
                            setState((prev) => ({
                                ...prev,
                                content: prev.content + data.content,
                            }));
                            break;
                        case 'tool_start':
                            setState((prev) => ({
                                ...prev,
                                content: '',
                                toolCalls: [
                                    ...prev.toolCalls,
                                    { name: data.name, status: 'running' },
                                ],
                            }));
                            break;
                        case 'tool_end':
                            setState((prev) => ({
                                ...prev,
                                toolCalls: prev.toolCalls.map((tc) =>
                                    tc.name === data.name && tc.status === 'running'
                                        ? { ...tc, status: 'done' as const, result: data.result }
                                        : tc,
                                ),
                            }));
                            break;
                        case 'done':
                            setState((prev) => ({
                                ...prev,
                                isStreaming: false,
                                messageId: data.id,
                                createdAt: data.created_at,
                            }));
                            break;
                        case 'error':
                            setState((prev) => ({
                                ...prev,
                                isStreaming: false,
                                error: data.message,
                            }));
                            break;
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setState((prev) => ({
                ...prev,
                isStreaming: false,
                error: 'Verbinding verbroken.',
            }));
        }
    }, [chatId]);

    const abort = useCallback(() => {
        abortRef.current?.abort();
        setState((prev) => ({ ...prev, isStreaming: false }));
    }, []);

    return { ...state, start, abort };
}
