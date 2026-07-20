import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeleteMcpServer() {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, number>({
        mutationFn: (serverId) =>
            api(`/api/mcp-servers/${serverId}`, {
                method: 'DELETE',
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
        },
    });
}
