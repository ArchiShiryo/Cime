import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { createTypedHandler } from "./base";
import { memoryContracts } from "../types/memory";
import { isProjectPath } from "@/projects/config";
import {
  forgetMemory,
  listMemories,
  readMemory,
  saveMemory,
  type MemoryScope,
} from "@/memory/store";

async function projectPathFor(
  scope: MemoryScope,
  appId?: number,
): Promise<string | undefined> {
  if (scope === "personal") return undefined;
  if (appId === undefined) {
    throw new DyadError(
      "appId is required for project memory",
      DyadErrorKind.Validation,
    );
  }
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) throw new DyadError("Project not found", DyadErrorKind.NotFound);
  const path = getDyadAppPath(app.path);
  if (!isProjectPath(path)) {
    throw new DyadError("This app is not a project", DyadErrorKind.Validation);
  }
  return path;
}

export function registerMemoryHandlers() {
  createTypedHandler(memoryContracts.list, async (_e, { scope, appId }) =>
    listMemories(scope, await projectPathFor(scope, appId)),
  );
  createTypedHandler(memoryContracts.read, async (_e, { scope, appId, id }) =>
    readMemory(scope, id, await projectPathFor(scope, appId)),
  );
  createTypedHandler(
    memoryContracts.save,
    async (_e, { scope, appId, ...input }) =>
      saveMemory(scope, input, await projectPathFor(scope, appId)),
  );
  createTypedHandler(
    memoryContracts.forget,
    async (_e, { scope, appId, id }) => {
      forgetMemory(scope, id, await projectPathFor(scope, appId));
    },
  );
}
