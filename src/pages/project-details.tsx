import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { FolderOpen, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { Textarea } from "@/components/ui/textarea";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useChats } from "@/hooks/useChats";
import { useProject } from "@/hooks/useProjects";
import { useSkills } from "@/hooks/useSkills";
import { useSelectChat } from "@/hooks/useSelectChat";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { getProjectTemplate } from "@/shared/project_templates";
import { ipc } from "@/ipc/types";
import { showError } from "@/lib/toast";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chats", key: "tabChats" },
  { id: "docs", key: "tabDocs" },
  { id: "skills", key: "tabSkills" },
  { id: "files", key: "tabFolder" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function ProjectDetailsPage() {
  const { t } = useTranslation("cimes");
  const { appId } = useSearch({ from: "/project" });
  const navigate = useNavigate();
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const { apps } = useLoadApps();
  const project = apps.find((app) => app.id === appId);
  const [tab, setTab] = useState<TabId>("chats");

  return (
    <div className="w-full min-h-screen px-8 py-4" data-testid="project-page">
      <div className="max-w-4xl space-y-5 pb-12">
        <BackButton />
        <header>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {project?.name ?? t("projects.defaultProject")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project?.resolvedPath}
          </p>
        </header>
        <div className="flex gap-1 border-b" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              data-testid={`project-tab-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === item.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`projects.${item.key}`)}
            </button>
          ))}
        </div>
        {tab === "chats" && <ProjectChats appId={appId} />}
        {tab === "docs" && <ProjectDocs appId={appId} />}
        {tab === "skills" && <ProjectSkills appId={appId} />}
        {tab === "files" && <ProjectFiles appId={appId} />}
      </div>
    </div>
  );
}

function ProjectChats({ appId }: { appId: number }) {
  const { t } = useTranslation("cimes");
  const { chats, invalidateChats } = useChats(appId);
  const { selectChat } = useSelectChat();
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);

  const open = (chatId: number) => {
    setSelectedAppId(appId);
    selectChat({ chatId, appId });
  };
  const create = async () => {
    try {
      const chatId = await ipc.chat.createChat({ appId });
      invalidateChats();
      open(chatId);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={create} data-testid="project-new-chat">
        <MessageSquarePlus className="mr-1 h-4 w-4" /> {t("projects.newChat")}
      </Button>
      {chats.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("projects.noChats")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => open(chat.id)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-accent"
              >
                <span className="truncate">
                  {chat.title || t("projects.newChat")}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(chat.createdAt).toLocaleDateString(undefined)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectDocs({ appId }: { appId: number }) {
  const { t, i18n: _i18n } = useTranslation("cimes");
  const { docs, addDocs, indexDocs, removeSource, openFolder } =
    useProject(appId);
  const ready = docs.filter((d) => d.status === "ready").length;
  const embedded = docs.reduce((n, d) => n + d.embeddedCount, 0);
  const total = docs.reduce((n, d) => n + d.chunkCount, 0);
  return (
    <div className="space-y-3" data-testid="project-docs">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => indexDocs.mutate()}
          disabled={indexDocs.isPending}
          data-testid="project-index-docs"
        >
          {t("projects.createRag")}
        </Button>
        <Button variant="outline" onClick={() => addDocs.mutate("files")}>
          {t("projects.addFiles")}
        </Button>
        <Button variant="outline" onClick={() => addDocs.mutate("folder")}>
          {t("projects.addFolder")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => openFolder.mutate("documentation")}
        >
          <FolderOpen className="mr-1 h-4 w-4" /> {t("projects.openFolder")}
        </Button>
      </div>
      {docs.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {t("projects.docsReady", { ready, total: docs.length })}
            {total > 0
              ? t("projects.docsAnalysed", { done: embedded, total })
              : ""}
            .
          </p>
          <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
            {docs.map((source) => (
              <li
                key={source.id}
                className="flex items-start justify-between gap-3 p-3"
                data-testid={`project-doc-${source.name}`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium" title={source.path}>
                    {source.name}
                  </div>
                  <p
                    className={
                      source.status === "error"
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {source.status === "error" && source.error
                      ? source.error
                      : `${t(`documents.${source.status}`)}${source.status === "ready" ? ` · ${t("documents.passages", { count: source.chunkCount })}` : ""}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSource.mutate(source.id)}
                >
                  {t("projects.remove")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ProjectSkills({ appId }: { appId: number }) {
  const { t } = useTranslation("cimes");
  const { config, updateConfig } = useProject(appId);
  const { skills } = useSkills();
  const [draft, setDraft] = useState<string | null>(null);
  if (!config) return null;
  const enabled = new Set(config.enabledSkills);
  const toggle = (name: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(name);
    else next.delete(name);
    updateConfig.mutate({ enabledSkills: [...next] });
  };
  return (
    <div className="space-y-4" data-testid="project-skills">
      <ul className="divide-y rounded-md border">
        {skills
          .filter((skill) => skill.enabled)
          .map((skill) => (
            <li key={skill.name}>
              <label className="flex cursor-pointer items-start gap-3 p-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-primary"
                  checked={enabled.has(skill.name)}
                  onChange={(e) => toggle(skill.name, e.target.checked)}
                  data-testid={`project-skill-${skill.name}`}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{skill.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {skill.description}
                  </span>
                </span>
              </label>
            </li>
          ))}
      </ul>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("projects.instructions")}</h3>
        <Textarea
          rows={4}
          value={draft ?? config.instructions}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={draft === null || draft === config.instructions}
          onClick={() =>
            updateConfig.mutate(
              { instructions: draft ?? "" },
              { onSuccess: () => setDraft(null) },
            )
          }
        >
          {t("projects.saveInstructions")}
        </Button>
      </div>
    </div>
  );
}

function ProjectFiles({ appId }: { appId: number }) {
  const { t } = useTranslation("cimes");
  const { config, openFolder } = useProject(appId);
  const template = config ? getProjectTemplate(config.templateId) : undefined;
  return (
    <div className="space-y-3" data-testid="project-files">
      <Button variant="outline" onClick={() => openFolder.mutate("project")}>
        <FolderOpen className="mr-1 h-4 w-4" />{" "}
        {t("projects.openProjectFolder")}
      </Button>
      {template && (
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {template.folders.map((folder) => (
            <li key={folder}>{folder}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{config?.path}</p>
    </div>
  );
}
