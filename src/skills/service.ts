import log from "electron-log";
import { readSettings } from "@/main/settings";
import { buildAvailableSkillsPrompt } from "./prompt";
import { discoverSkills } from "./registry";

const logger = log.scope("skills");

/** System-prompt block listing skills; empty when none or the tool is off. */
export async function getSkillsPromptBlock(appPath: string): Promise<string> {
  try {
    const settings = readSettings();
    if (settings.agentToolConsents?.["read_skill"] === "never") return "";
    return buildAvailableSkillsPrompt(
      await discoverSkills({ appPath, disabled: settings.disabledSkills }),
    );
  } catch (error) {
    logger.warn("Could not build the skills prompt:", error);
    return "";
  }
}
