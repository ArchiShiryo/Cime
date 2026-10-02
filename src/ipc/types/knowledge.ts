import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const KnowledgeSourceSchema = z.object({
  id: z.number(),
  path: z.string(),
  name: z.string(),
  size: z.number(),
  status: z.enum(["pending", "indexing", "ready", "error"]),
  error: z.string().nullable(),
  chunkCount: z.number(),
  embeddedCount: z.number(),
});

export type KnowledgeSourceInfo = z.infer<typeof KnowledgeSourceSchema>;

export const knowledgeContracts = {
  list: defineContract({
    channel: "knowledge:list",
    input: z.void(),
    output: z.array(KnowledgeSourceSchema),
  }),
  add: defineContract({
    channel: "knowledge:add",
    input: z.object({ kind: z.enum(["files", "folder"]) }),
    // Number of files queued; null when the user cancels the dialog.
    output: z.number().nullable(),
  }),
  remove: defineContract({
    channel: "knowledge:remove",
    input: z.object({ id: z.number() }),
    output: z.void(),
  }),
  reindex: defineContract({
    channel: "knowledge:reindex",
    input: z.object({ id: z.number() }),
    output: z.void(),
  }),
  status: defineContract({
    channel: "knowledge:status",
    input: z.void(),
    output: z.object({
      mode: z.enum(["local", "albert", "keywords"]),
      localModelInstalled: z.boolean(),
    }),
  }),
  // Computes missing vectors (after the user changes the search mode).
  embedPending: defineContract({
    channel: "knowledge:embed-pending",
    input: z.void(),
    output: z.void(),
  }),
} as const;

export const knowledgeClient = createClient(knowledgeContracts);
