import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";
import { KnowledgeSourceSchema } from "./knowledge";

export const ProjectConfigSchema = z.object({
  templateId: z.string(),
  enabledSkills: z.array(z.string()),
  instructions: z.string(),
  /** Absolute path of the project folder. */
  path: z.string(),
  /** Absolute path of its Documentation folder. */
  documentationPath: z.string(),
});

export type ProjectConfigInfo = z.infer<typeof ProjectConfigSchema>;

const appIdInput = z.object({ appId: z.number() });

export const projectsContracts = {
  getConfig: defineContract({
    channel: "projects:get-config",
    input: appIdInput,
    output: ProjectConfigSchema,
  }),
  updateConfig: defineContract({
    channel: "projects:update-config",
    input: z.object({
      appId: z.number(),
      enabledSkills: z.array(z.string()).optional(),
      instructions: z.string().max(4000).optional(),
    }),
    output: ProjectConfigSchema,
  }),
  docsList: defineContract({
    channel: "projects:docs-list",
    input: appIdInput,
    output: z.array(KnowledgeSourceSchema),
  }),
  // Copies files (or a folder's contents) into Documentation and indexes them.
  // Number of files queued; null when the user cancels the dialog.
  docsAdd: defineContract({
    channel: "projects:docs-add",
    input: z.object({
      appId: z.number(),
      kind: z.enum(["files", "folder"]),
    }),
    output: z.number().nullable(),
  }),
  // One click: (re)indexes the whole Documentation folder for search.
  docsIndex: defineContract({
    channel: "projects:docs-index",
    input: appIdInput,
    output: z.number(),
  }),
  openFolder: defineContract({
    channel: "projects:open-folder",
    input: z.object({
      appId: z.number(),
      target: z.enum(["project", "documentation"]),
    }),
    output: z.void(),
  }),
} as const;

export const projectsClient = createClient(projectsContracts);
