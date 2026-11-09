// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/paths/paths", () => ({ getUserDataPath: () => holder.dir }));

import { buildMemoryPrompt } from "./prompt";
import {
  findSensitiveData,
  forgetMemory,
  listMemories,
  readMemory,
  saveMemory,
  slugify,
} from "./store";

let project: string;
beforeEach(() => {
  holder.dir = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-mem-"));
  project = path.join(holder.dir, "projet");
  fs.mkdirSync(project);
});

const note = {
  title: "Format des notes",
  description: "Notes en une page",
  type: "feedback" as const,
  body: "Toujours une page maximum, avec un encadré de décisions en haut.",
};

describe("memory store", () => {
  it("saves, lists, reads, updates and forgets, per scope", () => {
    const saved = saveMemory("personal", note);
    expect(saved.id).toBe("format-des-notes");
    expect(listMemories("personal").map((m) => m.title)).toEqual([
      "Format des notes",
    ]);
    expect(listMemories("project", project)).toEqual([]);
    expect(readMemory("personal", saved.id)?.body).toContain("encadré");

    saveMemory("personal", {
      ...note,
      id: saved.id,
      body: "Maximum deux pages.",
    });
    expect(listMemories("personal")).toHaveLength(1);
    expect(readMemory("personal", saved.id)?.body).toBe("Maximum deux pages.");

    saveMemory("project", { ...note, title: "Vocabulaire" }, project);
    expect(
      fs.existsSync(path.join(project, ".cimes", "memory", "vocabulaire.md")),
    ).toBe(true);

    expect(forgetMemory("personal", saved.id)).toBe(true);
    expect(forgetMemory("personal", saved.id)).toBe(false);
  });

  it("never lets an id escape the memory folder", () => {
    expect(() => readMemory("personal", "../secret")).toThrow(
      /Invalid memory id/,
    );
    expect(() => forgetMemory("personal", "a/b")).toThrow();
    expect(slugify("Été : 100 % prêt !")).toBe("ete-100-pret");
  });

  it("refuses personal data and secrets", () => {
    expect(findSensitiveData("écrire à marie.durand@exemple.fr")).toBe(
      "an email address",
    );
    expect(findSensitiveData("appeler le 06 12 34 56 78")).toBe(
      "a phone number",
    );
    expect(findSensitiveData("NIR 2 84 05 75 123 456 78")).toBe(
      "a social security number",
    );
    expect(findSensitiveData("mot de passe : abc")).toBe("a password");
    expect(findSensitiveData("Je préfère des notes courtes")).toBeNull();
    expect(() =>
      saveMemory("personal", { ...note, body: "Mail : paul@x.fr" }),
    ).toThrow(/email address/);
  });

  it("builds an index for the prompt, with both scopes in a project", () => {
    saveMemory("personal", note);
    saveMemory("project", { ...note, title: "Glossaire" }, project);
    const inProject = buildMemoryPrompt(project);
    expect(inProject).toContain("[format-des-notes]");
    expect(inProject).toContain("Project memory:");
    expect(inProject).toContain("[glossaire]");
    expect(buildMemoryPrompt(null)).not.toContain("Project memory:");
    expect(buildMemoryPrompt(null)).toContain("memory_save");
  });
});
