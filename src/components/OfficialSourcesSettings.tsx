import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { ipc } from "@/ipc/types";

const PISTE_URL = "https://piste.gouv.fr";

/** Official public data the agent can query. Five sources need no key; Légifrance needs PISTE credentials. */
export function OfficialSourcesSettings() {
  const { t } = useTranslation("cimes");
  const { settings, updateSettings } = useSettings();
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const configured = Boolean(
    settings?.pisteClientId && settings?.pisteClientSecret,
  );

  useEffect(() => {
    setClientId(settings?.pisteClientId ?? "");
  }, [settings?.pisteClientId]);

  const save = async () => {
    await updateSettings({
      pisteClientId: clientId.trim() || undefined,
      ...(secret.trim()
        ? {
            pisteClientSecret: {
              value: secret.trim(),
              encryptionType: "plaintext" as const,
            },
          }
        : {}),
    });
    setSecret("");
  };
  const clear = async () => {
    await updateSettings({
      pisteClientId: undefined,
      pisteClientSecret: undefined,
    });
    setClientId("");
    setSecret("");
  };

  return (
    <div className="space-y-3" data-testid="official-sources-settings">
      <div>
        <h3 className="text-sm font-medium">{t("official.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("official.intro")}</p>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <div className="text-sm font-medium">
          {t("official.legifrance")}{" "}
          <span
            className={
              configured
                ? "font-normal text-primary"
                : "font-normal text-muted-foreground"
            }
          >
            {configured ? t("official.enabled") : t("official.disabled")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("official.legifranceHelp")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="piste-client-id">{t("official.clientId")}</Label>
            <Input
              id="piste-client-id"
              autoComplete="off"
              spellCheck={false}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="piste-client-secret">
              {t("official.clientSecret")}
            </Label>
            <Input
              id="piste-client-secret"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={configured ? "••••••••" : ""}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={save}
            disabled={!clientId.trim() && !secret.trim()}
          >
            {t("official.save")}
          </Button>
          {configured && (
            <Button size="sm" variant="outline" onClick={clear}>
              {t("official.remove")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => ipc.system.openExternalUrl(PISTE_URL)}
          >
            {t("official.getKeys")}
          </Button>
        </div>
      </div>
    </div>
  );
}
