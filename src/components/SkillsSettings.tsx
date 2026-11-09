import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSkills } from "@/hooks/useSkills";
import type { ImportedSkillInfo } from "@/ipc/types/skills";

/**
 * Manage Claude-format skills (folders with a SKILL.md): list, enable or
 * disable, import a folder or .zip/.skill, remove imported ones.
 */
export function SkillsSettings({
  showHeader = true,
  tall = false,
}: {
  showHeader?: boolean;
  tall?: boolean;
}) {
  const { t } = useTranslation("cimes");
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
      {showHeader && (
        <div>
          <h3 className="text-sm font-medium">{t("skills.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("skills.intro")}</p>
        </div>
      )}

      <ul
        className={`divide-y overflow-y-auto rounded-md border ${tall ? "max-h-[60vh]" : "max-h-[28rem]"}`}
      >
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
                  {t(`skills.${skill.origin}`)}
                </span>
                {skill.hasScripts && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t("skills.hasScripts")}
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
                  {t("skills.remove")}
                </Button>
              )}
              <Switch
                aria-label={t("skills.enable", { name: skill.name })}
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
          {t("skills.importArchive")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => runImport("folder")}>
          {t("skills.importFolder")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openFolder.mutate()}>
          {t("skills.openFolder")}
        </Button>
      </div>

      {imported && (
        <p className="text-sm" role="status">
          {t("skills.imported", {
            name: imported.name,
            count: imported.fileCount,
          })}
          {imported.scripts.length > 0 &&
            t("skills.importedScripts", {
              scripts: imported.scripts.join(", "),
            })}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
