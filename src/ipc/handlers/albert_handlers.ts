import { createTypedHandler } from "./base";
import { albertContracts } from "../types/albert";
import {
  connectAlbert,
  disconnectAlbert,
  ensureAlbertProvider,
  getAlbertStatus,
  testAlbertConnection,
} from "../services/albert_service";

export function registerAlbertHandlers() {
  createTypedHandler(albertContracts.getStatus, async () => {
    ensureAlbertProvider();
    return getAlbertStatus();
  });
  createTypedHandler(albertContracts.connect, async (_event, { apiKey }) =>
    connectAlbert(apiKey),
  );
  createTypedHandler(albertContracts.testConnection, async () => {
    await testAlbertConnection();
    return { ok: true as const };
  });
  createTypedHandler(albertContracts.disconnect, async () =>
    disconnectAlbert(),
  );
}
