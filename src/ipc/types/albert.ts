import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const AlbertStatusSchema = z.object({
  connected: z.boolean(),
  modelDisplayName: z.string(),
  // True when the key comes from the ALBERT_API_KEY environment variable
  // instead of the encrypted settings.
  fromEnvironment: z.boolean(),
});

export type AlbertStatus = z.infer<typeof AlbertStatusSchema>;

export const albertContracts = {
  getStatus: defineContract({
    channel: "albert:get-status",
    input: z.void(),
    output: AlbertStatusSchema,
  }),
  connect: defineContract({
    channel: "albert:connect",
    input: z.object({ apiKey: z.string() }),
    output: AlbertStatusSchema,
  }),
  testConnection: defineContract({
    channel: "albert:test-connection",
    input: z.void(),
    output: z.object({ ok: z.literal(true) }),
  }),
  disconnect: defineContract({
    channel: "albert:disconnect",
    input: z.void(),
    output: AlbertStatusSchema,
  }),
} as const;

export const albertClient = createClient(albertContracts);
