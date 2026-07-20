import { router } from '@inertiajs/react';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { useAvailableModels } from '@/hooks/api/use-available-models';

export function NewChatDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [model, setModel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { data: models, isLoading: modelsLoading } = useAvailableModels();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!title.trim() || !model || submitting) return;

        setSubmitting(true);
        router.post('/api/chats', { title: title.trim(), model }, {
            onFinish: () => {
                setSubmitting(false);
                setOpen(false);
                setTitle('');
                setModel('');
            },
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nieuwe chat</DialogTitle>
                    <DialogDescription>
                        Start een nieuw gesprek met een AI-model.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="chat-title">Titel</Label>
                        <Input
                            id="chat-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Bijv. Hulp met code"
                            disabled={submitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="chat-model">Model</Label>
                        <Select value={model} onValueChange={setModel} disabled={submitting || modelsLoading}>
                            <SelectTrigger id="chat-model">
                                <SelectValue placeholder={modelsLoading ? 'Modellen laden...' : 'Kies een model'} />
                            </SelectTrigger>
                            <SelectContent>
                                {models?.map((m) => (
                                    <SelectItem key={m} value={m}>
                                        {m}
                                    </SelectItem>
                                ))}
                                {!modelsLoading && models?.length === 0 && (
                                    <SelectItem value="_none" disabled>
                                        Geen modellen beschikbaar
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={submitting || !title.trim() || !model}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Aanmaken...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 size-4" />
                                    Chat starten
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
