import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";

/**
 * Optional SearXNG server for the agent's web search. Left empty, the agent
 * searches DuckDuckGo (then Bing) without any key, which can be rate-limited on
 * a shared school connection; a SearXNG server avoids that.
 */
export function WebSearchSettings() {
  const { t } = useTranslation("cimes");
  const { settings, updateSettings } = useSettings();
  const stored = settings?.webSearchSearxngUrl ?? "";
  const [value, setValue] = useState(stored);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setValue(stored), [stored]);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === stored) return;
    if (trimmed && !/^https?:\/\/\S+$/i.test(trimmed)) {
      setError(t("webSearch.invalid"));
      return;
    }
    setError(null);
    await updateSettings({ webSearchSearxngUrl: trimmed || undefined });
  };

  return (
    <div className="space-y-1.5" data-testid="web-search-settings">
      <Label htmlFor="web-search-searxng-url">{t("webSearch.label")}</Label>
      <Input
        id="web-search-searxng-url"
        type="url"
        placeholder={t("webSearch.placeholder")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">{t("webSearch.help")}</p>
    </div>
  );
}
