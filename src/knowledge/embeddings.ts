/**
 * Embeddings through the Albert API (POST /v1/embeddings). Vectors are only
 * used to improve retrieval: every caller falls back to keyword search when
 * Albert is unreachable or no embedding model is available.
 */
import { systemFetch } from "@/ipc/utils/system_fetch";
import { getAlbertConnection } from "@/ipc/services/albert_service";
import { normalizeVector } from "./ranking";

const BATCH_SIZE = 16;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_INPUT_CHARS = 2000;
const EMBEDDING_ID = /embed|bge|e5|gte|arctic|minilm/i;

export interface EmbeddingEngine {
  model: string;
  embedPassages(texts: string[], signal?: AbortSignal): Promise<Float32Array[]>;
  embedQuery(text: string, signal?: AbortSignal): Promise<Float32Array>;
}

function authHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/** Picks an embedding model from GET /v1/models payload (`type` when present, else by name). */
export function pickEmbeddingModel(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  const candidates = data
    .map((entry) => (entry ?? {}) as { id?: unknown; type?: unknown })
    .filter(
      (entry): entry is { id: string; type?: unknown } =>
        typeof entry.id === "string",
    )
    .filter(
      (entry) =>
        (typeof entry.type === "string" && /embedding/i.test(entry.type)) ||
        (entry.type === undefined && EMBEDDING_ID.test(entry.id)),
    );
  if (candidates.length === 0) return null;
  // Prefer multilingual general-purpose models over vision-language ones.
  const ranked = [...candidates].sort(
    (a, b) =>
      Number(/vl|vision|image/i.test(a.id)) -
      Number(/vl|vision|image/i.test(b.id)),
  );
  return ranked[0].id;
}

export function prefixesFor(model: string): { query: string; passage: string } {
  return /e5/i.test(model)
    ? { query: "query: ", passage: "passage: " }
    : { query: "", passage: "" };
}

export async function getEmbeddingEngine(
  signal?: AbortSignal,
): Promise<EmbeddingEngine | null> {
  const connection = getAlbertConnection();
  if (!connection) return null;
  let model: string | null = null;
  try {
    const response = await systemFetch(`${connection.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${connection.apiKey}` },
      signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    model = pickEmbeddingModel(
      ((await response.json()) as { data?: unknown }).data,
    );
  } catch {
    return null;
  }
  if (!model) return null;
  const chosen = model;
  const prefixes = prefixesFor(chosen);

  const embed = async (
    inputs: string[],
    signalArg?: AbortSignal,
  ): Promise<Float32Array[]> => {
    const response = await systemFetch(`${connection.baseUrl}/embeddings`, {
      method: "POST",
      headers: authHeaders(connection.apiKey),
      body: JSON.stringify({
        model: chosen,
        input: inputs,
        encoding_format: "float",
      }),
      signal: signalArg ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok)
      throw new Error(`Embeddings request failed (HTTP ${response.status})`);
    const body = (await response.json()) as {
      data?: { index?: number; embedding?: number[] }[];
    };
    const rows = [...(body.data ?? [])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    if (
      rows.length !== inputs.length ||
      rows.some((row) => !Array.isArray(row.embedding))
    ) {
      throw new Error("Unexpected embeddings response");
    }
    return rows.map((row) => normalizeVector(row.embedding as number[]));
  };

  return {
    model: chosen,
    async embedPassages(texts, signalArg) {
      const vectors: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts
          .slice(i, i + BATCH_SIZE)
          .map(
            (text) => `${prefixes.passage}${text.slice(0, MAX_INPUT_CHARS)}`,
          );
        vectors.push(...(await embed(batch, signalArg)));
      }
      return vectors;
    },
    async embedQuery(text, signalArg) {
      return (
        await embed(
          [`${prefixes.query}${text.slice(0, MAX_INPUT_CHARS)}`],
          signalArg,
        )
      )[0];
    },
  };
}
