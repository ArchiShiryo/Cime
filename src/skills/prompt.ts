import type { Skill } from "./registry";

/** Level 1 of progressive disclosure: names and descriptions only. */
export function buildAvailableSkillsPrompt(skills: readonly Skill[]): string {
  const listed = skills.filter((skill) => !skill.disableModelInvocation);
  if (listed.length === 0) return "";
  const lines = listed
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
  return `\n\n<available_skills>\nSkills are packaged expert instructions. When the user's request matches a skill below, call the \`read_skill\` tool with its name BEFORE acting, then follow its instructions. Files listed by \`read_skill\` can be read with \`read_skill\` and its \`file\` argument. Never run a skill's scripts without the shell tool's normal review.\n${lines}\n</available_skills>`;
}

/** Replace the skill folder placeholders Claude skills use in commands. */
export function substituteSkillVariables(
  body: string,
  skillDir: string | undefined,
): string {
  if (!skillDir) return body;
  return body.replace(/\$\{?(?:CLAUDE|CIMES)_SKILL_DIR\}?/g, skillDir);
}

/**
 * `/skill-name args` → the skill body as the message sent to the model.
 * Returns null when the prompt is not a skill invocation.
 */
export function expandSkillInvocation(
  prompt: string,
  skills: readonly Skill[],
): string | null {
  const match = prompt.match(/^\/([a-z0-9][a-z0-9-]*)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const skill = skills.find(
    (candidate) => candidate.name === match[1] && candidate.userInvocable,
  );
  if (!skill) return null;
  const args = (match[2] ?? "").trim();
  const body = substituteSkillVariables(skill.body, skill.dir);
  const withArgs = body.includes("$ARGUMENTS")
    ? body.replaceAll("$ARGUMENTS", args)
    : args
      ? `${body}\n\nARGUMENTS: ${args}`
      : body;
  return `The user invoked the skill "${skill.name}". Follow these instructions:\n\n${withArgs}`;
}
