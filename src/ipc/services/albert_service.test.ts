import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeSettings = vi.fn();
const readSettings = vi.fn();

vi.mock("electron-log", () => {
  const scoped = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { scope: () => scoped } };
});
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/main/settings", () => ({
  readSettings: () => readSettings(),
  writeSettings: (s: unknown) => writeSettings(s),
}));

import { DyadErrorKind } from "@/errors/dyad_error";
import {
  ALBERT_MAX_OUTPUT_TOKENS,
  ALBERT_CONTEXT_WINDOW,
  ALBERT_MODEL_ID,
  ALBERT_PROVIDER_ID,
} from "@/shared/albert";
import * as service from "./albert_service";

const KEY = "sk-test-key";

function modelsResponse(ids: string[], status = 200) {
  return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), {
    status,
  });
}

describe("albert_service", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    readSettings.mockReturnValue({ providerSettings: {} });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    writeSettings.mockReset();
  });

  it("keeps output tokens far below the context window", () => {
    expect(ALBERT_MAX_OUTPUT_TOKENS).toBe(8192);
    expect(ALBERT_CONTEXT_WINDOW).toBe(131072);
  });

  it("accepts a key when /v1/models is 200 and lists the model", async () => {
    fetchMock.mockResolvedValue(modelsResponse([ALBERT_MODEL_ID, "other"]));
    await expect(service.validateAlbertApiKey(KEY)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://albert.api.etalab.gouv.fr/v1/models");
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("rejects a key when the default model is not listed", async () => {
    fetchMock.mockResolvedValue(modelsResponse(["other"]));
    await expect(service.validateAlbertApiKey(KEY)).rejects.toMatchObject({
      kind: DyadErrorKind.Precondition,
    });
  });

  it("reports an invalid key on 401", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(service.validateAlbertApiKey(KEY)).rejects.toMatchObject({
      kind: DyadErrorKind.Auth,
      message: expect.stringContaining("n'est pas valide"),
    });
  });

  it("reports an unreachable Albert on network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(service.validateAlbertApiKey(KEY)).rejects.toMatchObject({
      kind: DyadErrorKind.Precondition,
      message: expect.stringContaining("Impossible de joindre Albert"),
    });
  });

  it("rejects an empty key without calling the network", async () => {
    await expect(service.validateAlbertApiKey("  ")).rejects.toMatchObject({
      kind: DyadErrorKind.Validation,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never leaks the key in the error message", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(service.validateAlbertApiKey(KEY)).rejects.toSatisfy(
      (e: Error) => !e.message.includes(KEY),
    );
  });

  it("does not write settings when validation fails", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(service.connectAlbert(KEY)).rejects.toBeTruthy();
    expect(writeSettings).not.toHaveBeenCalled();
  });

  it("reports status from the stored key", () => {
    readSettings.mockReturnValue({
      providerSettings: { [ALBERT_PROVIDER_ID]: { apiKey: { value: KEY } } },
    });
    expect(service.getAlbertStatus()).toMatchObject({ connected: true });
    readSettings.mockReturnValue({ providerSettings: {} });
    expect(service.getAlbertStatus()).toMatchObject({ connected: false });
  });

  it("does not treat an ALBERT_API_KEY environment variable as connected", () => {
    vi.stubEnv("ALBERT_API_KEY", "sk-from-env");
    readSettings.mockReturnValue({ providerSettings: {} });
    expect(service.getAlbertStatus()).toMatchObject({
      connected: false,
      fromEnvironment: true,
    });
    vi.unstubAllEnvs();
  });
});
