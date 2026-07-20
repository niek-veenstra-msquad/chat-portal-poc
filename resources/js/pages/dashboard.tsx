import { Deferred, Head, router } from '@inertiajs/react';
import { Download, HardDrive, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePullModel, usePullModelStatus } from '@/hooks/api/use-pull-model';
import { dashboard } from '@/routes';

interface OllamaModel {
    name: string;
    size: string;
    modified_at: string;
}

interface DeferredResult<T> {
    data: T[];
    error: string | null;
}

interface PageProps {
    models?: DeferredResult<OllamaModel>;
}

export default function Dashboard({ models }: PageProps) {
    const [modelName, setModelName] = useState('');
    const [pullingModel, setPullingModel] = useState<string | null>(null);
    const pullModel = usePullModel();
    const pullStatus = usePullModelStatus(pullingModel);

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

    return (
        <>
            <Head title="Dashboard" />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
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
                        {isPulling && (
                            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" />
                                Model &quot;{pullingModel}&quot; wordt gedownload. Dit kan enkele minuten duren...
                            </p>
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
            </div>
        </>
    );
}

function ModelList({ models }: { models: OllamaModel[] }) {
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

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
