// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

describe("Cimes makes no call to Dyad servers", () => {
  it("serves every catalog from local data without touching the network", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network call");
    });
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { getBuiltinLanguageModelCatalog } =
      await import("@/ipc/shared/remote_language_model_catalog");
    const { getRemoteDesktopConfig } =
      await import("@/ipc/shared/remote_desktop_config");
    const { getRemoteMcpCatalog } =
      await import("@/ipc/shared/remote_mcp_catalog");
    const { fetchApiTemplates } = await import("@/ipc/utils/template_utils");

    expect((await getBuiltinLanguageModelCatalog()).source).toBe("fallback");
    expect(await getRemoteDesktopConfig()).toBeNull();
    expect((await getRemoteMcpCatalog()).length).toBeGreaterThan(0);
    expect(await fetchApiTemplates()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
