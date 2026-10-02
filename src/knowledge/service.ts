import fs from "node:fs";
import path from "node:path";
import log from "electron-log";
import { readSettings } from "@/main/settings";
import { chunkText } from "./chunker";
import { getEmbeddingEngine, type EmbeddingEngine } from "./embeddings";
import {
  getLocalEmbeddingEngine,
  isLocalEmbeddingAvailable,
} from "./local_embeddings";
import { extractDocument, SUPPORTED_EXTENSIONS } from "./extract";
import {
  bm25Scores,
  dot,
  fuseRankings,
  rankIds,
  tokenizeForSearch,
} from "./ranking";
import {
  getSource,
  listSources,
  loadReadyChunks,
  loadUnembeddedChunks,
  removeSource,
  replaceChunks,
  setChunkEmbedding,
  setSourceStatus,
  upsertSource,
  type KnowledgeSource,
} from "./store";

const logger = log.scope("knowledge");

export const MAX_FILES_PER_IMPORT = 500;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CHUNKS_PER_FILE = 4000;
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

export interface SearchHit {
  source: string;
  location: string | null;
  text: string;
  score: number;
}

/** Files (and, recursively, files inside folders) the knowledge base can read. */
export async function collectFiles(inputs: string[]): Promise<string[]> {
  const found: string[] = [];
  const supported = new Set<string>(SUPPORTED_EXTENSIONS);
  const visit = async (target: string): Promise<void> => {
    if (found.length >= MAX_FILES_PER_IMPORT) return;
    const stat = await fs.promises.stat(target).catch(() => null);
    if (!stat) return;
    if (stat.isDirectory()) {
      for (const entry of await fs.promises.readdir(target)) {
        if (entry.startsWith(".") || SKIPPED_DIRS.has(entry)) continue;
        await visit(path.join(target, entry));
      }
    } else if (
      stat.isFile() &&
      supported.has(path.extname(target).toLowerCase())
    ) {
      if (stat.size <= MAX_FILE_BYTES) found.push(target);
    }
  };
  for (const input of inputs) await visit(input);
  return found;
}

let queue: Promise<void> = Promise.resolve();

/** Resolves when every queued indexing job has finished. */
export function waitForKnowledgeIdle(): Promise<void> {
  return queue;
}

/** Registers files and indexes them in the background (one at a time). */
export async function addToKnowledgeBase(
  inputs: string[],
  scope = "",
): Promise<number> {
  const files = await collectFiles(inputs);
  const ids: number[] = [];
  for (const file of files) {
    const stat = await fs.promises.stat(file);
    ids.push(
      upsertSource(
        file,
        path.basename(file),
        stat.size,
        Math.floor(stat.mtimeMs),
        scope,
      ),
    );
  }
  for (const id of ids)
    queue = queue.then(() => indexSource(id)).catch(() => undefined);
  return ids.length;
}

export function reindexSource(id: number): void {
  const source = getSource(id);
  if (!source) return;
  setSourceStatus(id, "pending");
  queue = queue.then(() => indexSource(id)).catch(() => undefined);
}

export function deleteSource(id: number): void {
  removeSource(id);
}

export type EmbeddingMode = "local" | "albert" | "keywords";

export function isLocalModelInstalled(): boolean {
  return isLocalEmbeddingAvailable();
}

export function getEmbeddingMode(): EmbeddingMode {
  return readSettings().knowledgeEmbeddingMode ?? "local";
}

/** The engine for the selected mode, or null (keywords only, or engine unavailable). */
async function resolveEngine(
  signal?: AbortSignal,
): Promise<EmbeddingEngine | null> {
  const mode = getEmbeddingMode();
  if (mode === "keywords") return null;
  if (mode === "local") return getLocalEmbeddingEngine();
  return getEmbeddingEngine(signal);
}

async function indexSource(id: number): Promise<void> {
  const source = getSource(id);
  if (!source) return;
  setSourceStatus(id, "indexing");
  try {
    const inputs = await extractDocument(source.path);
    const chunks = inputs
      .flatMap((input) => chunkText(input))
      .slice(0, MAX_CHUNKS_PER_FILE);
    if (chunks.length === 0) {
      setSourceStatus(
        id,
        "error",
        "Aucun texte lisible (PDF scanné ou fichier vide ?). Un PDF scanné nécessite de l'OCR.",
      );
      return;
    }
    replaceChunks(id, chunks);
    setSourceStatus(id, "ready");
    await embedPending();
  } catch (error) {
    logger.warn(`Indexing failed for ${source.name}:`, error);
    setSourceStatus(
      id,
      "error",
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Computes embeddings for passages that lack one. Silent when Albert is unavailable. */
export async function embedPending(): Promise<void> {
  try {
    const engine = await resolveEngine();
    if (!engine) return;
    for (;;) {
      const batch = loadUnembeddedChunks(engine.model, 64);
      if (batch.length === 0) return;
      const vectors = await engine.embedPassages(
        batch.map((chunk) => chunk.text),
      );
      batch.forEach((chunk, index) =>
        setChunkEmbedding(chunk.id, vectors[index], engine.model),
      );
    }
  } catch (error) {
    logger.warn("Embedding failed; keyword search stays available:", error);
  }
}

export function getKnowledgeStats(scope = ""): {
  sources: number;
  ready: number;
  chunks: number;
} {
  const sources = listSources(null, scope);
  return {
    sources: sources.length,
    ready: sources.filter((source) => source.status === "ready").length,
    chunks: sources.reduce((sum, source) => sum + source.chunkCount, 0),
  };
}

/** Sources with the number of passages already analysed by the current engine. */
export function listSourcesWithProgress(scope = ""): KnowledgeSource[] {
  const mode = getEmbeddingMode();
  if (mode === "keywords") {
    return listSources(null, scope).map((source) => ({
      ...source,
      embeddedCount: 0,
    }));
  }
  return listSources(mode === "local" ? "local:" : "albert:", scope);
}

export { listSources };
export type { KnowledgeSource };

/** Hybrid search: BM25 over every passage, plus cosine over embedded passages when available. */
export async function searchKnowledge(
  query: string,
  limit = 6,
  signal?: AbortSignal,
  scope = "",
): Promise<SearchHit[]> {
  const chunks = loadReadyChunks(scope);
  if (chunks.length === 0) return [];
  const keyword = bm25Scores(
    tokenizeForSearch(query),
    chunks.map((chunk) => ({
      id: chunk.id,
      tokens: tokenizeForSearch(chunk.text),
    })),
  );
  const rankings = [rankIds(keyword)];
  try {
    const engine = await resolveEngine(signal);
    // Only vectors from the same engine as the query are comparable.
    const embedded = engine
      ? chunks.filter(
          (chunk) => chunk.embedding && chunk.embedder === engine.model,
        )
      : [];
    if (engine && embedded.length > 0) {
      const queryVector = await engine.embedQuery(query, signal);
      const semantic = new Map<number, number>();
      for (const chunk of embedded)
        semantic.set(chunk.id, dot(queryVector, chunk.embedding!));
      rankings.push(rankIds(semantic).slice(0, 50));
    }
  } catch (error) {
    logger.warn("Semantic search unavailable, using keywords only:", error);
  }
  const fused = fuseRankings(rankings);
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  return rankIds(fused)
    .slice(0, limit)
    .map((id) => {
      const chunk = byId.get(id)!;
      return {
        source: chunk.sourceName,
        location: chunk.location,
        text: chunk.text,
        score: Math.round((fused.get(id) ?? 0) * 1000) / 1000,
      };
    });
}
