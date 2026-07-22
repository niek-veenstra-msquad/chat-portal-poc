import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Deferred, Head, router } from '@inertiajs/react';
import { Download, GripVertical, HardDrive, Loader2, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePullModel, usePullModelStatus } from '@/hooks/api/use-pull-model';
import { useUpdateWidgetOrder } from '@/hooks/api/use-update-widget-order';
import { dashboard } from '@/routes';

interface OllamaModel {
    name: string;
    size: string;
    modified_at: string;
}

interface McpTool {
    name: string;
    description: string;
    server: string;
}

interface DeferredResult<T> {
    data: T[];
    error: string | null;
}

interface PageProps {
    models?: DeferredResult<OllamaModel>;
    mcpTools?: DeferredResult<McpTool>;
    widgetOrder: string[];
    pullingModel: string | null;
}

export default function Dashboard({ models, mcpTools, widgetOrder, pullingModel: initialPullingModel }: PageProps) {
    const [order, setOrder] = useState<string[]>(widgetOrder);
    const [modelName, setModelName] = useState('');
    const [pullingModel, setPullingModel] = useState<string | null>(initialPullingModel);
    const pullModel = usePullModel();
    const pullStatus = usePullModelStatus(pullingModel);
    const updateWidgetOrder = useUpdateWidgetOrder();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const isPulling = pullStatus.data?.status === 'pulling';
    const isSuccess = pullStatus.data?.status === 'success';
    const isFailed = pullStatus.data?.status === 'failed';

    function handlePull(e: React.FormEvent) {
        e.preventDefault();

        if (!modelName.trim() || isPulling) {
            return;
        }

        const name = modelName.trim();
        pullModel.mutate(name, {
            onSuccess: () => {
                setPullingModel(name);
                setModelName('');
            },
        });
    }

    if (isSuccess && pullingModel) {
        router.reload();
        setPullingModel(null);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = order.indexOf(active.id as string);
            const newIndex = order.indexOf(over.id as string);
            const newOrder = arrayMove(order, oldIndex, newIndex);

            setOrder(newOrder);
            updateWidgetOrder.mutate(newOrder);
        }
    }

    const widgets: Record<string, React.ReactNode> = {
        'models': (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <HardDrive className="size-5" />
                        Beschikbare modellen
                    </CardTitle>
                    <CardDescription>
                        Modellen die lokaal beschikbaar zijn via Ollama.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Deferred data={['models']} fallback={
                        <div className="flex items-center gap-2 py-4 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            Modellen laden...
                        </div>
                    }>
                        {models?.error ? (
                            <p className="py-4 text-sm text-destructive">{models.error}</p>
                        ) : (
                            <ModelList models={models?.data ?? []} />
                        )}
                    </Deferred>
                </CardContent>
            </Card>
        ),
        'pull-model': (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="size-5" />
                        Model downloaden
                    </CardTitle>
                    <CardDescription>
                        Download een nieuw model van de Ollama library (bijv. llama3.2, mistral, gemma2).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePull} className="flex gap-2">
                        <Input
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            placeholder="Modelnaam (bijv. llama3.2)"
                            disabled={isPulling || pullModel.isPending}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isPulling || pullModel.isPending || !modelName.trim()}>
                            {isPulling || pullModel.isPending ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Downloaden...
                                </>
                            ) : (
                                <>
                                    <Download className="mr-2 size-4" />
                                    Downloaden
                                </>
                            )}
                        </Button>
                    </form>
                    {isPulling && pullStatus.data && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="size-3 animate-spin" />
                                    {pullStatus.data.detail || `Model "${pullingModel}" wordt gedownload...`}
                                </span>
                                {(pullStatus.data.progress ?? 0) > 0 && (
                                    <span className="font-medium">{pullStatus.data.progress}%</span>
                                )}
                            </div>
                            {(pullStatus.data.progress ?? 0) > 0 && (
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-300"
                                        style={{ width: `${pullStatus.data.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {isFailed && (
                        <p className="mt-2 text-sm text-destructive">
                            {pullStatus.data?.message ?? 'Download mislukt.'}
                        </p>
                    )}
                    {pullModel.isError && (
                        <p className="mt-2 text-sm text-destructive">
                            {pullModel.error.message}
                        </p>
                    )}
                </CardContent>
            </Card>
        ),
        'mcp-tools': (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench className="size-5" />
                        Beschikbare MCP Tools
                    </CardTitle>
                    <CardDescription>
                        Tools die beschikbaar zijn via actieve MCP servers.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Deferred data={['mcpTools']} fallback={
                        <div className="flex items-center gap-2 py-4 text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" />
                            MCP tools laden...
                        </div>
                    }>
                        {mcpTools?.error ? (
                            <p className="py-4 text-sm text-destructive">{mcpTools.error}</p>
                        ) : (
                            <McpToolList tools={mcpTools?.data ?? []} />
                        )}
                    </Deferred>
                </CardContent>
            </Card>
        ),
    };

    return (
        <>
            <Head title="Dashboard" />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={order} strategy={verticalListSortingStrategy}>
                        {order.map((widgetId) => (
                            <SortableWidget key={widgetId} id={widgetId}>
                                {widgets[widgetId]}
                            </SortableWidget>
                        ))}
                    </SortableContext>
                </DndContext>
            </div>
        </>
    );
}

function SortableWidget({ id, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="group relative mb-6">
            <button
                type="button"
                className="absolute -left-8 top-4 z-10 cursor-grab rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                {...attributes}
                {...listeners}
            >
                <GripVertical className="size-4" />
            </button>
            {children}
        </div>
    );
}

function ModelList({ models }: { models: { name: string; size: string; modified_at: string }[] }) {
    if (models.length === 0) {
        return (
            <p className="py-4 text-sm text-muted-foreground">
                Geen modellen gevonden. Download een model hieronder.
            </p>
        );
    }

    return (
        <div className="divide-y">
            {models.map((model) => (
                <div key={model.name} className="flex items-center justify-between py-3">
                    <div>
                        <p className="font-medium">{model.name}</p>
                        <p className="text-sm text-muted-foreground">{model.size}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function McpToolList({ tools }: { tools: { name: string; description: string; server: string }[] }) {
    if (tools.length === 0) {
        return (
            <p className="py-4 text-sm text-muted-foreground">
                Geen tools beschikbaar. Configureer en activeer MCP servers om tools te gebruiken.
            </p>
        );
    }

    return (
        <div className="divide-y">
            {tools.map((tool) => (
                <div key={`${tool.server}-${tool.name}`} className="py-3">
                    <div className="flex items-center gap-2">
                        <p className="font-medium">{tool.name}</p>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            {tool.server}
                        </span>
                    </div>
                    {tool.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{tool.description}</p>
                    )}
                </div>
            ))}
        </div>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
