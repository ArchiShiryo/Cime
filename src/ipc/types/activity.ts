import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const ActivityEventSchema = z.object({
  ts: z.string(),
  kind: z.enum(["turn", "tool", "error", "knowledge", "ocr", "gov", "batch"]),
  name: z.string().optional(),
  status: z.enum(["start", "ok", "error"]).optional(),
  ms: z.number().optional(),
  chatId: z.number().optional(),
  appId: z.number().optional(),
  detail: z.string().optional(),
});

export const activityContracts = {
  list: defineContract({
    channel: "activity:list",
    input: z.object({ errorsOnly: z.boolean().optional() }),
    output: z.object({
      path: z.string(),
      events: z.array(ActivityEventSchema),
    }),
  }),
  clear: defineContract({
    channel: "activity:clear",
    input: z.void(),
    output: z.void(),
  }),
  openFolder: defineContract({
    channel: "activity:open-folder",
    input: z.void(),
    output: z.void(),
  }),
} as const;

export const activityClient = createClient(activityContracts);
