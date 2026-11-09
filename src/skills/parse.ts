/**
 * Parsing of Claude-format skills (a folder with a SKILL.md: YAML frontmatter
 * with `name` + `description`, then a Markdown body). Parsing is deliberately
 * tolerant: unknown frontmatter fields are ignored so any valid Claude skill
 * loads unchanged.
 */
import { parse as parseYaml } from "yaml";

export const SKILL_FILE_NAME = "SKILL.md";
export const MAX_SKILL_FILE_BYTES = 100 * 1024;
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

export interface ParsedSkill {
  name: string;
  description: string;
  /** Markdown body without the frontmatter. */
  body: string;
  allowedTools: string[];
  /** Hidden from the model's skill list; still invocable with /name. */
  disableModelInvocation: boolean;
  /** False hides the skill from /name invocation (model-only). */
  userInvocable: boolean;
  argumentHint?: string;
}

export type ParseSkillResult =
  | { ok: true; skill: ParsedSkill }
  | { ok: false; error: string };

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function splitFrontmatter(
  raw: string,
): { frontmatter: string; body: string } | null {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const match = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return null;
  return { frontmatter: match[1], body: text.slice(match[0].length) };
}

function parseLooseFrontmatter(text: string): Record<string, string> | null {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Za-z][\w-]*):[ \t]*(.*)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields.name || fields.description ? fields : null;
}

/**
 * @param dirName folder name; Claude requires `name` to match it. A mismatch
 * is tolerated (the frontmatter name wins) so imperfect skills still load.
 */
export function parseSkillMd(raw: string, dirName?: string): ParseSkillResult {
  const parts = splitFrontmatter(raw);
  if (!parts) {
    return { ok: false, error: "SKILL.md has no YAML frontmatter" };
  }
  let data: unknown;
  try {
    data = parseYaml(parts.frontmatter);
  } catch (error) {
    // Many hand-written skills have an unquoted description containing ": ";
    // fall back to simple "key: value" lines instead of dropping the skill.
    data = parseLooseFrontmatter(parts.frontmatter);
    if (!data) {
      return {
        ok: false,
        error: `Invalid frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Frontmatter must be a YAML mapping" };
  }
  const fields = data as Record<string, unknown>;
  const name = String(fields.name ?? dirName ?? "").trim();
  const description = String(fields.description ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: `Invalid skill name "${name}" (lowercase letters, digits and hyphens, max ${MAX_NAME_LENGTH})`,
    };
  }
  if (!description) {
    return { ok: false, error: "Skill has no description" };
  }
  return {
    ok: true,
    skill: {
      name,
      description: description.slice(0, MAX_DESCRIPTION_LENGTH),
      body: parts.body.trim(),
      allowedTools: asStringList(fields["allowed-tools"]),
      disableModelInvocation: fields["disable-model-invocation"] === true,
      userInvocable: fields["user-invocable"] !== false,
      argumentHint:
        typeof fields["argument-hint"] === "string"
          ? fields["argument-hint"]
          : undefined,
    },
  };
}
