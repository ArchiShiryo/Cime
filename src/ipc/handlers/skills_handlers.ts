import fs from "node:fs";
import { dialog, shell } from "electron";
import { createTypedHandler } from "./base";
import { skillsContracts } from "../types/skills";
import { readSettings, writeSettings } from "@/main/settings";
import {
  discoverSkills,
  getUserSkillsDir,
  listSkillFiles,
} from "@/skills/registry";
import { deleteUserSkill, importSkillFromPath } from "@/skills/import";

const SCRIPT_PATTERN = /\.(sh|bash|ps1|bat|cmd|py|js|mjs|cjs|ts|rb|pl)$/i;

export function registerSkillsHandlers() {
  createTypedHandler(skillsContracts.list, async () => {
    const disabled = new Set(readSettings().disabledSkills ?? []);
    const skills = await discoverSkills({ includeDisabled: true });
    return Promise.all(
      skills.map(async (skill) => ({
        name: skill.name,
        description: skill.description,
        origin: skill.origin,
        enabled: !disabled.has(skill.name),
        hasScripts: (await listSkillFiles(skill)).some((file) =>
          SCRIPT_PATTERN.test(file),
        ),
      })),
    );
  });

  createTypedHandler(skillsContracts.import, async (_event, { kind }) => {
    const result = await dialog.showOpenDialog({
      properties: [kind === "folder" ? "openDirectory" : "openFile"],
      filters:
        kind === "archive"
          ? [{ name: "Skill (.zip, .skill)", extensions: ["zip", "skill"] }]
          : undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return importSkillFromPath(result.filePaths[0]);
  });

  createTypedHandler(
    skillsContracts.setEnabled,
    async (_event, { name, enabled }) => {
      const disabled = new Set(readSettings().disabledSkills ?? []);
      if (enabled) disabled.delete(name);
      else disabled.add(name);
      writeSettings({ disabledSkills: [...disabled].sort() });
    },
  );

  createTypedHandler(skillsContracts.remove, async (_event, { name }) => {
    await deleteUserSkill(name);
  });

  createTypedHandler(skillsContracts.openFolder, async () => {
    const dir = getUserSkillsDir();
    await fs.promises.mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
}
