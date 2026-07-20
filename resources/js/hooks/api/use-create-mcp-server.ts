import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CreateMcpServerPayload {
    name: string;
    type: 'http' | 'stdio';
    url: string;
    command: string;
    description: string;
}

export function useCreateMcpServer() {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, CreateMcpServerPayload>({
        mutationFn: (data) =>
            api('/api/mcp-servers', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
        },
    });
}
