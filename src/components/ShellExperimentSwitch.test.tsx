import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellExperimentSwitch } from "./ShellExperimentSwitch";
// Upstream behavior is tested with paid features on; Cimes cases flip it.
const branding = vi.hoisted(() => ({ paid: true }));
vi.mock("@/shared/branding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/branding")>()),
  get PAID_FEATURES_ENABLED() {
    return branding.paid;
  },
}));
const mocks = vi.hoisted(() => ({ pro: true, updateSettings: vi.fn() }));
vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      enableShellTool: false,
      enableDyadPro: mocks.pro,
      providerSettings: { auto: { apiKey: { value: "test" } } },
    },
    updateSettings: mocks.updateSettings,
  }),
}));
afterEach(() => {
  cleanup();
  mocks.pro = true;
  mocks.updateSettings.mockClear();
});
describe("Shell tool in Cimes", () => {
  it("is on by default, usable without Pro, and not labelled Pro", () => {
    branding.paid = false;
    mocks.pro = false;
    try {
      render(<ShellExperimentSwitch />);
      const toggle = screen.getByRole("switch", { name: "Shell tool" });
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(toggle.hasAttribute("disabled")).toBe(false);
      expect(screen.queryByText(/Pro/)).toBeNull();
      expect(screen.getByText(/asks for your approval/)).toBeTruthy();
    } finally {
      branding.paid = true;
    }
  });
});

describe("Shell experiment", () => {
  it("persists the top-level setting", () => {
    render(<ShellExperimentSwitch />);
    fireEvent.click(screen.getByRole("switch", { name: "Shell tool (Pro)" }));
    expect(mocks.updateSettings).toHaveBeenCalledWith({
      enableShellTool: true,
    });
  });
  it("does not allow non-Pro users to enable it", () => {
    mocks.pro = false;
    render(<ShellExperimentSwitch />);
    fireEvent.click(screen.getByRole("switch", { name: "Shell tool (Pro)" }));
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });
});

it("explains automatic host execution and fallible AI review before opting in", () => {
  render(<ShellExperimentSwitch />);
  expect(
    screen.getByText(/Enabling this experiment carries risk/).textContent,
  ).toContain("an AI safety review can make mistakes");
  expect(
    screen.getByText(/Enabling this experiment carries risk/).textContent,
  ).toContain("run automatically");
  expect(
    screen.getByText(/Enabling this experiment carries risk/).textContent,
  ).toContain("run_shell consent to Ask");
});
