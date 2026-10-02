import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";

export function useSkills() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.skills.all });

  const listQuery = useQuery({
    queryKey: queryKeys.skills.all,
    queryFn: () => ipc.skills.list(),
    // Skills can also be added on disk, so re-read them whenever the list shows.
    refetchOnMount: "always",
  });
  const importMutation = useMutation({
    mutationFn: (kind: "folder" | "archive") => ipc.skills.import({ kind }),
    onSuccess: refresh,
  });
  const setEnabledMutation = useMutation({
    mutationFn: (args: { name: string; enabled: boolean }) =>
      ipc.skills.setEnabled(args),
    onSuccess: refresh,
  });
  const removeMutation = useMutation({
    mutationFn: (name: string) => ipc.skills.remove({ name }),
    onSuccess: refresh,
  });
  const openFolderMutation = useMutation({
    mutationFn: () => ipc.skills.openFolder(),
  });

  return {
    skills: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    importSkill: importMutation,
    setEnabled: setEnabledMutation,
    remove: removeMutation,
    openFolder: openFolderMutation,
  };
}
