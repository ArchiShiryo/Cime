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

describe("known Albert models", () => {
  it("keeps the friendly name of a documented model when the API lists it", () => {
    const [gpt] = parseAlbertModels([
      {
        id: "gpt-oss-120b",
        type: "text-generation",
        max_context_length: 131072,
      },
    ]);
    expect(gpt.displayName).toBe("GPT-OSS 120B - Albert");
  });
});

describe("models that cannot be used in agent mode", () => {
  it("does not offer a model that prints its tool calls as text", () => {
    const parsed = parseAlbertModels([
      { id: "qwen3-coder-30b-a3b-instruct", type: "text-generation" },
      { id: "gpt-oss-120b", type: "text-generation" },
    ]);
    expect(parsed.map((m) => m.id)).toEqual(["gpt-oss-120b"]);
  });

  it("sends a reasoning effort only to the families that accept it", async () => {
    const { albertSupportsReasoningEffort } = await import("./albert");
    expect(albertSupportsReasoningEffort("gpt-oss-120b")).toBe(true);
    expect(albertSupportsReasoningEffort("deepseek-v4-flash-0731")).toBe(true);
    expect(albertSupportsReasoningEffort("ministral-3-8b-instruct-2512")).toBe(
      false,
    );
    expect(
      albertSupportsReasoningEffort("mistral-small-3-2-24b-instruct-2506"),
    ).toBe(false);
  });
});
