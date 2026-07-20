import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ModelsResponse {
    models: string[];
}

export function useAvailableModels() {
    return useQuery<string[]>({
        queryKey: ['available-models'],
        queryFn: async () => {
            const response = await api<ModelsResponse>('/api/models');
            return response.models;
        },
    });
}
