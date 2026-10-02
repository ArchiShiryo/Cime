import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useSetAtom } from "jotai";
import { FolderKanban, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProjects } from "@/hooks/useProjects";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { PROJECT_TEMPLATES } from "@/shared/project_templates";
import { showError } from "@/lib/toast";
import { cn } from "@/lib/utils";

export default function ProjectsPage() {
  const { t } = useTranslation("cimes");
  const navigate = useNavigate();
  const { projects, loading, create } = useProjects();
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(PROJECT_TEMPLATES[0].id);

  const openProject = (appId: number) => {
    setSelectedAppId(appId);
    navigate({ to: "/project", search: { appId } });
  };

  const submit = async () => {
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        templateId,
      });
      setOpen(false);
      setName("");
      openProject(result.app.id);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className="w-full min-h-screen px-8 py-4" data-testid="projects-page">
      <div className="max-w-5xl space-y-6 pb-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
              {t("projects.title")}
            </h1>
          </div>
          <Button onClick={() => setOpen(true)} data-testid="new-project">
            <Plus className="mr-1 h-4 w-4" /> {t("projects.new")}
          </Button>
        </header>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            {t("projects.none")}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => openProject(project.id)}
                  data-testid={`project-${project.name}`}
                  className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                >
                  <FolderKanban className="mt-0.5 h-5 w-5 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {project.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.resolvedPath}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("projects.new")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t("projects.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="project-name-input"
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {PROJECT_TEMPLATES.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  onClick={() => setTemplateId(template.id)}
                  data-testid={`project-template-${template.id}`}
                  className={cn(
                    "h-full w-full rounded-md border p-3 text-left text-sm",
                    templateId === template.id
                      ? "border-primary bg-accent"
                      : "hover:bg-accent/50",
                  )}
                >
                  <span className="block font-medium">
                    {t(`projects.templates.${template.id}`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {template.folders.slice(1).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("projects.cancel")}
            </Button>
            <Button
              disabled={!name.trim() || create.isPending}
              onClick={submit}
              data-testid="create-project"
            >
              {create.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              {t("projects.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
