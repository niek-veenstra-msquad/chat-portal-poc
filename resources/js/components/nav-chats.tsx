import { Link, router, usePage } from '@inertiajs/react';
import {
    Ellipsis,
    MessageSquare,
    Pencil,
    Pin,
    PinOff,
    Plus,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    SidebarGroup,
    SidebarGroupAction,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';

interface ChatListItem {
    id: number;
    title: string;
    pinned: boolean;
}

export function NavChats() {
    const { isCurrentUrl } = useCurrentUrl();
    const { chats } = usePage<{ chats: ChatListItem[] }>().props;
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId !== null && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    function startEditing(chat: ChatListItem) {
        setEditValue(chat.title);
        setEditingId(chat.id);
    }

    function submitRename() {
        if (editingId === null || !editValue.trim()) {
            setEditingId(null);

            return;
        }

        router.patch(
            `/api/chats/${editingId}`,
            { title: editValue.trim() },
            { onFinish: () => setEditingId(null) },
        );
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitRename();
        }

        if (e.key === 'Escape') {
            setEditingId(null);
        }
    }

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Chats</SidebarGroupLabel>
            <SidebarGroupAction asChild>
                <Link
                    href="/api/chats"
                    method="post"
                    data={{ title: 'Nieuwe chat' }}
                    as="button"
                >
                    <Plus />
                    <span className="sr-only">Nieuwe chat</span>
                </Link>
            </SidebarGroupAction>
            <SidebarMenu>
                {chats.map((chat) => {
                    const href = `/chats/${chat.id}`;
                    const isEditing = editingId === chat.id;

                    return (
                        <SidebarMenuItem key={chat.id}>
                            {isEditing ? (
                                <Input
                                    ref={inputRef}
                                    value={editValue}
                                    onChange={(e) =>
                                        setEditValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    onBlur={submitRename}
                                    className="h-8 text-sm"
                                />
                            ) : (
                                <>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isCurrentUrl(href)}
                                        tooltip={{ children: chat.title }}
                                    >
                                        <Link href={href} prefetch>
                                            {chat.pinned ? (
                                                <Pin className="size-4" />
                                            ) : (
                                                <MessageSquare className="size-4" />
                                            )}
                                            <span>{chat.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuAction showOnHover>
                                                <Ellipsis />
                                                <span className="sr-only">
                                                    Meer opties
                                                </span>
                                            </SidebarMenuAction>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            side="right"
                                            align="start"
                                        >
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    startEditing(chat)
                                                }
                                            >
                                                <Pencil className="mr-2 size-4" />
                                                Hernoemen
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    router.post(
                                                        `/api/chats/${chat.id}/toggle-pin`,
                                                    )
                                                }
                                            >
                                                {chat.pinned ? (
                                                    <>
                                                        <PinOff className="mr-2 size-4" />
                                                        Losmaken
                                                    </>
                                                ) : (
                                                    <>
                                                        <Pin className="mr-2 size-4" />
                                                        Vastpinnen
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() =>
                                                    router.delete(
                                                        `/api/chats/${chat.id}`,
                                                    )
                                                }
                                            >
                                                <Trash2 className="mr-2 size-4" />
                                                Verwijderen
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}
                        </SidebarMenuItem>
                    );
                })}
                {chats.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                        Nog geen chats
                    </p>
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
