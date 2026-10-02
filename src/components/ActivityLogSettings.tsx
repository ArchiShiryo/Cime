import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ipc } from "@/ipc/types";
import { showSuccess } from "@/lib/toast";

const KEY = ["activity", "list"] as const;

/** Recent activity of the agent (tools, turns, errors) to debug a problem or attach to a bug report. */
export function ActivityLogSettings() {
  const { t } = useTranslation("cimes");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const query = useQuery({
    queryKey: [...KEY, errorsOnly],
    queryFn: () => ipc.activity.list({ errorsOnly }),
    refetchOnMount: "always",
  });
  const clear = useMutation({
    mutationFn: () => ipc.activity.clear(),
    onSuccess: () => query.refetch(),
  });
  const events = query.data?.events ?? [];

  const copy = async () => {
    const text = events
      .slice(0, 100)
      .map((e) =>
        [
          e.ts,
          e.kind,
          e.name,
          e.status,
          e.ms !== undefined ? `${e.ms}ms` : "",
          e.detail,
        ]
          .filter(Boolean)
          .join(" | "),
      )
      .join("\n");
    await navigator.clipboard.writeText(text);
    showSuccess(t("activity.copied"));
  };

  return (
    <div className="space-y-3" data-testid="activity-log-settings">
      <div>
        <h3 className="text-sm font-medium">{t("activity.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("activity.intro")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={errorsOnly}
            onChange={(e) => setErrorsOnly(e.target.checked)}
          />
          {t("activity.errorsOnly")}
        </label>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          {t("activity.refresh")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          disabled={events.length === 0}
        >
          {t("activity.copy")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => ipc.activity.openFolder()}
        >
          {t("activity.openFolder")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clear.mutate()}
          disabled={events.length === 0}
        >
          {t("activity.clear")}
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border font-mono text-xs">
          {events.map((event, index) => (
            <li
              key={index}
              className={`flex gap-2 p-2 ${event.status === "error" || event.kind === "error" ? "text-destructive" : ""}`}
            >
              <span className="shrink-0 text-muted-foreground">
                {new Date(event.ts).toLocaleTimeString()}
              </span>
              <span className="shrink-0 font-semibold">
                {event.name ?? event.kind}
              </span>
              {event.status && <span className="shrink-0">{event.status}</span>}
              {event.ms !== undefined && (
                <span className="shrink-0">{event.ms} ms</span>
              )}
              <span className="min-w-0 truncate" title={event.detail}>
                {event.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
