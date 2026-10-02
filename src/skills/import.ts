/**
 * Import a Claude skill (folder or .zip/.skill) into <userData>/skills.
 * Everything is validated in memory first (zip-slip, size and count limits,
 * symlinks ignored) and nothing is executed.
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { MAX_SKILL_FILE_BYTES, SKILL_FILE_NAME, parseSkillMd } from "./parse";
import { getUserSkillsDir } from "./registry";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_FILES = 500;

export interface ImportedSkill {
  name: string;
  description: string;
  fileCount: number;
  /** Bundled files that look executable; they never run without approval. */
  scripts: string[];
}

const SCRIPT_PATTERN = /\.(sh|bash|ps1|bat|cmd|py|js|mjs|cjs|ts|rb|pl)$/i;

function fail(message: string): never {
  throw new DyadError(message, DyadErrorKind.Validation);
}

/** Safe relative POSIX path, or null when it escapes or is absolute. */
export function normalizeEntryPath(entry: string): string | null {
  const unified = entry.replace(/\\/g, "/");
  if (unified.startsWith("/") || /^[a-zA-Z]:/.test(unified)) return null;
  const parts = unified.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) return null;
  return parts.length ? parts.join("/") : null;
}

/** Strip a single wrapping folder so SKILL.md ends up at the root. */
function stripWrapper(files: Map<string, Uint8Array>): Map<string, Uint8Array> {
  if (files.has(SKILL_FILE_NAME)) return files;
  const tops = new Set([...files.keys()].map((key) => key.split("/")[0]));
  if (tops.size !== 1) return files;
  const [top] = [...tops];
  if (!files.has(`${top}/${SKILL_FILE_NAME}`)) return files;
  const stripped = new Map<string, Uint8Array>();
  for (const [key, value] of files)
    stripped.set(key.slice(top.length + 1), value);
  return stripped;
}

export function unzipSkillArchive(data: Uint8Array): Map<string, Uint8Array> {
  let total = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, {
      filter: (file) => {
        if (file.name.endsWith("/")) return false;
        count += 1;
        total += file.originalSize;
        if (count > MAX_IMPORT_FILES) fail("The archive has too many files");
        if (total > MAX_IMPORT_BYTES) fail("The archive is too large");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof DyadError) throw error;
    return fail("This file is not a valid zip archive");
  }
  const files = new Map<string, Uint8Array>();
  for (const [name, content] of Object.entries(entries)) {
    const safe = normalizeEntryPath(name);
    if (!safe) fail(`Unsafe path in archive: ${name}`);
    if (safe.startsWith("__MACOSX/") || safe.endsWith(".DS_Store")) continue;
    files.set(safe, content);
  }
  return files;
}

export async function readSkillFolder(
  dir: string,
): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  let total = 0;
  const walk = async (current: string, prefix: string): Promise<void> => {
    for (const entry of await fs.promises.readdir(current, {
      withFileTypes: true,
    })) {
      // Symlinks are ignored so a folder cannot pull in outside files.
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        await walk(full, rel);
      } else if (entry.isFile()) {
        if (files.size >= MAX_IMPORT_FILES)
          fail("The folder has too many files");
        const content = await fs.promises.readFile(full);
        total += content.length;
        if (total > MAX_IMPORT_BYTES) fail("The folder is too large");
        files.set(rel, content);
      }
    }
  };
  await walk(dir, "");
  return files;
}

export async function installSkillFiles(
  rawFiles: Map<string, Uint8Array>,
  userSkillsDir: string = getUserSkillsDir(),
): Promise<ImportedSkill> {
  const files = stripWrapper(rawFiles);
  const skillMd = files.get(SKILL_FILE_NAME);
  if (!skillMd) fail("No SKILL.md found at the root of the skill");
  if (skillMd.length > MAX_SKILL_FILE_BYTES) fail("SKILL.md is too large");
  const parsed = parseSkillMd(Buffer.from(skillMd).toString("utf8"));
  if (!parsed.ok) fail(parsed.error);

  const target = path.join(userSkillsDir, parsed.skill.name);
  const staging = `${target}.importing-${process.pid}`;
  await fs.promises.rm(staging, { recursive: true, force: true });
  for (const [rel, content] of files) {
    const dest = path.join(staging, ...rel.split("/"));
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, content);
  }
  await fs.promises.rm(target, { recursive: true, force: true });
  await fs.promises.rename(staging, target);
  return {
    name: parsed.skill.name,
    description: parsed.skill.description,
    fileCount: files.size,
    scripts: [...files.keys()].filter((rel) => SCRIPT_PATTERN.test(rel)).sort(),
  };
}

export async function importSkillFromPath(
  sourcePath: string,
  userSkillsDir?: string,
): Promise<ImportedSkill> {
  const stat = await fs.promises.stat(sourcePath).catch(() => null);
  if (!stat) fail("The selected file or folder does not exist");
  if (stat.isDirectory()) {
    return installSkillFiles(await readSkillFolder(sourcePath), userSkillsDir);
  }
  if (stat.size > MAX_IMPORT_BYTES) fail("The archive is too large");
  const data = await fs.promises.readFile(sourcePath);
  return installSkillFiles(
    unzipSkillArchive(new Uint8Array(data)),
    userSkillsDir,
  );
}

export async function deleteUserSkill(
  name: string,
  userSkillsDir: string = getUserSkillsDir(),
): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) fail("Invalid skill name");
  await fs.promises.rm(path.join(userSkillsDir, name), {
    recursive: true,
    force: true,
  });
}
