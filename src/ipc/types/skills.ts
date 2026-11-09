import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const SkillSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  origin: z.enum(["builtin", "user", "app"]),
  enabled: z.boolean(),
  hasScripts: z.boolean(),
});

export const ImportedSkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  fileCount: z.number(),
  scripts: z.array(z.string()),
});

export type SkillSummary = z.infer<typeof SkillSummarySchema>;
export type ImportedSkillInfo = z.infer<typeof ImportedSkillSchema>;

export const skillsContracts = {
  list: defineContract({
    channel: "skills:list",
    input: z.void(),
    output: z.array(SkillSummarySchema),
  }),
  import: defineContract({
    channel: "skills:import",
    input: z.object({ kind: z.enum(["folder", "archive"]) }),
    // null when the user cancels the file dialog.
    output: ImportedSkillSchema.nullable(),
  }),
  setEnabled: defineContract({
    channel: "skills:set-enabled",
    input: z.object({ name: z.string(), enabled: z.boolean() }),
    output: z.void(),
  }),
  remove: defineContract({
    channel: "skills:remove",
    input: z.object({ name: z.string() }),
    output: z.void(),
  }),
  openFolder: defineContract({
    channel: "skills:open-folder",
    input: z.void(),
    output: z.void(),
  }),
} as const;

export const skillsClient = createClient(skillsContracts);
