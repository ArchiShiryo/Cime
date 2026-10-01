import type { AlbertStatus } from "@/ipc/types";

/**
 * Cimes requires an Albert key: ask for it until one is saved in Cimes,
 * whatever other providers or environment variables exist. A failed status
 * check also asks, rather than dropping the user into an unconfigured app.
 */
export function shouldShowAlbertOnboarding({
  settingsLoaded,
  isTestMode,
  status,
  statusError,
}: {
  settingsLoaded: boolean;
  isTestMode: boolean;
  status: AlbertStatus | undefined;
  statusError: boolean;
}): boolean {
  if (!settingsLoaded || isTestMode) return false;
  if (status) return !status.connected;
  return statusError;
}
