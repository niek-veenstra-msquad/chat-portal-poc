import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface UpdateMcpServerPayload {
    name: string;
    type: 'http' | 'stdio';
    url: string;
    command: string;
    args: string;
    env: { key: string; value: string }[];
    description: string;
}

export function useUpdateMcpServer(serverId: number) {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, UpdateMcpServerPayload>({
        mutationFn: (data) =>
            api(`/api/mcp-servers/${serverId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
        },
    });
}
