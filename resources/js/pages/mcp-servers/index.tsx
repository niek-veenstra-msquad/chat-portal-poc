import { Head, router } from '@inertiajs/react';
import { Pencil, Plus, Power, PowerOff, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateMcpServer } from '@/hooks/api/use-create-mcp-server';
import { useDeleteMcpServer } from '@/hooks/api/use-delete-mcp-server';
import { useToggleMcpServer } from '@/hooks/api/use-toggle-mcp-server';
import { useUpdateMcpServer } from '@/hooks/api/use-update-mcp-server';
import { index as mcpServersIndex } from '@/routes/mcp-servers';

interface McpServer {
    id: number;
    name: string;
    type: 'http' | 'stdio';
    url: string | null;
    command: string | null;
    description: string | null;
    is_active: boolean;
}

interface PageProps {
    servers: McpServer[];
}

interface FormState {
    name: string;
    type: 'http' | 'stdio';
    url: string;
    command: string;
    description: string;
}

export default function McpServersIndex({ servers }: PageProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<McpServer | null>(null);
    const [form, setForm] = useState<FormState>({ name: '', type: 'http', url: '', command: '', description: '' });

    const createServer = useCreateMcpServer();
    const updateServer = useUpdateMcpServer(editingServer?.id ?? 0);
    const deleteServer = useDeleteMcpServer();
    const toggleServer = useToggleMcpServer();

    function openCreate() {
        setEditingServer(null);
        setForm({ name: '', type: 'http', url: '', command: '', description: '' });
        setDialogOpen(true);
    }

    function openEdit(server: McpServer) {
        setEditingServer(server);
        setForm({
            name: server.name,
            type: server.type,
            url: server.url ?? '',
            command: server.command ?? '',
            description: server.description ?? '',
        });
        setDialogOpen(true);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const mutation = editingServer ? updateServer : createServer;

        mutation.mutate(form, {
            onSuccess: () => {
                setDialogOpen(false);
                router.reload();
            },
        });
    }

    function handleDelete(server: McpServer) {
        deleteServer.mutate(server.id, {
            onSuccess: () => router.reload(),
        });
    }

    function handleToggleActive(server: McpServer) {
        toggleServer.mutate(server.id, {
            onSuccess: () => router.reload(),
        });
    }

    const isSubmitting = createServer.isPending || updateServer.isPending;

    return (
        <>
            <Head title="MCP Servers" />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="size-5" />
                                MCP Servers
                            </CardTitle>
                            <CardDescription>
                                Beheer externe MCP servers voor tool calling.
                            </CardDescription>
                        </div>
                        <Button onClick={openCreate}>
                            <Plus className="mr-2 size-4" />
                            Server toevoegen
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {servers.length === 0 ? (
                            <p className="py-4 text-sm text-muted-foreground">
                                Geen MCP servers geconfigureerd. Voeg een server toe om tool calling te gebruiken.
                            </p>
                        ) : (
                            <div className="divide-y">
                                {servers.map((server) => (
                                    <div key={server.id} className="flex items-center justify-between py-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{server.name}</p>
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${server.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                    {server.is_active ? 'Actief' : 'Inactief'}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    {server.type === 'http' ? 'HTTP' : 'Stdio'}
                                                </span>
                                            </div>
                                            <p className="truncate text-sm text-muted-foreground">
                                                {server.type === 'http' ? server.url : server.command}
                                            </p>
                                            {server.description && (
                                                <p className="mt-1 text-sm text-muted-foreground">{server.description}</p>
                                            )}
                                        </div>
                                        <div className="ml-4 flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(server)} title={server.is_active ? 'Deactiveren' : 'Activeren'}>
                                                {server.is_active ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(server)}>
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(server)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingServer ? 'Server bewerken' : 'Server toevoegen'}</DialogTitle>
                        <DialogDescription>
                            {editingServer ? 'Bewerk de MCP server configuratie.' : 'Voeg een nieuwe MCP server toe voor tool calling.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="server-name">Naam</Label>
                            <Input
                                id="server-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Bijv. Filesystem Server"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="server-type">Type</Label>
                            <Select value={form.type} onValueChange={(value: 'http' | 'stdio') => setForm({ ...form, type: value })} disabled={isSubmitting}>
                                <SelectTrigger id="server-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="http">HTTP (URL)</SelectItem>
                                    <SelectItem value="stdio">Stdio (Command)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {form.type === 'http' && (
                            <div className="space-y-2">
                                <Label htmlFor="server-url">URL</Label>
                                <Input
                                    id="server-url"
                                    value={form.url}
                                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                                    placeholder="http://localhost:3000/mcp"
                                    disabled={isSubmitting}
                                />
                            </div>
                        )}
                        {form.type === 'stdio' && (
                            <div className="space-y-2">
                                <Label htmlFor="server-command">Command</Label>
                                <Input
                                    id="server-command"
                                    value={form.command}
                                    onChange={(e) => setForm({ ...form, command: e.target.value })}
                                    placeholder="npx @modelcontextprotocol/server-filesystem /path"
                                    disabled={isSubmitting}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="server-description">Beschrijving (optioneel)</Label>
                            <Textarea
                                id="server-description"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Waar is deze server voor?"
                                disabled={isSubmitting}
                                rows={3}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting || !form.name.trim() || (form.type === 'http' && !form.url.trim()) || (form.type === 'stdio' && !form.command.trim())}>
                                {editingServer ? 'Opslaan' : 'Toevoegen'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

McpServersIndex.layout = {
    breadcrumbs: [
        {
            title: 'MCP Servers',
            href: mcpServersIndex(),
        },
    ],
};
