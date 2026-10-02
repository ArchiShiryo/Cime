import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKnowledge } from "@/hooks/useKnowledge";

/** Try the document search yourself: shows the passages the agent would receive. */
export function KnowledgeSearchBox() {
  const { search, sources } = useKnowledge();
  const [query, setQuery] = useState("");
  const hits = search.data;
  const run = () => {
    if (query.trim()) search.mutate(query);
  };

  return (
    <div className="space-y-3" data-testid="knowledge-search">
      <div>
        <h3 className="text-sm font-medium">Tester la recherche</h3>
        <p className="text-sm text-muted-foreground">
          Posez une question : voici les extraits que l&apos;agent recevrait.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Par exemple : que dit le règlement sur les tablettes ?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") run();
          }}
          disabled={sources.length === 0}
        />
        <Button
          onClick={run}
          disabled={sources.length === 0 || search.isPending || !query.trim()}
        >
          Chercher
        </Button>
      </div>
      {search.isError && (
        <p className="text-sm text-destructive">
          {search.error instanceof Error ? search.error.message : "Erreur"}
        </p>
      )}
      {hits && hits.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun extrait trouvé. Essayez d&apos;autres mots.
        </p>
      )}
      {hits && hits.length > 0 && (
        <ol className="space-y-2" data-testid="knowledge-hits">
          {hits.map((hit, index) => (
            <li key={index} className="rounded-md border p-3 text-sm">
              <div className="mb-1 text-xs text-muted-foreground">
                {hit.source}
                {hit.location ? ` · ${hit.location}` : ""}
              </div>
              <p className="whitespace-pre-wrap">{hit.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
