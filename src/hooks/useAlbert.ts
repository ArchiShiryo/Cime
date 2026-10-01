import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";

export function useAlbert() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: queryKeys.albert.status,
    queryFn: () => ipc.albert.getStatus(),
  });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.albert.status }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.languageModels.providers,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.languageModels.byProviders,
      }),
    ]);
  };

  const connectMutation = useMutation({
    mutationFn: (apiKey: string) => ipc.albert.connect({ apiKey }),
    onSuccess: refreshAll,
  });

  const testMutation = useMutation({
    mutationFn: () => ipc.albert.testConnection(),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => ipc.albert.disconnect(),
    onSuccess: refreshAll,
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    connect: connectMutation,
    testConnection: testMutation,
    disconnect: disconnectMutation,
  };
}
