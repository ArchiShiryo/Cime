import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const splashContracts = {
  // Sent once the renderer has painted the real app, so the splash screen can
  // hand over to a window that is not blank.
  rendererReady: defineContract({
    channel: "splash:renderer-ready",
    input: z.void(),
    output: z.void(),
  }),
} as const;

export const splashClient = createClient(splashContracts);
