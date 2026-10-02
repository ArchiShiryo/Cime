import { dialog } from "electron";
import { createTypedHandler } from "./base";
import { knowledgeContracts } from "../types/knowledge";
import {
  addToKnowledgeBase,
  deleteSource,
  listSources,
  reindexSource,
} from "@/knowledge/service";
import { SUPPORTED_EXTENSIONS } from "@/knowledge/extract";

export function registerKnowledgeHandlers() {
  createTypedHandler(knowledgeContracts.list, async () =>
    listSources().map((source) => ({
      id: source.id,
      path: source.path,
      name: source.name,
      size: source.size,
      status: source.status,
      error: source.error,
      chunkCount: source.chunkCount,
      embeddedCount: source.embeddedCount,
    })),
  );

  createTypedHandler(knowledgeContracts.add, async (_event, { kind }) => {
    const result = await dialog.showOpenDialog({
      properties:
        kind === "folder" ? ["openDirectory"] : ["openFile", "multiSelections"],
      filters:
        kind === "files"
          ? [
              {
                name: "Documents",
                extensions: SUPPORTED_EXTENSIONS.map((ext) => ext.slice(1)),
              },
            ]
          : undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return addToKnowledgeBase(result.filePaths);
  });

  createTypedHandler(knowledgeContracts.remove, async (_event, { id }) => {
    deleteSource(id);
  });
  createTypedHandler(knowledgeContracts.reindex, async (_event, { id }) => {
    reindexSource(id);
  });
}
