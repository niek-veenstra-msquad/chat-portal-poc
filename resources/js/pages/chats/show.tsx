import { Head } from '@inertiajs/react';
import { Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useGenerateReply } from '@/hooks/api/use-generate-reply';
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
    const generateReply = useGenerateReply(chat.id);
    const olderMessages = useOlderMessages(chat.id, allMessages[0]?.id ?? null);

    useEffect(() => {
        setAllMessages(initialMessages);
        setHasMore(initialHasMore);
    }, [initialMessages, initialHasMore]);

    useEffect(() => {
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [allMessages, generateReply.isPending, shouldScrollToBottom]);

    useEffect(() => {
        const lastMessage = allMessages[allMessages.length - 1];
        const needsReply = lastMessage?.role === 'user' && !generateReply.isPending && !sendMessage.isPending;

        if (needsReply && !replyAttemptedRef.current) {
            replyAttemptedRef.current = true;
            generateReply.mutate(undefined, {
                onSuccess: (data) => {
                    setAllMessages((prev) => [...prev, data]);
                },
                onError: () => {
                    setAllMessages((prev) => [
                        ...prev,
                        {
                            id: Date.now(),
                            role: 'assistant' as const,
                            content: 'Er ging iets mis bij het genereren van een antwoord. Probeer het opnieuw.',
                            created_at: new Date().toISOString(),
                        },
                    ]);
                },
            });
        }

        if (lastMessage?.role === 'assistant') {
            replyAttemptedRef.current = false;
        }
    }, [allMessages, generateReply.isPending, sendMessage.isPending]);

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
                        {allMessages.length === 0 && !generateReply.isPending && (
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
                        {generateReply.isPending && (
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
                            disabled={sendMessage.isPending || generateReply.isPending}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={sendMessage.isPending || generateReply.isPending}
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
