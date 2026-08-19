import { Head } from '@inertiajs/react';
import { Check, Loader2, Send, Wrench, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStreamReply, type ToolCallEvent } from '@/hooks/api/use-generate-reply';
import { useOlderMessages } from '@/hooks/api/use-older-messages';
import { useSendMessage } from '@/hooks/api/use-send-message';

interface Message {
    id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

interface ToolHistoryEntry {
    id: number;
    name: string;
    status: 'running' | 'done' | 'error';
    result?: string;
    timestamp: string;
}

interface ToolExecutionProp {
    id: number;
    tool_name: string;
    status: string;
    result: string | null;
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
    toolExecutions: ToolExecutionProp[];
}

export default function ChatShow({ chat, messages: initialMessages, hasMore: initialHasMore, toolExecutions }: PageProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const replyAttemptedRef = useRef(false);

    const [toolHistory, setToolHistory] = useState<ToolHistoryEntry[]>(() =>
        toolExecutions.map((te) => ({
            id: te.id,
            name: te.tool_name,
            status: te.status as ToolHistoryEntry['status'],
            result: te.result ?? undefined,
            timestamp: te.created_at,
        })),
    );

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
            // Add newly streamed tool calls to local history
            if (stream.toolCalls.length > 0) {
                const newEntries: ToolHistoryEntry[] = stream.toolCalls.map((tc, i) => ({
                    id: -(Date.now() + i),
                    name: tc.name,
                    status: tc.status === 'done' ? 'done' : 'error',
                    result: tc.result,
                    timestamp: new Date().toISOString(),
                }));
                setToolHistory((prev) => [...prev, ...newEntries]);
            }

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

    const handleSend = useCallback((content: string) => {
        setShouldScrollToBottom(true);

        sendMessage.mutate(content, {
            onSuccess: (data) => {
                replyAttemptedRef.current = false;
                setAllMessages((prev) => [...prev, data]);
            },
        });
    }, [sendMessage]);

    const isGenerating = stream.isStreaming || sendMessage.isPending;
    const emptyToolCalls = useRef<ToolCallEvent[]>([]).current;
    const activeToolCalls = stream.isStreaming ? stream.toolCalls : emptyToolCalls;

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
                        {allMessages.map((message) =>
                            message.role === 'user' ? (
                                <div key={message.id} className="flex justify-end">
                                    <div className="max-w-[80%] rounded-xl bg-sidebar px-4 py-2 text-sidebar-foreground">
                                        <p className="whitespace-pre-wrap">
                                            {message.content}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div key={message.id}>
                                    <Streamdown mode="static" plugins={{ code }}>
                                        {message.content}
                                    </Streamdown>
                                </div>
                            ),
                        )}
                        {stream.isStreaming && (
                            <div className="space-y-4">
                                {stream.toolCalls.length > 0 && (
                                    <ToolCallList toolCalls={stream.toolCalls} />
                                )}
                                {stream.content ? (
                                    <Streamdown mode="streaming" isAnimating animated plugins={{ code }}>
                                        {stream.content}
                                    </Streamdown>
                                ) : (
                                    <TypingIndicator />
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <ChatInputForm
                    onSend={handleSend}
                    isGenerating={isGenerating}
                    toolHistory={toolHistory}
                    activeToolCalls={activeToolCalls}
                />
            </div>
        </>
    );
}

const ChatInputForm = React.memo(function ChatInputForm({
    onSend,
    isGenerating,
    toolHistory,
    activeToolCalls,
}: {
    onSend: (content: string) => void;
    isGenerating: boolean;
    toolHistory: ToolHistoryEntry[];
    activeToolCalls: ToolCallEvent[];
}) {
    const [input, setInput] = useState('');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!input.trim() || isGenerating) {
            return;
        }

        onSend(input.trim());
        setInput('');
    }

    return (
        <div className="border-t p-4">
            <form
                onSubmit={handleSubmit}
                className="mx-auto flex max-w-3xl gap-2"
            >
                <ToolHistorySheet
                    toolHistory={toolHistory}
                    activeToolCalls={activeToolCalls}
                />
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
                    {isGenerating ? (
                        <Spinner />
                    ) : (
                        <Send className="size-4" />
                    )}
                </Button>
            </form>
        </div>
    );
});

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

function ToolHistorySheet({
    toolHistory,
    activeToolCalls,
}: {
    toolHistory: ToolHistoryEntry[];
    activeToolCalls: ToolCallEvent[];
}) {
    const totalCount = toolHistory.length + activeToolCalls.length;

    return (
        <Sheet>
            <Tooltip>
                <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="relative shrink-0"
                        >
                            <Wrench className="size-4" />
                            {totalCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                    {totalCount}
                                </span>
                            )}
                        </Button>
                    </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>Tool-geschiedenis</TooltipContent>
            </Tooltip>
            <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Tool-geschiedenis</SheetTitle>
                    <SheetDescription>
                        Overzicht van alle uitgevoerde tools in dit gesprek.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-2 px-4 pb-4">
                    {totalCount === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Er zijn nog geen tools uitgevoerd.
                        </p>
                    ) : (
                        <>
                            {activeToolCalls.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase text-muted-foreground">
                                        Actief
                                    </p>
                                    {activeToolCalls.map((tc, i) => (
                                        <ToolHistoryItem
                                            key={`active-${i}`}
                                            name={tc.name}
                                            status={tc.status === 'done' ? 'done' : 'running'}
                                        />
                                    ))}
                                </div>
                            )}
                            {toolHistory.length > 0 && (
                                <div className="space-y-2">
                                    {activeToolCalls.length > 0 && (
                                        <p className="text-xs font-medium uppercase text-muted-foreground">
                                            Afgerond
                                        </p>
                                    )}
                                    {[...toolHistory].reverse().map((entry) => (
                                        <ToolHistoryItem
                                                    key={`history-${entry.id}`}
                                            name={entry.name}
                                            status={entry.status}
                                            timestamp={entry.timestamp}
                                            result={entry.result}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function ToolHistoryItem({
    name,
    status,
    timestamp,
    result,
}: {
    name: string;
    status: 'running' | 'done' | 'error';
    timestamp?: string;
    result?: string;
}) {
    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
                {status === 'running' ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-blue-500" />
                ) : status === 'done' ? (
                    <Check className="size-3.5 shrink-0 text-green-500" />
                ) : (
                    <X className="size-3.5 shrink-0 text-red-500" />
                )}
                <span className="font-mono text-sm font-medium">{name}</span>
                <Badge
                    variant={status === 'done' ? 'default' : status === 'running' ? 'secondary' : 'destructive'}
                    className="ml-auto text-[10px]"
                >
                    {status === 'done' ? 'Voltooid' : status === 'running' ? 'Actief' : 'Fout'}
                </Badge>
            </div>
            {timestamp && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(timestamp).toLocaleTimeString('nl-NL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}
                </p>
            )}
            {result && (
                <pre className="mt-2 h-[4.5rem] overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
                    {result}
                </pre>
            )}
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
