import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useSettings } from "@/hooks/useSettings";

const MODES = [
  { value: "local" as const, key: "modeLocal" as const },
  { value: "albert" as const, key: "modeAlbert" as const },
  { value: "keywords" as const, key: "modeKeywords" as const },
];

/** Documents the agent can search (PDF, Word, Excel, PowerPoint, texte). */
export function KnowledgeSettings({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
  const { t } = useTranslation("cimes");
  const { sources, status, add, remove, reindex, embedPending, refreshStatus } =
    useKnowledge();
  const { settings, updateSettings } = useSettings();
  const mode = settings?.knowledgeEmbeddingMode ?? "local";
  const embedded = sources.reduce((sum, s) => sum + s.embeddedCount, 0);
  const total = sources.reduce((sum, s) => sum + s.chunkCount, 0);

  return (
    <div className="space-y-3" data-testid="knowledge-settings">
      {showHeader && (
        <div>
          <h3 className="text-sm font-medium">{t("documents.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("documents.settingsIntro")}
          </p>
        </div>
      )}

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          {t("documents.semantic")}
        </legend>
        {MODES.map((option) => {
          const unavailable =
            option.value === "local" && status?.localModelInstalled === false;
          return (
            <label
              key={option.value}
              className={`flex items-start gap-2 text-sm ${unavailable ? "opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="knowledge-mode"
                className="mt-1 accent-primary"
                checked={mode === option.value}
                disabled={unavailable}
                onChange={async () => {
                  await updateSettings({
                    knowledgeEmbeddingMode: option.value,
                  });
                  refreshStatus();
                  embedPending.mutate();
                }}
              />
              <span>
                <span className="font-medium">
                  {t(`documents.${option.key}`)}
                </span>
                <span className="block text-muted-foreground">
                  {unavailable
                    ? t("documents.modelMissing")
                    : t(`documents.${option.key}Help`)}
                </span>
              </span>
            </label>
          );
        })}
        {mode !== "keywords" && total > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("documents.analysed", { done: embedded, total })}
          </p>
        )}
      </fieldset>

      {sources.length > 0 && (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex items-start justify-between gap-3 p-3"
              data-testid={`knowledge-${source.name}`}
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
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reindex.mutate(source.id)}
                >
                  {t("documents.reread")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(source.id)}
                >
                  {t("documents.remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add.mutate("files")}>
          {t("documents.addFiles")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => add.mutate("folder")}
        >
          {t("documents.addFolder")}
        </Button>
      </div>
    </div>
  );
}
