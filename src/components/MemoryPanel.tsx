import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ipc } from "@/ipc/types";
import { showError } from "@/lib/toast";

type Type = "user" | "feedback" | "project" | "reference";
const TYPES: Type[] = ["user", "feedback", "project", "reference"];

interface Draft {
  id?: string;
  title: string;
  description: string;
  type: Type;
  body: string;
}
const EMPTY: Draft = { title: "", description: "", type: "user", body: "" };

/** What the assistant remembers between conversations: personal, or about one project. */
export function MemoryPanel({
  scope,
  appId,
}: {
  scope: "personal" | "project";
  appId?: number;
}) {
  const { t } = useTranslation("cimes");
  const queryClient = useQueryClient();
  const key = ["memory", scope, appId ?? null] as const;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: key,
    queryFn: () => ipc.memory.list({ scope, appId }),
    refetchOnMount: "always",
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const save = useMutation({
    mutationFn: (d: Draft) => ipc.memory.save({ scope, appId, ...d }),
    onSuccess: () => {
      setDraft(null);
      void refresh();
    },
    onError: (e) => showError(e),
  });
  const forget = useMutation({
    mutationFn: (id: string) => ipc.memory.forget({ scope, appId, id }),
    onSuccess: () => {
      setConfirmId(null);
      void refresh();
    },
    onError: (e) => showError(e),
  });

  const edit = async (id: string) => {
    const doc = await ipc.memory.read({ scope, appId, id });
    if (doc)
      setDraft({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        type: doc.type,
        body: doc.body,
      });
  };
  const entries = list.data ?? [];

  return (
    <div className="space-y-3" data-testid={`memory-${scope}`}>
      <div>
        <h3 className="text-sm font-medium">
          {t(`memory.${scope}Title` as never)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(`memory.${scope}Intro` as never)}
        </p>
      </div>
      {entries.length === 0 && !draft && (
        <p className="text-sm text-muted-foreground">{t("memory.empty")}</p>
      )}
      {entries.length > 0 && (
        <ul className="divide-y rounded-md border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 p-3"
              data-testid={`memory-item-${entry.id}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entry.title}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {t(`memory.types.${entry.type}` as never)}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {entry.description}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void edit(entry.id)}
                >
                  {t("memory.edit")}
                </Button>
                {confirmId === entry.id ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => forget.mutate(entry.id)}
                  >
                    {t("memory.confirmForget")}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmId(entry.id)}
                  >
                    {t("memory.forget")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <div
          className="space-y-2 rounded-md border p-3"
          data-testid="memory-editor"
        >
          <Input
            value={draft.title}
            placeholder={t("memory.titlePlaceholder")}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Input
            value={draft.description}
            placeholder={t("memory.descriptionPlaceholder")}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
          <div className="flex flex-wrap gap-2">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={draft.type === type}
                onClick={() => setDraft({ ...draft, type })}
                className={`rounded-md border px-2.5 py-1 text-xs ${draft.type === type ? "border-primary bg-accent font-medium" : "hover:bg-accent/50"}`}
              >
                {t(`memory.types.${type}` as never)}
              </button>
            ))}
          </div>
          <Textarea
            rows={5}
            value={draft.body}
            placeholder={t("memory.bodyPlaceholder")}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("memory.warning")}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={
                !draft.title.trim() || !draft.body.trim() || save.isPending
              }
              onClick={() => save.mutate(draft)}
            >
              {t("memory.save")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              {t("memory.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDraft(EMPTY)}
          data-testid="memory-add"
        >
          {t("memory.add")}
        </Button>
      )}
    </div>
  );
}
