import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";

export function useKnowledge() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.all });

  const listQuery = useQuery({
    queryKey: queryKeys.knowledge.all,
    queryFn: () => ipc.knowledge.list(),
    // Indexing runs in the background: poll while something is in progress.
    refetchInterval: (query) =>
      query.state.data?.some(
        (source) => source.status === "pending" || source.status === "indexing",
      )
        ? 1500
        : false,
  });
  const add = useMutation({
    mutationFn: (kind: "files" | "folder") => ipc.knowledge.add({ kind }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => ipc.knowledge.remove({ id }),
    onSuccess: refresh,
  });
  const reindex = useMutation({
    mutationFn: (id: number) => ipc.knowledge.reindex({ id }),
    onSuccess: refresh,
  });
  return { sources: listQuery.data ?? [], add, remove, reindex };
}
