import { describe, expect, it, vi } from "vitest";
import {
  isShellExperimentAvailable,
  shellExecutionGuidance,
} from "./shell_capability";

// Upstream behavior is tested with paid features on; Cimes cases flip it.
const branding = vi.hoisted(() => ({ paid: true }));
vi.mock("@/shared/branding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/branding")>()),
  get PAID_FEATURES_ENABLED() {
    return branding.paid;
  },
}));

const eligible = { settings: { enableShellTool: true }, isDyadPro: true };
describe("shell experiment eligibility", () => {
  it("allows opted-in Pro root Agent on host", () =>
    expect(isShellExperimentAvailable(eligible)).toBe(true));
  it.each([
    { settings: {} },
    { isDyadPro: false },
    { freeModelMode: true },
    { readOnly: true },
    { planModeOnly: true },
    { toolProfile: "build" as const },
    { isChild: true },
    { settings: { enableShellTool: true, runtimeMode2: "docker" as const } },
    { settings: { enableShellTool: true, runtimeMode2: "cloud" as const } },
    {
      settings: {
        enableShellTool: true,
        agentToolConsents: { run_shell: "never" as const },
      },
    },
  ])("denies incompatible context %j", (override) =>
    expect(isShellExperimentAvailable({ ...eligible, ...override })).toBe(
      false,
    ),
  );
  it("is on by default in Cimes, without Pro, but still honors refusals", () => {
    branding.paid = false;
    try {
      expect(
        isShellExperimentAvailable({ settings: {}, isDyadPro: false }),
      ).toBe(true);
      expect(
        isShellExperimentAvailable({
          settings: { enableShellTool: false },
          isDyadPro: false,
        }),
      ).toBe(false);
      expect(
        isShellExperimentAvailable({
          settings: { agentToolConsents: { run_shell: "never" } },
          isDyadPro: false,
        }),
      ).toBe(false);
      expect(
        isShellExperimentAvailable({
          settings: { runtimeMode2: "docker" },
          isDyadPro: false,
        }),
      ).toBe(false);
      expect(
        isShellExperimentAvailable({
          settings: {},
          isDyadPro: false,
          readOnly: true,
        }),
      ).toBe(false);
    } finally {
      branding.paid = true;
    }
  });
  it("names the platform shell and execution limits", () => {
    expect(shellExecutionGuidance("win32", "C:\\App")).toContain(
      "Use PowerShell syntax, not Bash or cmd.exe syntax",
    );
    const bash = shellExecutionGuidance("darwin", "/app");
    expect(bash).toContain("Bash, without startup profiles");
    expect(bash).toContain('"/app"');
    expect(bash).toContain("maximum five minutes");
  });
});
