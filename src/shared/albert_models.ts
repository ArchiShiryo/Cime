// Side-effect-free helpers that turn Albert's GET /v1/models payload into the
// chat models Cimes offers. Albert has no hard-coded roster in its docs: the
// list (ids and max_context_length) comes from the API itself.

export interface AlbertModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
}

const NON_CHAT_ID = /embed|rerank|whisper|audio|speech|tts|ocr|transcri/i;
const DEFAULT_CONTEXT_WINDOW = 32_768;
const MIN_CONTEXT_WINDOW = 4_096;
const MAX_OUTPUT_TOKENS = 8_192;

export function parseAlbertModels(data: unknown): AlbertModelInfo[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const models: AlbertModelInfo[] = [];
  for (const entry of data) {
    const { id, type, max_context_length } = (entry ?? {}) as Record<
      string,
      unknown
    >;
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    const isChat =
      type === "text-generation" ||
      (type === undefined && !NON_CHAT_ID.test(id));
    if (!isChat) continue;
    seen.add(id);
    const contextWindow =
      typeof max_context_length === "number" &&
      Number.isFinite(max_context_length) &&
      max_context_length >= MIN_CONTEXT_WINDOW
        ? Math.floor(max_context_length)
        : DEFAULT_CONTEXT_WINDOW;
    models.push({
      id,
      displayName: `${id} - Albert`,
      contextWindow,
      // Output is sent verbatim as max tokens: keep it well below the window.
      maxOutputTokens: Math.min(
        MAX_OUTPUT_TOKENS,
        Math.floor(contextWindow / 4),
      ),
    });
  }
  return models;
}
