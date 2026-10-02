import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron-log", () => ({
  default: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));
vi.mock("@/paths/paths", () => ({ getUserDataPath: () => os.tmpdir() }));

import { parseSkillMd } from "./parse";
import {
  type Skill,
  discoverSkills,
  listSkillFiles,
  resolveSkillFile,
} from "./registry";
import {
  buildAvailableSkillsPrompt,
  expandSkillInvocation,
  substituteSkillVariables,
} from "./prompt";
import { BUILTIN_SKILLS } from "./builtin";

const SKILL = `---
name: demo-skill
description: Does a demo.
allowed-tools: Read, Bash
unknown-field: ignored
---
# Demo
Run \${CLAUDE_SKILL_DIR}/scripts/go.sh $ARGUMENTS
`;

describe("parseSkillMd", () => {
  it("parses a Claude skill and ignores unknown fields", () => {
    const result = parseSkillMd(SKILL, "demo-skill");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skill.name).toBe("demo-skill");
    expect(result.skill.allowedTools).toEqual(["Read", "Bash"]);
    expect(result.skill.body.startsWith("# Demo")).toBe(true);
  });

  it("handles BOM and CRLF", () => {
    const result = parseSkillMd("﻿" + SKILL.replace(/\n/g, "\r\n"));
    expect(result.ok).toBe(true);
  });

  it("rejects missing frontmatter, bad names and empty descriptions", () => {
    expect(parseSkillMd("# no frontmatter").ok).toBe(false);
    expect(
      parseSkillMd("---\nname: Bad Name\ndescription: x\n---\nbody").ok,
    ).toBe(false);
    expect(parseSkillMd("---\nname: ok\n---\nbody").ok).toBe(false);
    expect(parseSkillMd("---\njust text\n---\nx").ok).toBe(false);
  });

  it("falls back to the folder name", () => {
    const result = parseSkillMd("---\ndescription: d\n---\nb", "from-dir");
    expect(result.ok && result.skill.name).toBe("from-dir");
  });
});

describe("builtin skills", () => {
  it("ships the four Canopé skills", () => {
    expect(BUILTIN_SKILLS.map((s) => s.name).sort()).toEqual([
      "accessibilite-rgaa",
      "app-web-simple",
      "atelier-pedagogique",
      "charte-canope",
    ]);
  });
});

describe("discoverSkills", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-skills-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const write = (dir: string, content = SKILL) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), content);
  };

  it("finds user and app skills, app overrides user, disabled are hidden", async () => {
    const userDir = path.join(root, "user");
    const appDir = path.join(root, "app");
    write(path.join(userDir, "demo-skill"));
    write(
      path.join(appDir, ".claude", "skills", "demo-skill"),
      SKILL.replace("Does a demo.", "App version."),
    );
    write(
      path.join(appDir, ".cimes", "skills", "other"),
      SKILL.replace("demo-skill", "other"),
    );
    const skills = await discoverSkills({
      appPath: appDir,
      userSkillsDir: userDir,
    });
    const demo = skills.find((s) => s.name === "demo-skill")!;
    expect(demo.origin).toBe("app");
    expect(demo.description).toBe("App version.");
    expect(skills.some((s) => s.name === "other")).toBe(true);
    const hidden = await discoverSkills({
      appPath: appDir,
      userSkillsDir: userDir,
      disabled: ["other"],
    });
    expect(hidden.some((s) => s.name === "other")).toBe(false);
  });

  it("skips invalid skills without failing", async () => {
    write(path.join(root, "user", "broken"), "no frontmatter");
    const skills = await discoverSkills({
      userSkillsDir: path.join(root, "user"),
    });
    expect(skills.some((s) => s.name === "broken")).toBe(false);
  });

  it("lists bundled files and refuses path traversal and symlink escape", async () => {
    const dir = path.join(root, "user", "demo-skill");
    write(dir);
    fs.mkdirSync(path.join(dir, "references"));
    fs.writeFileSync(path.join(dir, "references", "a.md"), "A");
    fs.writeFileSync(path.join(root, "secret.txt"), "secret");
    try {
      fs.symlinkSync(path.join(root, "secret.txt"), path.join(dir, "link.txt"));
    } catch {
      // symlinks may be unavailable (Windows without privileges)
    }
    const [skill] = (
      await discoverSkills({ userSkillsDir: path.join(root, "user") })
    ).filter((s) => s.name === "demo-skill");
    expect(await listSkillFiles(skill)).toContain("references/a.md");
    expect(await resolveSkillFile(skill, "references/a.md")).not.toBeNull();
    expect(await resolveSkillFile(skill, "../../secret.txt")).toBeNull();
    expect(await resolveSkillFile(skill, "link.txt")).toBeNull();
    expect(await resolveSkillFile(skill, "missing.md")).toBeNull();
  });
});

