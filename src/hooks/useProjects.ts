import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";
import { useLoadApps } from "@/hooks/useLoadApps";

export function useProjects() {
  const { apps, loading, refreshApps } = useLoadApps();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (args: { name: string; templateId: string }) =>
      ipc.app.createApp({
        name: args.name,
        projectTemplateId: args.templateId,
      }),
    onSuccess: async () => {
      await refreshApps();
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
  });
  return {
    projects: apps.filter((app) => app.isProject),
    loading,
    create,
  };
}

const projectKey = (appId: number) => ["projects", appId] as const;

export function useProject(appId: number) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: [...projectKey(appId), "config"],
    queryFn: () => ipc.projects.getConfig({ appId }),
  });
  const docsQuery = useQuery({
    queryKey: [...projectKey(appId), "docs"],
    queryFn: () => ipc.projects.docsList({ appId }),
    // Indexing runs in the background: poll while something is in progress.
    refetchInterval: (query) =>
      query.state.data?.some(
        (s) =>
          s.status === "pending" ||
          s.status === "indexing" ||
          (s.status === "ready" && s.embeddedCount < s.chunkCount),
      )
        ? 3000
        : false,
  });
  const refreshDocs = () =>
    queryClient.invalidateQueries({ queryKey: [...projectKey(appId), "docs"] });
  const updateConfig = useMutation({
    mutationFn: (patch: { enabledSkills?: string[]; instructions?: string }) =>
      ipc.projects.updateConfig({ appId, ...patch }),
    onSuccess: (data) =>
      queryClient.setQueryData([...projectKey(appId), "config"], data),
  });
  const addDocs = useMutation({
    mutationFn: (kind: "files" | "folder") =>
      ipc.projects.docsAdd({ appId, kind }),
    onSuccess: refreshDocs,
  });
  const indexDocs = useMutation({
    mutationFn: () => ipc.projects.docsIndex({ appId }),
    onSuccess: refreshDocs,
  });
  const removeSource = useMutation({
    mutationFn: (id: number) => ipc.knowledge.remove({ id }),
    onSuccess: refreshDocs,
  });
  const openFolder = useMutation({
    mutationFn: (target: "project" | "documentation") =>
      ipc.projects.openFolder({ appId, target }),
  });
  return {
    config: configQuery.data,
    docs: docsQuery.data ?? [],
    updateConfig,
    addDocs,
    indexDocs,
    removeSource,
    openFolder,
  };
}
