import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PullStatus {
    status: 'idle' | 'pulling' | 'success' | 'failed';
    message?: string;
}

export function usePullModel() {
    return useMutation<PullStatus, Error, string>({
        mutationFn: (model) =>
            api<PullStatus>('/api/models/pull', {
                method: 'POST',
                body: JSON.stringify({ model }),
            }),
    });
}

export function usePullModelStatus(model: string | null) {
    const queryClient = useQueryClient();

    return useQuery<PullStatus>({
        queryKey: ['model-pull-status', model],
        queryFn: () => api<PullStatus>(`/api/models/pull-status?model=${encodeURIComponent(model!)}`),
        enabled: !!model,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status === 'pulling') return 2000;
            if (status === 'success' || status === 'failed') {
                queryClient.invalidateQueries({ queryKey: ['model-pull-status', model] });
                return false;
            }
            return false;
        },
    });
}
