import { z } from "zod";
import { escapeXmlAttr, type ToolDefinition } from "./types";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { isProjectPath } from "@/projects/config";
import { logActivity } from "@/activity/activity_log";
import {
  forgetMemory,
  MEMORY_TYPES,
  readMemory,
  saveMemory,
  type MemoryScope,
} from "@/memory/store";

const scopeSchema = z
  .enum(["personal", "project"])
  .describe(
    "personal = about the user, shared by every project; project = about the current project only",
  );

function resolve(scope: MemoryScope, appPath: string): string | undefined {
  if (scope === "personal") return undefined;
  if (!isProjectPath(appPath)) {
    throw new DyadError(
      "Project memory is only available inside a project. Use scope=personal.",
      DyadErrorKind.Validation,
    );
  }
  return appPath;
}

const saveSchema = z.object({
  scope: scopeSchema,
  title: z
    .string()
    .min(2)
    .max(120)
    .describe("Short title, e.g. 'Format of meeting minutes'"),
  description: z
    .string()
    .max(240)
    .describe("One line saying when this memory is useful"),
  type: z
    .enum(MEMORY_TYPES as [string, ...string[]])
    .describe(
      "user = who they are and how they work; feedback = how they want things done; project = decisions and context of a project; reference = where to find something",
    ),
  content: z
    .string()
    .min(2)
    .max(4000)
    .describe(
      "The memory itself, short and general. No personal data about other people, no secrets.",
    ),
  id: z
    .string()
    .optional()
    .describe(
      "Id of an existing memory to update (from the index). Omit to create a new one.",
    ),
});

export const memorySaveTool: ToolDefinition<z.infer<typeof saveSchema>> = {
  name: "memory_save",
  description:
    "Save or update a memory that persists between conversations. Use it only when the user asks you to remember something or states a lasting preference or fact. The user approves each save. Never store personal data about other people or secrets.",
  inputSchema: saveSchema,
  defaultConsent: "ask",
  mutationTracking: "none",
  shouldTrackMutation: () => false,
  getConsentPreview: (args) =>
    `Remember (${args.scope}): ${args.title}\n\n${args.content}`,
  buildXml: (args) =>
    args.title
      ? `<dyad-read-guide name="${escapeXmlAttr(`memory : ${args.title}`)}"></dyad-read-guide>`
      : undefined,
  execute: async (args, ctx) => {
    const entry = saveMemory(
      args.scope,
      {
        id: args.id,
        title: args.title,
        description: args.description,
        type: args.type as (typeof MEMORY_TYPES)[number],
        body: args.content,
      },
      resolve(args.scope, ctx.appPath),
    );
    logActivity({
      kind: "tool",
      name: "memory",
      status: "ok",
      chatId: ctx.chatId,
      detail: `saved ${args.scope}/${entry.id}`,
    });
    return `Saved ${args.scope} memory "${entry.title}" (id: ${entry.id}).`;
  },
};

const readSchema = z.object({
  scope: scopeSchema,
  id: z.string().describe("The id shown in the memory index"),
});

export const memoryReadTool: ToolDefinition<z.infer<typeof readSchema>> = {
  name: "memory_read",
  description: "Read the full text of one memory listed in the memory index.",
  inputSchema: readSchema,
  defaultConsent: "always",
  mutationTracking: "none",
  shouldTrackMutation: () => false,
  getConsentPreview: (args) => `Read memory ${args.scope}/${args.id}`,
  execute: async (args, ctx) => {
    const doc = readMemory(
      args.scope,
      args.id,
      resolve(args.scope, ctx.appPath),
    );
    if (!doc)
      throw new DyadError(
        `No ${args.scope} memory with id "${args.id}"`,
        DyadErrorKind.NotFound,
      );
    return `${doc.title} (${doc.type})\n${doc.description}\n\n${doc.body}`;
  },
};

export const memoryForgetTool: ToolDefinition<z.infer<typeof readSchema>> = {
  name: "memory_forget",
  description:
    "Delete a memory. Use it when the user asks you to forget something, or when a memory is no longer true. The user approves each deletion.",
  inputSchema: readSchema,
  defaultConsent: "ask",
  mutationTracking: "none",
  shouldTrackMutation: () => false,
  getConsentPreview: (args) => `Forget ${args.scope} memory: ${args.id}`,
  execute: async (args, ctx) => {
    const done = forgetMemory(
      args.scope,
      args.id,
      resolve(args.scope, ctx.appPath),
    );
    if (!done)
      throw new DyadError(
        `No ${args.scope} memory with id "${args.id}"`,
        DyadErrorKind.NotFound,
      );
    logActivity({
      kind: "tool",
      name: "memory",
      status: "ok",
      chatId: ctx.chatId,
      detail: `forgot ${args.scope}/${args.id}`,
    });
    return `Forgot ${args.scope} memory ${args.id}.`;
  },
};
