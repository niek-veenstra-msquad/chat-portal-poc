import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useToggleMcpServer() {
    const queryClient = useQueryClient();

    return useMutation<unknown, Error, number>({
        mutationFn: (serverId) =>
            api(`/api/mcp-servers/${serverId}/toggle-active`, {
                method: 'POST',
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
        },
    });
}
