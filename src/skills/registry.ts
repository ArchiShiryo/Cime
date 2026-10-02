import fs from "node:fs";
import path from "node:path";
import log from "electron-log";
import { getUserDataPath } from "@/paths/paths";
import { readProjectConfig } from "@/projects/config";
import { BUILTIN_SKILLS, type BuiltinSkill } from "./builtin";
import {
  MAX_SKILL_FILE_BYTES,
  SKILL_FILE_NAME,
  parseSkillMd,
  type ParsedSkill,
} from "./parse";

const logger = log.scope("skills");

const MAX_SKILLS = 200;
const MAX_LISTED_FILES = 200;

export type SkillOrigin = "builtin" | "user" | "app";

export interface Skill extends ParsedSkill {
  origin: SkillOrigin;
  /** Absolute folder of the skill; undefined for built-in skills. */
  dir?: string;
}

/** Where built-in skills that ship scripts are written so the shell can run them. */
export function getBuiltinSkillsDir(): string {
  return path.join(getUserDataPath(), "builtin-skills");
}

/** Writes a built-in skill's extra files to disk (only when missing or changed). */
async function materializeBuiltinSkill(
  skill: BuiltinSkill,
  rootDir: string,
): Promise<string | undefined> {
  if (!skill.assets) return undefined;
  const dir = path.join(rootDir, skill.name);
  try {
    for (const [relative, content] of Object.entries(skill.assets)) {
      const target = path.join(dir, ...relative.split("/"));
      const bytes = Buffer.byteLength(content, "utf8");
      const current = await fs.promises.stat(target).catch(() => null);
      if (current?.isFile() && current.size === bytes) continue;
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, content, "utf8");
    }
    return dir;
  } catch (error) {
    logger.warn(
      `Could not write built-in skill files for ${skill.name}:`,
      error,
    );
    return undefined;
  }
}

export function getUserSkillsDir(): string {
  return path.join(getUserDataPath(), "skills");
}

/** Skill folders inside an app; .claude/skills makes Claude repos work as-is. */
export function getAppSkillRoots(appPath: string): string[] {
  return [
    path.join(appPath, ".claude", "skills"),
    path.join(appPath, ".cimes", "skills"),
  ];
}

async function readSkillDir(
  dir: string,
  origin: SkillOrigin,
): Promise<Skill | null> {
  const file = path.join(dir, SKILL_FILE_NAME);
  try {
    // lstat so a SKILL.md symlink pointing outside the folder is refused.
    const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.size > MAX_SKILL_FILE_BYTES) return null;
    const result = parseSkillMd(
      await fs.promises.readFile(file, "utf8"),
      path.basename(dir),
    );
    if (!result.ok) {
      logger.warn(`Ignoring skill at ${dir}: ${result.error}`);
      return null;
    }
    return { ...result.skill, origin, dir };
  } catch {
    return null;
  }
}

async function readRoot(root: string, origin: SkillOrigin): Promise<Skill[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: Skill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skill = await readSkillDir(path.join(root, entry.name), origin);
    if (skill) skills.push(skill);
  }
  return skills;
}

/**
 * All skills visible for an app. Later sources override earlier ones with the
 * same name: built-in < user < app (.claude/skills, then .cimes/skills).
 */
export async function discoverSkills(
  options: {
    appPath?: string;
    userSkillsDir?: string;
    disabled?: readonly string[];
    includeDisabled?: boolean;
    builtinSkillsDir?: string;
  } = {},
): Promise<Skill[]> {
  const byName = new Map<string, Skill>();
  const add = (skill: Skill) => {
    if (byName.has(skill.name)) {
      logger.info(
        `Skill "${skill.name}" from ${skill.origin} overrides an earlier one`,
      );
    }
    byName.set(skill.name, skill);
  };
  const disabledNames = new Set(options.disabled ?? []);
  for (const skill of BUILTIN_SKILLS) {
    // Only write a skill's script files when the skill is actually offered.
    const dir =
      options.includeDisabled || !disabledNames.has(skill.name)
        ? await materializeBuiltinSkill(
            skill,
            options.builtinSkillsDir ?? getBuiltinSkillsDir(),
          )
        : undefined;
    const { assets: _assets, ...rest } = skill;
    add({ ...rest, origin: "builtin", dir });
  }
  for (const skill of await readRoot(
    options.userSkillsDir ?? getUserSkillsDir(),
    "user",
  )) {
    add(skill);
  }
  if (options.appPath) {
    for (const root of getAppSkillRoots(options.appPath)) {
      for (const skill of await readRoot(root, "app")) add(skill);
    }
  }
  const disabled = new Set(options.disabled ?? []);
  // A project only offers the skills its owner switched on (plus its own folders' skills).
  const project = options.appPath ? readProjectConfig(options.appPath) : null;
  const projectSkills = project ? new Set(project.enabledSkills) : null;
  return [...byName.values()]
    .filter((skill) => options.includeDisabled || !disabled.has(skill.name))
    .filter(
      (skill) =>
        !projectSkills ||
        skill.origin === "app" ||
        projectSkills.has(skill.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_SKILLS);
}

/** Resolve a file inside a skill folder, refusing traversal and symlink escape. */
export async function resolveSkillFile(
  skill: Skill,
  relativePath: string,
): Promise<string | null> {
  if (!skill.dir) return null;
  const root = await fs.promises.realpath(skill.dir);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  try {
    const real = await fs.promises.realpath(target);
    if (real !== root && !real.startsWith(root + path.sep)) return null;
    return real;
  } catch {
    return null;
  }
}

/** Relative paths of the files bundled with a skill (bounded). */
export async function listSkillFiles(skill: Skill): Promise<string[]> {
  if (!skill.dir) return [];
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    if (files.length >= MAX_LISTED_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_LISTED_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && entry.name !== SKILL_FILE_NAME) {
        files.push(path.relative(skill.dir!, full).split(path.sep).join("/"));
      }
    }
  };
  await walk(skill.dir);
  return files.sort();
}
