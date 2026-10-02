import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildProjectPrompt,
  isProjectPath,
  materializeProject,
  readProjectConfig,
} from "./config";
import { PROJECT_TEMPLATES } from "@/shared/project_templates";

describe("projects config", () => {
  it("materializes a template with folders, readme and config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proj-"));
    const target = path.join(dir, "p");
    expect(isProjectPath(target)).toBe(false);
    const config = materializeProject(target, "formation", "Session mai");
    expect(isProjectPath(target)).toBe(true);
    expect(fs.existsSync(path.join(target, "Documentation"))).toBe(true);
    expect(fs.readFileSync(path.join(target, "LISEZMOI.md"), "utf8")).toContain(
      "Session mai",
    );
    expect(readProjectConfig(target)).toEqual(config);
    expect(config.enabledSkills).toContain("atelier-pedagogique");
    expect(buildProjectPrompt(config, "Session mai")).toContain("search_docs");
  });

  it("falls back to the free template and tolerates a broken config", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "proj-"));
    expect(materializeProject(dir, "inconnu", "X").templateId).toBe("vierge");
    fs.writeFileSync(path.join(dir, ".cimes", "project.json"), "{oops");
    expect(readProjectConfig(dir)).toBeNull();
  });

  it("every template has a Documentation folder and unique id", () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of PROJECT_TEMPLATES)
      expect(t.folders).toContain("Documentation");
  });
});
