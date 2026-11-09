import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getUserDataPath } from "@/paths/paths";

export type SourceStatus = "pending" | "indexing" | "ready" | "error";

export interface KnowledgeSource {
  id: number;
  path: string;
  name: string;
  size: number;
  mtime: number;
  status: SourceStatus;
  error: string | null;
  chunkCount: number;
  embeddedCount: number;
  /** "" for the global document base, else the project folder the source belongs to. */
  scope: string;
}

export interface StoredChunk {
  id: number;
  sourceId: number;
  ordinal: number;
  location: string | null;
  text: string;
  embedding: Float32Array | null;
  /** Which engine produced `embedding` (vectors of different engines are not comparable). */
  embedder: string | null;
}

let database: Database.Database | null = null;
let openedAt: string | null = null;

/** Knowledge base database; a plain file in the user data folder, separate from the app database. */
export function getKnowledgeDb(file?: string): Database.Database {
  const target = file ?? path.join(getUserDataPath(), "knowledge.db");
  if (database && openedAt === target) return database;
  database?.close();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  database = new Database(target);
  openedAt = target;
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      mtime INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      location TEXT,
      text TEXT NOT NULL,
      embedding BLOB
    );
    CREATE INDEX IF NOT EXISTS chunks_source ON chunks(source_id);
  `);
  const columns = database.prepare("PRAGMA table_info(chunks)").all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === "embedder")) {
    database.exec("ALTER TABLE chunks ADD COLUMN embedder TEXT");
  }
  const sourceColumns = database
    .prepare("PRAGMA table_info(sources)")
    .all() as {
    name: string;
  }[];
  if (!sourceColumns.some((column) => column.name === "scope")) {
    database.exec(
      "ALTER TABLE sources ADD COLUMN scope TEXT NOT NULL DEFAULT ''",
    );
  }
  database.exec("CREATE INDEX IF NOT EXISTS sources_scope ON sources(scope)");
  return database;
}

export function closeKnowledgeDb(): void {
  database?.close();
  database = null;
  openedAt = null;
}

export function upsertSource(
  file: string,
  name: string,
  size: number,
  mtime: number,
  scope = "",
): number {
  const db = getKnowledgeDb();
  db.prepare(
    `INSERT INTO sources (path, name, size, mtime, status, error, updated_at, scope)
     VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(path) DO UPDATE SET name = excluded.name, size = excluded.size,
       mtime = excluded.mtime, status = 'pending', error = NULL, updated_at = excluded.updated_at,
       scope = excluded.scope`,
  ).run(file, name, size, mtime, Date.now(), scope);
  return (
    db.prepare("SELECT id FROM sources WHERE path = ?").get(file) as {
      id: number;
    }
  ).id;
}

export function setSourceStatus(
  id: number,
  status: SourceStatus,
  error?: string,
): void {
  getKnowledgeDb()
    .prepare(
      "UPDATE sources SET status = ?, error = ?, updated_at = ? WHERE id = ?",
    )
    .run(status, error ?? null, Date.now(), id);
}

export function replaceChunks(
  sourceId: number,
  chunks: {
    location?: string;
    text: string;
    embedding?: Float32Array | null;
  }[],
): void {
  const db = getKnowledgeDb();
  const insert = db.prepare(
    "INSERT INTO chunks (source_id, ordinal, location, text, embedding) VALUES (?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    db.prepare("DELETE FROM chunks WHERE source_id = ?").run(sourceId);
    chunks.forEach((chunk, ordinal) =>
      insert.run(
        sourceId,
        ordinal,
        chunk.location ?? null,
        chunk.text,
        chunk.embedding
          ? Buffer.from(
              chunk.embedding.buffer,
              chunk.embedding.byteOffset,
              chunk.embedding.byteLength,
            )
          : null,
      ),
    );
  })();
}

export function setChunkEmbedding(
  chunkId: number,
  embedding: Float32Array,
  embedder: string,
): void {
  getKnowledgeDb()
    .prepare("UPDATE chunks SET embedding = ?, embedder = ? WHERE id = ?")
    .run(
      Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength),
      embedder,
      chunkId,
    );
}

/** Sources with passage counts; `embeddedCount` counts vectors whose embedder starts with `embedderPrefix` (any when omitted). */
export function listSources(
  embedderPrefix?: string | null,
  scope = "",
): KnowledgeSource[] {
  return getKnowledgeDb()
    .prepare(
      `SELECT s.id, s.path, s.name, s.size, s.mtime, s.status, s.error, s.scope,
              COUNT(c.id) AS chunkCount,
              COUNT(CASE WHEN c.embedding IS NOT NULL AND (? IS NULL OR c.embedder LIKE ? || '%') THEN 1 END) AS embeddedCount
       FROM sources s LEFT JOIN chunks c ON c.source_id = s.id
       WHERE s.scope = ?
       GROUP BY s.id ORDER BY s.name COLLATE NOCASE`,
    )
    .all(
      embedderPrefix ?? null,
      embedderPrefix ?? null,
      scope,
    ) as KnowledgeSource[];
}

export function getSource(id: number): KnowledgeSource | undefined {
  const row = getKnowledgeDb()
    .prepare("SELECT scope FROM sources WHERE id = ?")
    .get(id) as { scope: string } | undefined;
  if (!row) return undefined;
  return listSources(null, row.scope).find((source) => source.id === id);
}

export function removeSource(id: number): void {
  getKnowledgeDb().prepare("DELETE FROM sources WHERE id = ?").run(id);
}

function toVector(blob: Buffer | null): Float32Array | null {
  if (!blob) return null;
  const copy = new Uint8Array(blob.byteLength);
  copy.set(blob);
  return new Float32Array(copy.buffer);
}

export function loadReadyChunks(
  scope = "",
): (StoredChunk & { sourceName: string })[] {
  const rows = getKnowledgeDb()
    .prepare(
      `SELECT c.id, c.source_id AS sourceId, c.ordinal, c.location, c.text, c.embedding, c.embedder, s.name AS sourceName
       FROM chunks c JOIN sources s ON s.id = c.source_id WHERE s.status = 'ready' AND s.scope = ?`,
    )
    .all(scope) as (Omit<StoredChunk, "embedding"> & {
    embedding: Buffer | null;
    sourceName: string;
  })[];
  return rows.map((row) => ({ ...row, embedding: toVector(row.embedding) }));
}

/** Passages with no vector from `embedder` (never embedded, or embedded by another engine). */
export function loadUnembeddedChunks(
  embedder: string,
  limit: number,
): { id: number; text: string }[] {
  return getKnowledgeDb()
    .prepare(
      "SELECT id, text FROM chunks WHERE embedding IS NULL OR embedder IS NOT ? ORDER BY id LIMIT ?",
    )
    .all(embedder, limit) as { id: number; text: string }[];
}
