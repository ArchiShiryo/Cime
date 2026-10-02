import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSkills } from "@/hooks/useSkills";
import type { ImportedSkillInfo } from "@/ipc/types/skills";

const ORIGIN_LABELS = {
  builtin: "Intégré",
  user: "Importé",
  app: "Dans l'application",
} as const;

/**
 * Manage Claude-format skills (folders with a SKILL.md): list, enable or
 * disable, import a folder or .zip/.skill, remove imported ones.
 */
export function SkillsSettings() {
  const { skills, importSkill, setEnabled, remove, openFolder } = useSkills();
  const [imported, setImported] = useState<ImportedSkillInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runImport = async (kind: "folder" | "archive") => {
    setError(null);
    setImported(null);
    try {
      const result = await importSkill.mutateAsync(kind);
      if (result) setImported(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3" data-testid="skills-settings">
      <div>
        <h3 className="text-sm font-medium">Skills</h3>
        <p className="text-sm text-muted-foreground">
          Des consignes d&apos;expert que l&apos;agent charge quand votre
          demande correspond. Compatible avec les skills Claude (dossier avec un
          fichier SKILL.md). Les scripts d&apos;un skill ne s&apos;exécutent
          jamais sans votre accord.
        </p>
      </div>

      <ul className="max-h-[28rem] divide-y overflow-y-auto rounded-md border">
        {skills.map((skill) => (
          <li
            key={skill.name}
            className="flex items-start justify-between gap-3 p-3"
            data-testid={`skill-${skill.name}`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{skill.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {ORIGIN_LABELS[skill.origin]}
                </span>
                {skill.hasScripts && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    contient des scripts
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {skill.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {skill.origin === "user" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(skill.name)}
                >
                  Supprimer
                </Button>
              )}
              <Switch
                aria-label={`Activer ${skill.name}`}
                checked={skill.enabled}
                onCheckedChange={(checked) =>
                  setEnabled.mutate({ name: skill.name, enabled: checked })
                }
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runImport("archive")}
        >
          Importer un .zip / .skill
        </Button>
        <Button variant="outline" size="sm" onClick={() => runImport("folder")}>
          Importer un dossier
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openFolder.mutate()}>
          Ouvrir le dossier des skills
        </Button>
      </div>

      {imported && (
        <p className="text-sm" role="status">
          Skill « {imported.name} » importé ({imported.fileCount} fichiers).
          {imported.scripts.length > 0 &&
            ` Il contient des scripts (${imported.scripts.join(", ")}) : ils ne s'exécuteront qu'avec votre accord.`}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
