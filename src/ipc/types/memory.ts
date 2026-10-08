import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const MemoryEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["user", "feedback", "project", "reference"]),
  updatedAt: z.number(),
});
export const MemoryDocumentSchema = MemoryEntrySchema.extend({
  body: z.string(),
});

const target = z.object({
  scope: z.enum(["personal", "project"]),
  /** Required for project memory. */
  appId: z.number().optional(),
});

export const memoryContracts = {
  list: defineContract({
    channel: "memory:list",
    input: target,
    output: z.array(MemoryEntrySchema),
  }),
  read: defineContract({
    channel: "memory:read",
    input: target.extend({ id: z.string() }),
    output: MemoryDocumentSchema.nullable(),
  }),
  save: defineContract({
    channel: "memory:save",
    input: target.extend({
      id: z.string().optional(),
      title: z.string(),
      description: z.string(),
      type: z.enum(["user", "feedback", "project", "reference"]),
      body: z.string(),
    }),
    output: MemoryEntrySchema,
  }),
  forget: defineContract({
    channel: "memory:forget",
    input: target.extend({ id: z.string() }),
    output: z.void(),
  }),
} as const;

export const memoryClient = createClient(memoryContracts);
