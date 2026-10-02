import { describe, expect, it } from "vitest";
import { buildPreferencesPrompt } from "./prompt";

describe("buildPreferencesPrompt", () => {
  it("is empty when nothing is set", () => {
    expect(buildPreferencesPrompt(undefined)).toBe("");
    expect(buildPreferencesPrompt({})).toBe("");
    expect(
      buildPreferencesPrompt({ documentLanguage: "auto", signature: "  " }),
    ).toBe("");
  });

  it("states each preference once, with the signature and context", () => {
    const out = buildPreferencesPrompt({
      addressForm: "formal",
      register: "administrative",
      length: "concise",
      documentLanguage: "fr",
      service: "Direction de la formation",
      role: "Responsable",
      signature: "Cordialement,\nMarie Durand",
    });
    expect(out).toContain("<user_preferences>");
    expect(out).toContain('formally (French "vous")');
    expect(out).toContain("administrative and institutional");
    expect(out).toContain("keep answers and documents short");
    expect(out).toContain("in French");
    expect(out).toContain("in: Direction de la formation; as: Responsable");
    expect(out).toContain("Cordialement,\nMarie Durand");
    expect(out.match(/<user_preferences>/g)).toHaveLength(1);
  });
});
