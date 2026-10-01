import type { ChatMode } from "./schemas";
import { PAID_FEATURES_ENABLED } from "@/shared/branding";

export function getChatModeDisplayName(mode: ChatMode, isPro: boolean): string {
  switch (mode) {
    case "build":
      return "Build";
    case "ask":
      return "Ask";
    case "local-agent":
      return isPro || !PAID_FEATURES_ENABLED ? "Agent" : "Basic Agent";
    case "plan":
      return "Plan";
  }
}
