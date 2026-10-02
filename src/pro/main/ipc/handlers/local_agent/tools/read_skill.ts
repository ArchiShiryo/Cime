import fs from "node:fs";
import { z } from "zod";
import { ToolDefinition, escapeXmlAttr } from "./types";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { readSettings } from "@/main/settings";
import {
  discoverSkills,
  listSkillFiles,
  resolveSkillFile,
} from "@/skills/registry";
import { substituteSkillVariables } from "@/skills/prompt";

const MAX_FILE_CHARS = 60_000;

const readSkillSchema = z.object({
  name: z.string().describe("Name of the skill, from <available_skills>"),
  file: z
    .string()
    .optional()
    .describe(
      "Optional path (relative to the skill folder) of a bundled file to read, e.g. references/guide.md",
    ),
});

export const readSkillTool: ToolDefinition<z.infer<typeof readSkillSchema>> = {
  name: "read_skill",
  description:
    "Load a skill: expert instructions for a kind of task. Call it with the skill name when the request matches a skill in <available_skills>. Pass `file` to read a file bundled with the skill (references, templates).",
  inputSchema: readSkillSchema,
  defaultConsent: "always",

  getConsentPreview: (args) =>
    args.file
      ? `Read skill file: ${args.name}/${args.file}`
      : `Read skill: ${args.name}`,

  buildXml: (args) => {
    if (!args.name) return undefined;
    return `<dyad-read-guide name="${escapeXmlAttr(args.name)}"></dyad-read-guide>`;
  },

  execute: async (args, ctx) => {
    const settings = readSettings();
    const skills = await discoverSkills({
      appPath: ctx.appPath,
      disabled: settings.disabledSkills,
    });
    const skill = skills.find((candidate) => candidate.name === args.name);
    if (!skill) {
      throw new DyadError(
        `Skill "${args.name}" not found. Available skills: ${skills.map((s) => s.name).join(", ") || "none"}`,
        DyadErrorKind.NotFound,
      );
    }
    if (args.file) {
      const resolved = await resolveSkillFile(skill, args.file);
      if (!resolved) {
        throw new DyadError(
          `File "${args.file}" is not part of skill "${skill.name}"`,
          DyadErrorKind.Validation,
        );
      }
      const text = await fs.promises.readFile(resolved, "utf8");
      return text.length > MAX_FILE_CHARS
        ? `${text.slice(0, MAX_FILE_CHARS)}\n\n<!-- truncated -->`
        : text;
    }
    const files = await listSkillFiles(skill);
    const body = substituteSkillVariables(skill.body, skill.dir);
    const fileList = files.length
      ? `\n\n## Files bundled with this skill\n${files.map((f) => `- ${f}`).join("\n")}\n\nRead one with read_skill (name + file). Scripts must be run with the shell tool, which asks the user first. The skill folder is: ${skill.dir}`
      : "";
    return `# Skill: ${skill.name}\n\n${body}${fileList}`;
  },
};
