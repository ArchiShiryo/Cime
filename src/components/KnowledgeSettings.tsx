import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useKnowledge } from "@/hooks/useKnowledge";
import { useSettings } from "@/hooks/useSettings";

const STATUS_LABELS = {
  pending: "En attente",
  indexing: "Lecture en cours…",
  ready: "Prêt",
  error: "Erreur",
} as const;

/** Documents the agent can search (PDF, Word, Excel, PowerPoint, texte). */
export function KnowledgeSettings() {
  const { sources, add, remove, reindex } = useKnowledge();
  const { settings, updateSettings } = useSettings();
  const useEmbeddings = settings?.knowledgeUseEmbeddings !== false;
  const embedded = sources.reduce((sum, s) => sum + s.embeddedCount, 0);
  const total = sources.reduce((sum, s) => sum + s.chunkCount, 0);

  return (
    <div className="space-y-3" data-testid="knowledge-settings">
      <div>
        <h3 className="text-sm font-medium">Base de documents</h3>
        <p className="text-sm text-muted-foreground">
          Ajoutez des documents (PDF, Word, Excel, PowerPoint, Markdown, texte).
          L&apos;agent les consulte avec l&apos;outil « search_docs » quand
          votre question s&apos;y rapporte. Les fichiers restent là où ils sont
          ; Cimes en garde un index sur ce poste.
        </p>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div>
          <div className="text-sm font-medium">
            Recherche par le sens (Albert)
          </div>
          <p className="text-sm text-muted-foreground">
            Envoie des extraits de vos documents à Albert pour calculer des
            vecteurs de recherche, ce qui trouve aussi les passages qui
            n&apos;ont pas les mêmes mots que la question. Désactivé : recherche
            par mots seulement, rien ne quitte ce poste.
          </p>
          {useEmbeddings && total > 0 && (
            <p className="text-xs text-muted-foreground">
              {embedded} / {total} extraits analysés.
            </p>
          )}
        </div>
        <Switch
          aria-label="Recherche par le sens avec Albert"
          checked={useEmbeddings}
          onCheckedChange={(checked) =>
            updateSettings({ knowledgeUseEmbeddings: checked })
          }
        />
      </div>

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
