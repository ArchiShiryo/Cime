import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { isDyadProEnabled } from "@/lib/schemas";
import { PAID_FEATURES_ENABLED } from "@/shared/branding";

export function ShellExperimentSwitch() {
  const { settings, updateSettings } = useSettings();
  const isPro = !!settings && isDyadProEnabled(settings);
  const available = isPro || !PAID_FEATURES_ENABLED;
  const label = PAID_FEATURES_ENABLED ? "Shell tool (Pro)" : "Shell tool";
  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-2">
        <Switch
          id="enable-shell-tool"
          aria-label={label}
          checked={settings?.enableShellTool ?? !PAID_FEATURES_ENABLED}
          disabled={!available}
          onCheckedChange={(checked) =>
            updateSettings({ enableShellTool: checked })
          }
        />
        <Label htmlFor="enable-shell-tool">{label}</Label>
      </div>
      <div className="text-sm text-muted-foreground">
        {PAID_FEATURES_ENABLED
          ? "Allow Agent mode to run Bash on macOS/Linux or PowerShell on Windows for app tasks and connected cloud services. Every command is reviewed using Pro credits. Enabling this experiment carries risk: commands run on your machine without filesystem isolation, and an AI safety review can make mistakes. Commands classified as safe run automatically unless you set run_shell consent to Ask. Consequential commands may require your approval; clear safety violations are blocked. Available only with the Host runtime."
          : "Allow Agent mode to run PowerShell commands (Windows) or Bash (macOS/Linux) for app tasks. Cimes shows you each command and asks for your approval before running it; the command is also checked by the AI model beforehand. Commands run on your computer without filesystem isolation, and an AI check can make mistakes, so read each command before approving. Available only with the Host runtime."}
      </div>
    </div>
  );
}
