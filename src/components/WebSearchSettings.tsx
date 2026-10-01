import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";

/**
 * Optional SearXNG server for the agent's web search. Left empty, the agent
 * searches DuckDuckGo (then Bing) without any key, which can be rate-limited on
 * a shared school connection; a SearXNG server avoids that.
 */
export function WebSearchSettings() {
  const { settings, updateSettings } = useSettings();
  const stored = settings?.webSearchSearxngUrl ?? "";
  const [value, setValue] = useState(stored);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(stored), [stored]);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === stored) return;
    if (trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      setError(
        "Entrez une adresse complète, par exemple https://search.exemple.fr",
      );
      return;
    }
    setError(null);
    await updateSettings({ webSearchSearxngUrl: trimmed || undefined });
  };

  return (
    <div className="space-y-1.5" data-testid="web-search-settings">
      <Label htmlFor="web-search-searxng-url">
        Serveur de recherche web (SearXNG)
      </Label>
      <Input
        id="web-search-searxng-url"
        type="url"
        placeholder="https://search.exemple.fr (optionnel)"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">
        Laissé vide, l&apos;agent cherche sur DuckDuckGo puis Bing, sans clé. Si
        votre établissement dispose d&apos;un serveur SearXNG (format JSON
        activé), indiquez-le ici : les recherches seront plus fiables.
      </p>
    </div>
  );
}
