import { Head, router } from '@inertiajs/react';
import { Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
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
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [waitingForReply, setWaitingForReply] = useState(false);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

    useEffect(() => {
        setAllMessages(initialMessages);
        setHasMore(initialHasMore);
    }, [initialMessages, initialHasMore]);

    useEffect(() => {
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [allMessages, waitingForReply, shouldScrollToBottom]);

    useEffect(() => {
        const lastMessage = allMessages[allMessages.length - 1];
        const needsReply = lastMessage?.role === 'user' && !waitingForReply && !sending;

        if (needsReply) {
            fetchReply();
        }
    }, [allMessages]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;

        if (!container || loadingOlder || !hasMore) {
            return;
        }

        if (container.scrollTop < 100) {
            loadOlderMessages();
        }
    }, [loadingOlder, hasMore]);

    function loadOlderMessages() {
        const oldestMessage = allMessages[0];

        if (!oldestMessage) {
            return;
        }

        setLoadingOlder(true);
        setShouldScrollToBottom(false);

        const container = scrollContainerRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;

        fetch(`/api/chats/${chat.id}/messages?before=${oldestMessage.id}`, {
            headers: { 'Accept': 'application/json' },
        })
            .then((res) => res.json())
            .then((data) => {
                setAllMessages((prev) => [...data.messages, ...prev]);
                setHasMore(data.hasMore);

                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - previousScrollHeight;
                    }

                    setShouldScrollToBottom(true);
                });
            })
            .finally(() => {
                setLoadingOlder(false);
            });
    }

    function fetchReply() {
        setWaitingForReply(true);
        setShouldScrollToBottom(true);

        fetch(`/api/chats/${chat.id}/generate-reply`, {
            method: 'POST',
            headers: {
                'X-XSRF-TOKEN': getCsrfToken(),
                'Accept': 'application/json',
            },
        })
            .then((res) => res.json())
            .then(() => {
                router.reload({ only: ['messages'] });
            })
            .finally(() => {
                setWaitingForReply(false);
            });
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!input.trim() || sending) {
            return;
        }

        setSending(true);
        setShouldScrollToBottom(true);
        router.post(
            `/api/chats/${chat.id}/messages`,
            { content: input.trim() },
            {
                onFinish: () => {
                    setSending(false);
                    setInput('');
                },
            },
        );
    }

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
                        {loadingOlder && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {!hasMore && allMessages.length > 0 && (
                            <p className="text-center text-xs text-muted-foreground">
                                Begin van het gesprek
                            </p>
                        )}
                        {allMessages.length === 0 && !waitingForReply && (
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
                                    <p className="whitespace-pre-wrap text-sm">
                                        {message.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {waitingForReply && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-xl bg-muted px-4 py-2">
                                    <TypingIndicator />
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
                            disabled={sending || waitingForReply}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={sending || waitingForReply}
                        >
                            {sending ? (
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

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1 py-1">
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
        </div>
    );
}

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

ChatShow.layout = {
    breadcrumbs: [
        {
            title: 'Chats',
            href: '/chats',
        },
    ],
};