describe("prompt helpers", () => {
  const parsed = parseSkillMd(SKILL, "demo-skill");
  if (!parsed.ok) throw new Error(parsed.error);
  const skill: Skill = {
    ...parsed.skill,
    origin: "user",
    dir: "/skills/demo-skill",
  };

  it("lists only names and descriptions, never bodies", () => {
    const prompt = buildAvailableSkillsPrompt([skill]);
    expect(prompt).toContain("demo-skill: Does a demo.");
    expect(prompt).not.toContain("# Demo");
    expect(buildAvailableSkillsPrompt([])).toBe("");
  });

  it("hides model-disabled skills from the list but allows /name", () => {
    const hidden = { ...skill, disableModelInvocation: true };
    expect(buildAvailableSkillsPrompt([hidden])).toBe("");
    expect(expandSkillInvocation("/demo-skill x", [hidden])).toContain(
      "# Demo",
    );
  });

  it("expands /name with arguments and the skill dir", () => {
    const text = expandSkillInvocation("/demo-skill hello world", [skill])!;
    expect(text).toContain("/skills/demo-skill/scripts/go.sh hello world");
    expect(expandSkillInvocation("/unknown", [skill])).toBeNull();
    expect(expandSkillInvocation("not a command", [skill])).toBeNull();
    expect(
      expandSkillInvocation("/demo-skill", [
        { ...skill, userInvocable: false },
      ]),
    ).toBeNull();
  });

  it("substitutes both variable spellings", () => {
    expect(
      substituteSkillVariables("$CLAUDE_SKILL_DIR ${CIMES_SKILL_DIR}", "/d"),
    ).toBe("/d /d");
  });
});

import { zipSync, strToU8 } from "fflate";
import {
  deleteUserSkill,
  importSkillFromPath,
  installSkillFiles,
  normalizeEntryPath,
  unzipSkillArchive,
} from "./import";

describe("skill import", () => {
  let dest: string;
  beforeEach(() => {
    dest = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-import-"));
  });
  afterEach(() => fs.rmSync(dest, { recursive: true, force: true }));

  it("normalizes entry paths and rejects traversal", () => {
    expect(normalizeEntryPath("a/b.md")).toBe("a/b.md");
    expect(normalizeEntryPath("a\\b.md")).toBe("a/b.md");
    expect(normalizeEntryPath("../x")).toBeNull();
    expect(normalizeEntryPath("a/../../x")).toBeNull();
    expect(normalizeEntryPath("/etc/passwd")).toBeNull();
    expect(normalizeEntryPath("C:/x")).toBeNull();
  });

  it("imports a zip with a wrapper folder and reports scripts", async () => {
    const zip = zipSync({
      "demo-skill/SKILL.md": strToU8(SKILL),
      "demo-skill/scripts/go.sh": strToU8("echo hi"),
      "demo-skill/references/a.md": strToU8("A"),
    });
    const zipPath = path.join(dest, "demo.skill");
    fs.writeFileSync(zipPath, zip);
    const result = await importSkillFromPath(
      zipPath,
      path.join(dest, "skills"),
    );
    expect(result.name).toBe("demo-skill");
    expect(result.scripts).toEqual(["scripts/go.sh"]);
    expect(
      fs.existsSync(
        path.join(dest, "skills", "demo-skill", "references", "a.md"),
      ),
    ).toBe(true);
    await deleteUserSkill("demo-skill", path.join(dest, "skills"));
    expect(fs.existsSync(path.join(dest, "skills", "demo-skill"))).toBe(false);
  });

  it("refuses zip-slip entries, non-zip files and skills without SKILL.md", async () => {
    const evil = zipSync({
      "SKILL.md": strToU8(SKILL),
      "../escape.txt": strToU8("x"),
    });
    expect(() => unzipSkillArchive(evil)).toThrow(/Unsafe path/);
    expect(() => unzipSkillArchive(new Uint8Array([1, 2, 3]))).toThrow(/zip/);
    await expect(
      installSkillFiles(new Map([["readme.md", new Uint8Array([1])]]), dest),
    ).rejects.toThrow(/SKILL.md/);
  });

  it("imports a folder and ignores symlinks", async () => {
    const src = path.join(dest, "src");
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, "SKILL.md"), SKILL);
    fs.writeFileSync(path.join(dest, "outside.txt"), "secret");
    try {
      fs.symlinkSync(
        path.join(dest, "outside.txt"),
        path.join(src, "link.txt"),
      );
    } catch {
      // symlinks may be unavailable
    }
    const result = await importSkillFromPath(src, path.join(dest, "skills"));
    expect(result.fileCount).toBe(1);
  });
});
