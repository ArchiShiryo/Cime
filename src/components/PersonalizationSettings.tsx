import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSettings";
import { MemoryPanel } from "@/components/MemoryPanel";
import type { WritingPreferences } from "@/lib/schemas";

type Key = "addressForm" | "register" | "length" | "documentLanguage";

const CHOICES: Record<Key, readonly string[]> = {
  addressForm: ["formal", "informal"],
  register: ["administrative", "educational", "plain"],
  length: ["concise", "standard", "detailed"],
  documentLanguage: ["auto", "fr", "en"],
};

/** Writing preferences the assistant follows in every conversation. */
export function PersonalizationSettings() {
  const { t } = useTranslation("cimes");
  const { settings, updateSettings } = useSettings();
  const stored = settings?.writingPreferences;
  const [signature, setSignature] = useState(stored?.signature ?? "");
  const [service, setService] = useState(stored?.service ?? "");
  const [role, setRole] = useState(stored?.role ?? "");

  useEffect(() => {
    setSignature(stored?.signature ?? "");
    setService(stored?.service ?? "");
    setRole(stored?.role ?? "");
  }, [stored?.signature, stored?.service, stored?.role]);

  const save = (patch: Partial<WritingPreferences>) =>
    updateSettings({ writingPreferences: { ...stored, ...patch } });

  const choice = (key: Key) => (
    <fieldset className="space-y-1.5" data-testid={`pref-${key}`}>
      <legend className="text-sm font-medium">
        {t(`prefs.${key}.label` as never)}
      </legend>
      <div className="flex flex-wrap gap-2">
        {CHOICES[key].map((value) => {
          const active =
            (stored?.[key] ?? CHOICES[key][key === "length" ? 1 : 0]) === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              data-testid={`pref-${key}-${value}`}
              onClick={() =>
                save({ [key]: value } as Partial<WritingPreferences>)
              }
              className={`rounded-md border px-3 py-1.5 text-sm ${active ? "border-primary bg-accent font-medium" : "hover:bg-accent/50"}`}
            >
              {t(`prefs.${key}.${value}` as never)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-5" data-testid="personalization-settings">
      <p className="text-sm text-muted-foreground">{t("prefs.intro")}</p>
      {choice("addressForm")}
      {choice("register")}
      {choice("length")}
      {choice("documentLanguage")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="pref-service">{t("prefs.service")}</Label>
          <Input
            id="pref-service"
            value={service}
            placeholder={t("prefs.servicePlaceholder")}
            onChange={(e) => setService(e.target.value)}
            onBlur={() =>
              service !== (stored?.service ?? "") && save({ service })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pref-role">{t("prefs.role")}</Label>
          <Input
            id="pref-role"
            value={role}
            placeholder={t("prefs.rolePlaceholder")}
            onChange={(e) => setRole(e.target.value)}
            onBlur={() => role !== (stored?.role ?? "") && save({ role })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="pref-signature">{t("prefs.signature")}</Label>
        <Textarea
          id="pref-signature"
          rows={4}
          value={signature}
          placeholder={t("prefs.signaturePlaceholder")}
          onChange={(e) => setSignature(e.target.value)}
          onBlur={() =>
            signature !== (stored?.signature ?? "") && save({ signature })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("prefs.privacy")}</p>
      <MemoryPanel scope="personal" />
    </div>
  );
}
