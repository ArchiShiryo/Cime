import { ModelPicker } from "./ModelPicker";
import { PAID_FEATURES_ENABLED } from "@/shared/branding";
import { ProModeSelector } from "./ProModeSelector";
import { ChatModeSelector } from "./ChatModeSelector";

export function ChatInputControls() {
  return (
    <div className="flex items-center">
      <ChatModeSelector />
      <div className="w-1.5"></div>
      <ModelPicker />
      {PAID_FEATURES_ENABLED && <ProModeSelector />}
    </div>
  );
}
