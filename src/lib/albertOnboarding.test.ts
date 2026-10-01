import { describe, expect, it } from "vitest";
import { shouldShowAlbertOnboarding } from "./albertOnboarding";

const status = (connected: boolean, fromEnvironment = false) => ({
  connected,
  fromEnvironment,
  modelDisplayName: "DeepSeek V4 Flash - Albert",
});
const base = {
  settingsLoaded: true,
  isTestMode: false,
  status: undefined,
  statusError: false,
};

describe("shouldShowAlbertOnboarding", () => {
  it("asks for the key while none is saved", () => {
    expect(shouldShowAlbertOnboarding({ ...base, status: status(false) })).toBe(
      true,
    );
  });

  it("still asks when only an environment variable provides a key", () => {
    expect(
      shouldShowAlbertOnboarding({ ...base, status: status(false, true) }),
    ).toBe(true);
  });

  it("asks when the status check fails", () => {
    expect(shouldShowAlbertOnboarding({ ...base, statusError: true })).toBe(
      true,
    );
  });

  it("does not ask once a key is saved", () => {
    expect(shouldShowAlbertOnboarding({ ...base, status: status(true) })).toBe(
      false,
    );
  });

  it("waits for settings and stays out of test builds", () => {
    const disconnected = { ...base, status: status(false) };
    expect(
      shouldShowAlbertOnboarding({ ...disconnected, settingsLoaded: false }),
    ).toBe(false);
    expect(
      shouldShowAlbertOnboarding({ ...disconnected, isTestMode: true }),
    ).toBe(false);
  });
});
