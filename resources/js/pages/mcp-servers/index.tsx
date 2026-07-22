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
    args: string | null;
    env: Record<string, string> | null;
    description: string | null;
    is_active: boolean;
}

interface PageProps {
    servers: McpServer[];
}

interface EnvEntry {
    key: string;
    value: string;
}

interface FormState {
    name: string;
    type: 'http' | 'stdio';
    url: string;
    command: string;
    args: string;
    env: EnvEntry[];
    description: string;
}

export default function McpServersIndex({ servers }: PageProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingServer, setEditingServer] = useState<McpServer | null>(null);
    const [form, setForm] = useState<FormState>({ name: '', type: 'http', url: '', command: '', args: '', env: [], description: '' });

    const createServer = useCreateMcpServer();
    const updateServer = useUpdateMcpServer(editingServer?.id ?? 0);
    const deleteServer = useDeleteMcpServer();
    const toggleServer = useToggleMcpServer();

    function openCreate() {
        setEditingServer(null);
        setForm({ name: '', type: 'http', url: '', command: '', args: '', env: [], description: '' });
        setDialogOpen(true);
    }

    function openEdit(server: McpServer) {
        setEditingServer(server);
        const envEntries: EnvEntry[] = server.env
            ? Object.entries(server.env).map(([key, value]) => ({ key, value }))
            : [];
        setForm({
            name: server.name,
            type: server.type,
            url: server.url ?? '',
            command: server.command ?? '',
            args: server.args ?? '',
            env: envEntries,
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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                            <Server className="size-5" />
                            MCP Servers
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Beheer externe MCP servers voor tool calling.
                        </p>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 size-4" />
                        Server toevoegen
                    </Button>
                </div>

                {servers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Geen MCP servers geconfigureerd. Voeg een server toe om tool calling te gebruiken.
                    </p>
                ) : (
                    <div className="grid gap-4">
                        {servers.map((server) => (
                            <Card key={server.id}>
                                <CardHeader className="flex flex-row items-start justify-between pb-3">
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-base">{server.name}</CardTitle>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${server.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {server.is_active ? 'Actief' : 'Inactief'}
                                            </span>
                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                {server.type === 'http' ? 'HTTP' : 'Stdio'}
                                            </span>
                                        </div>
                                        <CardDescription className="truncate">
                                            {server.type === 'http' ? server.url : `${server.command} ${server.args ?? ''}`.trim()}
                                        </CardDescription>
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
                                </CardHeader>
                                {server.description && (
                                    <CardContent className="pt-0">
                                        <p className="text-sm text-muted-foreground">{server.description}</p>
                                    </CardContent>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
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
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="server-command">Command</Label>
                                    <Input
                                        id="server-command"
                                        value={form.command}
                                        onChange={(e) => setForm({ ...form, command: e.target.value })}
                                        placeholder="npx"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="server-args">Arguments</Label>
                                    <Input
                                        id="server-args"
                                        value={form.args}
                                        onChange={(e) => setForm({ ...form, args: e.target.value })}
                                        placeholder="@modelcontextprotocol/server-filesystem /tmp"
                                        disabled={isSubmitting}
                                    />
                                    <p className="text-xs text-muted-foreground">Gescheiden door spaties</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Environment Variables (optioneel)</Label>
                                    <div className="space-y-2">
                                        {form.env.map((entry, index) => (
                                            <div key={index} className="flex items-center gap-2">
                                                <Input
                                                    value={entry.key}
                                                    onChange={(e) => {
                                                        const newEnv = [...form.env];
                                                        newEnv[index] = { ...newEnv[index], key: e.target.value };
                                                        setForm({ ...form, env: newEnv });
                                                    }}
                                                    placeholder="KEY"
                                                    disabled={isSubmitting}
                                                    className="flex-1"
                                                />
                                                <Input
                                                    value={entry.value}
                                                    onChange={(e) => {
                                                        const newEnv = [...form.env];
                                                        newEnv[index] = { ...newEnv[index], value: e.target.value };
                                                        setForm({ ...form, env: newEnv });
                                                    }}
                                                    placeholder="value"
                                                    disabled={isSubmitting}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        const newEnv = form.env.filter((_, i) => i !== index);
                                                        setForm({ ...form, env: newEnv });
                                                    }}
                                                    disabled={isSubmitting}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setForm({ ...form, env: [...form.env, { key: '', value: '' }] })}
                                            disabled={isSubmitting}
                                        >
                                            <Plus className="mr-2 size-3" />
                                            Variabele toevoegen
                                        </Button>
                                    </div>
                                </div>
                            </>
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
