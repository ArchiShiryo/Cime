/**
 * fetch that honors the operating system's network configuration (proxy
 * settings, PAC files, corporate certificates) by going through Electron's
 * network stack. Node's built-in fetch ignores the Windows proxy, which breaks
 * model calls on school networks that require one.
 *
 * Outside Electron (unit tests, scripts) it falls back to the global fetch.
 */
import { net } from "electron";
import type { FetchFunction } from "@ai-sdk/provider-utils";

function getElectronNet(): typeof net | null {
  if (process.env.VITEST || !process.versions.electron) return null;
  return net ?? null;
}

export const systemFetch: FetchFunction = (input, init) => {
  const net = getElectronNet();
  if (net && typeof input === "string") {
    return net.fetch(input, init as RequestInit);
  }
  if (net && input instanceof URL) {
    return net.fetch(input.toString(), init as RequestInit);
  }
  return fetch(input, init);
};
