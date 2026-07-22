import { Head } from '@inertiajs/react';
import { Loader2, Send, Wrench } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useStreamReply, type ToolCallEvent } from '@/hooks/api/use-generate-reply';
import { useOlderMessages } from '@/hooks/api/use-older-messages';
import { useSendMessage } from '@/hooks/api/use-send-message';
import { cn } from '@/lib/utils';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

interface PageProps {
    chat: {
        id: number;
        title: string;
        model: string;
    };
    messages: Message[];
    hasMore: boolean;
}

export default function ChatShow({ chat, messages: initialMessages, hasMore: initialHasMore }: PageProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [input, setInput] = useState('');
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const replyAttemptedRef = useRef(false);

    const sendMessage = useSendMessage(chat.id);
    const stream = useStreamReply(chat.id);
    const olderMessages = useOlderMessages(chat.id, allMessages[0]?.id ?? null);

    useEffect(() => {
        setAllMessages(initialMessages);
        setHasMore(initialHasMore);
    }, [initialMessages, initialHasMore]);

    useEffect(() => {
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [allMessages, stream.isStreaming, stream.content, shouldScrollToBottom]);

    useEffect(() => {
        if (stream.messageId && !stream.isStreaming) {
            setAllMessages((prev) => {
                if (prev.some((m) => m.id === stream.messageId)) return prev;
                return [
                    ...prev,
                    {
                        id: stream.messageId!,
                        role: 'assistant' as const,
                        content: stream.content,
                        created_at: stream.createdAt ?? new Date().toISOString(),
                    },
                ];
            });
        }
    }, [stream.messageId, stream.isStreaming]);

    useEffect(() => {
        if (stream.error && !stream.isStreaming) {
            setAllMessages((prev) => [
                ...prev,
                {
                    id: Date.now(),
                    role: 'assistant' as const,
                    content: stream.error!,
                    created_at: new Date().toISOString(),
                },
            ]);
        }
    }, [stream.error, stream.isStreaming]);

    useEffect(() => {
        const lastMessage = allMessages[allMessages.length - 1];
        const needsReply = lastMessage?.role === 'user' && !stream.isStreaming && !sendMessage.isPending;

        if (needsReply && !replyAttemptedRef.current) {
            replyAttemptedRef.current = true;
            stream.start();
        }

        if (lastMessage?.role === 'assistant') {
            replyAttemptedRef.current = false;
        }
    }, [allMessages, stream.isStreaming, sendMessage.isPending]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;

        if (!container || olderMessages.isFetching || !hasMore) {
            return;
        }

        if (container.scrollTop < 100) {
            loadOlderMessages();
        }
    }, [olderMessages.isFetching, hasMore]);

    function loadOlderMessages() {
        const oldestMessage = allMessages[0];

        if (!oldestMessage) {
            return;
        }

        setShouldScrollToBottom(false);

        const container = scrollContainerRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;

        olderMessages.fetchNextPage().then((result) => {
            const page = result.data?.pages[result.data.pages.length - 1];

            if (page) {
                setAllMessages((prev) => [...page.messages, ...prev]);
                setHasMore(page.hasMore);

                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - previousScrollHeight;
                    }
                    setShouldScrollToBottom(true);
                });
            }
        });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!input.trim() || sendMessage.isPending) {
            return;
        }

        const content = input.trim();
        setShouldScrollToBottom(true);
        setInput('');

        sendMessage.mutate(content, {
            onSuccess: (data) => {
                replyAttemptedRef.current = false;
                setAllMessages((prev) => [...prev, data]);
            },
            onError: () => {
                setInput(content);
            },
        });
    }

    const isGenerating = stream.isStreaming || sendMessage.isPending;

    return (
        <>
            <Head title={chat.title} />
            <div className="flex h-[calc(100svh-4rem)] flex-col overflow-hidden">
                <div
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="min-h-0 flex-1 overflow-y-auto p-4"
                >
                    <div className="mx-auto max-w-3xl space-y-4">
                        {olderMessages.isFetching && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {!hasMore && allMessages.length > 0 && (
                            <p className="text-center text-xs text-muted-foreground">
                                Begin van het gesprek
                            </p>
                        )}
                        {allMessages.length === 0 && !isGenerating && (
                            <div className="flex h-full items-center justify-center py-20">
                                <p className="text-muted-foreground">
                                    Start een gesprek door een bericht te
                                    sturen.
                                </p>
                            </div>
                        )}
                        {allMessages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    'flex',
                                    message.role === 'user'
                                        ? 'justify-end'
                                        : 'justify-start',
                                )}
                            >
                                <div
                                    className={cn(
                                        'max-w-[80%] rounded-xl px-4 py-2',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted',
                                    )}
                                >
                                    {message.role === 'user' ? (
                                        <p className="whitespace-pre-wrap text-sm">
                                            {message.content}
                                        </p>
                                    ) : (
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <Markdown remarkPlugins={[remarkGfm]}>
                                                {message.content}
                                            </Markdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {stream.isStreaming && (
                            <div className="space-y-2">
                                {stream.toolCalls.length > 0 && (
                                    <ToolCallList toolCalls={stream.toolCalls} />
                                )}
                                <div className="flex justify-start">
                                    <div className="max-w-[80%] rounded-xl bg-muted px-4 py-2">
                                        {stream.content ? (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <Markdown remarkPlugins={[remarkGfm]}>
                                                    {stream.content}
                                                </Markdown>
                                            </div>
                                        ) : (
                                            <TypingIndicator />
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="border-t p-4">
                    <form
                        onSubmit={handleSubmit}
                        className="mx-auto flex max-w-3xl gap-2"
                    >
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Typ een bericht..."
                            autoComplete="off"
                            autoFocus
                            disabled={isGenerating}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={isGenerating}
                        >
                            {sendMessage.isPending ? (
                                <Spinner />
                            ) : (
                                <Send className="size-4" />
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </>
    );
}

function ToolCallList({ toolCalls }: { toolCalls: ToolCallEvent[] }) {
    return (
        <div className="flex justify-start">
            <div className="max-w-[80%] space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
                {toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        {tc.status === 'running' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Wrench className="size-3.5" />
                        )}
                        <span className="font-mono text-xs">{tc.name}</span>
                        {tc.status === 'done' && (
                            <span className="text-xs text-green-600">✓</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1 py-1">
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </div>
    );
}

ChatShow.layout = {
    breadcrumbs: [
        {
            title: 'Chats',
            href: '/chats',
        },
    ],
};
