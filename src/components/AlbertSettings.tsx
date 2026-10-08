import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlbert } from "@/hooks/useAlbert";

export function AlbertSettings() {
  const { t } = useTranslation("cimes");
  const { status, connect, testConnection, disconnect } = useAlbert();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const connected = status?.connected ?? false;

  const save = async () => {
    try {
      await connect.mutateAsync(apiKey);
      setApiKey("");
      setEditing(false);
      toast.success(t("albert.connected"));
    } catch {
      // Error shown inline below; keep the input.
    }
  };

  const test = async () => {
    try {
      await testConnection.mutateAsync();
      toast.success(t("albert.connected"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-3" data-testid="albert-settings">
      <div className="text-sm">
        <div className="font-medium">{t("albert.name")}</div>
        <div className="text-muted-foreground">
          {t("albert.state")}{" "}
          {connected ? (
            <span className="font-medium text-primary">
              {t("albert.stateConnected")}
            </span>
          ) : (
            t("albert.stateDisconnected")
          )}
          {status
            ? ` · ${t("albert.model", { name: status.modelDisplayName })}`
            : ""}
        </div>
        {!connected && status?.fromEnvironment && (
          <div className="text-xs text-muted-foreground">
            {t("albert.envKey")}
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("albert.apiKey")}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={connect.isPending}
          />
          {connect.error && (
            <p className="whitespace-pre-line text-sm text-destructive">
              {connect.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={save}
              disabled={!apiKey.trim() || connect.isPending}
            >
              {connect.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {t("albert.save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setApiKey("");
                connect.reset();
              }}
            >
              {t("albert.cancel")}
            </Button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          {connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={test}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {t("albert.test")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {connected ? t("albert.editKey") : t("albert.connectAlbert")}
          </Button>
          {connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {t("albert.disconnect")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
