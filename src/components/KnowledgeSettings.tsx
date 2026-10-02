import { Button } from "@/components/ui/button";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useSettings } from "@/hooks/useSettings";

const MODES = [
  {
    value: "local" as const,
    title: "Sur ce poste (recommandé)",
    description:
      "Un petit modèle fourni avec Cimes calcule la recherche par le sens sur le processeur. Rien ne quitte le poste ; première analyse un peu longue (quelques passages par seconde).",
  },
  {
    value: "albert" as const,
    title: "Avec Albert",
    description:
      "Envoie des extraits de vos documents à Albert pour calculer les vecteurs : plus rapide, nécessite le réseau.",
  },
  {
    value: "keywords" as const,
    title: "Mots seulement",
    description: "Recherche par les mots de la question, sans analyse du sens.",
  },
];

const STATUS_LABELS = {
  pending: "En attente",
  indexing: "Lecture en cours…",
  ready: "Prêt",
  error: "Erreur",
} as const;

/** Documents the agent can search (PDF, Word, Excel, PowerPoint, texte). */
export function KnowledgeSettings({
  showHeader = true,
}: {
  showHeader?: boolean;
}) {
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
          <h3 className="text-sm font-medium">Base de documents</h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez des documents (PDF, Word, Excel, PowerPoint, Markdown,
            texte). L&apos;agent les consulte avec l&apos;outil « search_docs »
            quand votre question s&apos;y rapporte. Les fichiers restent là où
            ils sont ; Cimes en garde un index sur ce poste.
          </p>
        </div>
      )}

      <fieldset className="space-y-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">
          Recherche par le sens
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
                className="mt-1"
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
                <span className="font-medium">{option.title}</span>
                <span className="block text-muted-foreground">
                  {unavailable
                    ? "Modèle non installé dans cette version."
                    : option.description}
                </span>
              </span>
            </label>
          );
        })}
        {mode !== "keywords" && total > 0 && (
          <p className="text-xs text-muted-foreground">
            {embedded} / {total} extraits analysés.
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
                    : `${STATUS_LABELS[source.status]}${source.status === "ready" ? ` · ${source.chunkCount} extraits` : ""}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reindex.mutate(source.id)}
                >
                  Relire
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(source.id)}
                >
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => add.mutate("files")}>
          Ajouter des fichiers
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => add.mutate("folder")}
        >
          Ajouter un dossier
        </Button>
      </div>
    </div>
  );
}
