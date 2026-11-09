import fs from "node:fs";
import path from "node:path";
import { getUserDataPath } from "@/paths/paths";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export type MemoryScope = "personal" | "project";
export type MemoryType = "user" | "feedback" | "project" | "reference";
export const MEMORY_TYPES: readonly MemoryType[] = [
  "user",
  "feedback",
  "project",
  "reference",
];

export interface MemoryEntry {
  id: string;
  title: string;
  description: string;
  type: MemoryType;
  updatedAt: number;
}
export interface MemoryDocument extends MemoryEntry {
  body: string;
}

export const MAX_MEMORIES_PER_SCOPE = 100;
export const MAX_BODY_CHARS = 4000;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 240;
const MAX_INDEX_LINES = 60;

/** Where a scope's memories live: the user data folder, or the project's hidden folder. */
export function memoryDir(scope: MemoryScope, projectPath?: string): string {
  if (scope === "personal") return path.join(getUserDataPath(), "memory");
  if (!projectPath) {
    throw new DyadError(
      "A project path is required for project memory",
      DyadErrorKind.Validation,
    );
  }
  return path.join(projectPath, ".cimes", "memory");
}

export function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "memory";
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,59}$/;
const assertId = (id: string) => {
  if (!ID_PATTERN.test(id)) {
    throw new DyadError(`Invalid memory id: ${id}`, DyadErrorKind.Validation);
  }
};

/**
 * Memory is a notebook for the user's own preferences and working context, not a
 * place for data about other people or for secrets. Refuse what is clearly one of those.
 */
export function findSensitiveData(text: string): string | null {
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) return "an email address";
  if (/(?:\+33|0033|\b0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/.test(text))
    return "a phone number";
  if (
    /\b[12]\s?\d{2}\s?(0[1-9]|1[0-2])\s?\d{2}\s?\d{3}\s?\d{3}(\s?\d{2})?\b/.test(
      text,
    )
  )
    return "a social security number";
  if (/\bFR\d{2}(?:\s?[0-9A-Z]{4}){5}(?:\s?[0-9A-Z]{1,3})?\b/i.test(text))
    return "a bank account number (IBAN)";
  if (
    /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i.test(
      text,
    )
  )
    return "an API key or token";
  if (/\b(password|mot de passe|passwd)\s*[:=]/i.test(text))
    return "a password";
  return null;
}

function frontmatter(entry: MemoryEntry): string {
  const clean = (v: string) => v.replace(/\r?\n/g, " ").trim();
  return `---\nname: ${clean(entry.title)}\ndescription: ${clean(entry.description)}\ntype: ${entry.type}\n---\n`;
}

function parse(
  id: string,
  raw: string,
  mtimeMs: number,
): MemoryDocument | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(
    raw.replace(/\r\n/g, "\n"),
  );
  if (!match) return null;
  const field = (name: string) =>
    new RegExp(`^${name}:\\s*(.*)$`, "m").exec(match[1])?.[1].trim() ?? "";
  const type = field("type") as MemoryType;
  return {
    id,
    title: field("name") || id,
    description: field("description"),
    type: MEMORY_TYPES.includes(type) ? type : "user",
    updatedAt: Math.floor(mtimeMs),
    body: match[2].trim(),
  };
}

export function listMemories(
  scope: MemoryScope,
  projectPath?: string,
): MemoryEntry[] {
  const dir = memoryDir(scope, projectPath);
  let names: string[];
  try {
    names = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".md") && n !== "MEMORY.md");
  } catch {
    return [];
  }
  const entries: MemoryEntry[] = [];
  for (const name of names) {
    const id = name.slice(0, -3);
    if (!ID_PATTERN.test(id)) continue;
    try {
      const file = path.join(dir, name);
      const doc = parse(
        id,
        fs.readFileSync(file, "utf8"),
        fs.statSync(file).mtimeMs,
      );
      if (doc) {
        const { body: _body, ...entry } = doc;
        entries.push(entry);
      }
    } catch {
      // unreadable file: skip
    }
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readMemory(
  scope: MemoryScope,
  id: string,
  projectPath?: string,
): MemoryDocument | null {
  assertId(id);
  const file = path.join(memoryDir(scope, projectPath), `${id}.md`);
  try {
    return parse(id, fs.readFileSync(file, "utf8"), fs.statSync(file).mtimeMs);
  } catch {
    return null;
  }
}

export interface SaveMemoryInput {
  id?: string;
  title: string;
  description: string;
  type: MemoryType;
  body: string;
}

export function saveMemory(
  scope: MemoryScope,
  input: SaveMemoryInput,
  projectPath?: string,
): MemoryEntry {
  const title = input.title.trim().slice(0, MAX_TITLE);
  const description = input.description.trim().slice(0, MAX_DESCRIPTION);
  const body = input.body.trim();
  if (!title || !body) {
    throw new DyadError(
      "A memory needs a title and a content",
      DyadErrorKind.Validation,
    );
  }
  if (body.length > MAX_BODY_CHARS) {
    throw new DyadError(
      `A memory is limited to ${MAX_BODY_CHARS} characters`,
      DyadErrorKind.Validation,
    );
  }
  const sensitive = findSensitiveData(`${title}\n${description}\n${body}`);
  if (sensitive) {
    throw new DyadError(
      `This looks like it contains ${sensitive}. Memory is for the user's own preferences and working context, not for personal data or secrets.`,
      DyadErrorKind.Validation,
    );
  }
  const dir = memoryDir(scope, projectPath);
  fs.mkdirSync(dir, { recursive: true });
  let id = input.id;
  if (id) assertId(id);
  else {
    const base = slugify(title);
    id = base;
    for (let n = 2; fs.existsSync(path.join(dir, `${id}.md`)); n++)
      id = `${base}-${n}`.slice(0, 60);
  }
  const exists = fs.existsSync(path.join(dir, `${id}.md`));
  if (
    !exists &&
    listMemories(scope, projectPath).length >= MAX_MEMORIES_PER_SCOPE
  ) {
    throw new DyadError(
      `Memory is full (${MAX_MEMORIES_PER_SCOPE} entries). Forget one first.`,
      DyadErrorKind.Validation,
    );
  }
  const entry: MemoryEntry = {
    id,
    title,
    description: description || title,
    type: input.type,
    updatedAt: Date.now(),
  };
  const file = path.join(dir, `${id}.md`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${frontmatter(entry)}\n${body}\n`, "utf8");
  fs.renameSync(tmp, file);
  return entry;
}

export function forgetMemory(
  scope: MemoryScope,
  id: string,
  projectPath?: string,
): boolean {
  assertId(id);
  const file = path.join(memoryDir(scope, projectPath), `${id}.md`);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}

/** The index shown to the model: one line per memory, newest first. */
export function buildIndexLines(
  scope: MemoryScope,
  projectPath?: string,
): string[] {
  return listMemories(scope, projectPath)
    .slice(0, MAX_INDEX_LINES)
    .map((m) => `- [${m.id}] ${m.title} (${m.type}): ${m.description}`);
}
