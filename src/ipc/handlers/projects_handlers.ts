import fs from "node:fs";
import path from "node:path";
import { dialog, shell } from "electron";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { getDyadAppPath } from "@/paths/paths";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { createTypedHandler } from "./base";
import { projectsContracts, type ProjectConfigInfo } from "../types/projects";
import {
  getDocumentationDir,
  readProjectConfig,
  writeProjectConfig,
} from "@/projects/config";
import {
  addToKnowledgeBase,
  collectFiles,
  deleteSource,
  listSourcesWithProgress,
} from "@/knowledge/service";
import { SUPPORTED_EXTENSIONS } from "@/knowledge/extract";

async function getProject(appId: number) {
  const app = await db.query.apps.findFirst({ where: eq(apps.id, appId) });
  if (!app) throw new DyadError("Project not found", DyadErrorKind.NotFound);
  const projectPath = getDyadAppPath(app.path);
  const config = readProjectConfig(projectPath);
  if (!config) {
    throw new DyadError("This app is not a project", DyadErrorKind.Validation);
  }
  return { projectPath, config };
}

function toInfo(
  projectPath: string,
  config: NonNullable<ReturnType<typeof readProjectConfig>>,
): ProjectConfigInfo {
  return {
    templateId: config.templateId,
    enabledSkills: config.enabledSkills,
    instructions: config.instructions,
    path: projectPath,
    documentationPath: getDocumentationDir(projectPath),
  };
}

/** Copies `source` into `dir` without overwriting: "a.pdf" → "a (2).pdf". */
function copyInto(dir: string, source: string): string {
  const { name, ext } = path.parse(source);
  let target = path.join(dir, `${name}${ext}`);
  for (let n = 2; fs.existsSync(target); n++) {
    target = path.join(dir, `${name} (${n})${ext}`);
  }
  fs.copyFileSync(source, target);
  return target;
}

/** Indexes everything under Documentation and drops sources whose file disappeared. */
async function indexDocumentation(projectPath: string): Promise<number> {
  const docs = getDocumentationDir(projectPath);
  fs.mkdirSync(docs, { recursive: true });
  const files = await collectFiles([docs]);
  for (const source of listSourcesWithProgress(projectPath)) {
    if (!fs.existsSync(source.path)) deleteSource(source.id);
  }
  return addToKnowledgeBase(files, projectPath);
}

export function registerProjectsHandlers() {
  createTypedHandler(projectsContracts.getConfig, async (_e, { appId }) => {
    const { projectPath, config } = await getProject(appId);
    return toInfo(projectPath, config);
  });

  createTypedHandler(projectsContracts.updateConfig, async (_e, params) => {
    const { projectPath, config } = await getProject(params.appId);
    const next = {
      ...config,
      enabledSkills: params.enabledSkills ?? config.enabledSkills,
      instructions: params.instructions ?? config.instructions,
    };
    writeProjectConfig(projectPath, next);
    return toInfo(projectPath, next);
  });

  createTypedHandler(projectsContracts.docsList, async (_e, { appId }) => {
    const { projectPath } = await getProject(appId);
    return listSourcesWithProgress(projectPath).map((source) => ({
      id: source.id,
      path: source.path,
      name: source.name,
      size: source.size,
      status: source.status,
      error: source.error,
      chunkCount: source.chunkCount,
      embeddedCount: source.embeddedCount,
    }));
  });

  createTypedHandler(projectsContracts.docsAdd, async (_e, { appId, kind }) => {
    const { projectPath } = await getProject(appId);
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
    const docs = getDocumentationDir(projectPath);
    fs.mkdirSync(docs, { recursive: true });
    const sources = await collectFiles(result.filePaths);
    const copies = sources.map((file) => copyInto(docs, file));
    return addToKnowledgeBase(copies, projectPath);
  });

  createTypedHandler(projectsContracts.docsIndex, async (_e, { appId }) => {
    const { projectPath } = await getProject(appId);
    return indexDocumentation(projectPath);
  });

  createTypedHandler(
    projectsContracts.openFolder,
    async (_e, { appId, target }) => {
      const { projectPath } = await getProject(appId);
      const folder =
        target === "documentation"
          ? getDocumentationDir(projectPath)
          : projectPath;
      fs.mkdirSync(folder, { recursive: true });
      await shell.openPath(folder);
    },
  );
}
