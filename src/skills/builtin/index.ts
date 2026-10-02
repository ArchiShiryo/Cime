import charteCanope from "./charte-canope/SKILL.md?raw";
import accessibiliteRgaa from "./accessibilite-rgaa/SKILL.md?raw";
import ateliersPedagogique from "./atelier-pedagogique/SKILL.md?raw";
import appWebSimple from "./app-web-simple/SKILL.md?raw";
import { parseSkillMd, type ParsedSkill } from "../parse";

const RAW_BUILTIN_SKILLS: Record<string, string> = {
  "charte-canope": charteCanope,
  "accessibilite-rgaa": accessibiliteRgaa,
  "atelier-pedagogique": ateliersPedagogique,
  "app-web-simple": appWebSimple,
};

/** Single-file skills shipped inside the app (no folder on disk). */
export const BUILTIN_SKILLS: ParsedSkill[] = Object.entries(
  RAW_BUILTIN_SKILLS,
).flatMap(([dirName, raw]) => {
  const result = parseSkillMd(raw, dirName);
  return result.ok ? [result.skill] : [];
});
