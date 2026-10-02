import { describe, expect, it } from "vitest";
import { parseAlbertModels } from "./albert_models";

describe("parseAlbertModels", () => {
  it("keeps text-generation models and drops embeddings, rerankers and audio", () => {
    const models = parseAlbertModels([
      { id: "llama-x", type: "text-generation", max_context_length: 131072 },
      { id: "embed-y", type: "text-embeddings-inference" },
      { id: "rerank-z", type: "text-classification" },
      { id: "whisper-w", type: "automatic-speech-recognition" },
      { id: "mistral-q", type: "text-generation", max_context_length: 32768 },
    ]);
    expect(models.map((m) => m.id)).toEqual(["llama-x", "mistral-q"]);
    expect(models[0]).toMatchObject({
      displayName: "llama-x - Albert",
      contextWindow: 131072,
      maxOutputTokens: 8192,
    });
  });

  it("falls back on id heuristics when the payload has no type", () => {
    const models = parseAlbertModels([
      { id: "deepseek-flash" },
      { id: "bge-embedding-m3" },
    ]);
    expect(models.map((m) => m.id)).toEqual(["deepseek-flash"]);
  });

  it("uses a safe context and a small output budget when limits are odd", () => {
    const [small, missing] = parseAlbertModels([
      { id: "tiny", type: "text-generation", max_context_length: 8192 },
      { id: "nolimit", type: "text-generation" },
    ]);
    expect(small.maxOutputTokens).toBe(2048);
    expect(missing.contextWindow).toBe(32768);
    expect(missing.maxOutputTokens).toBe(8192);
  });

  it("ignores duplicates and malformed entries", () => {
    expect(
      parseAlbertModels([
        null,
        3,
        { id: 5 },
        { id: "a", type: "text-generation" },
        { id: "a", type: "text-generation" },
      ]).map((m) => m.id),
    ).toEqual(["a"]);
    expect(parseAlbertModels(undefined)).toEqual([]);
  });
});
