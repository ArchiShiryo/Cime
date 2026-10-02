// Side-effect-free constants for the Albert (DINUM) provider. Safe to import
// from both the main process and the renderer.

export const ALBERT_PROVIDER_NAME = "albert";
// Custom providers are stored with this prefix (see CUSTOM_PROVIDER_PREFIX).
export const ALBERT_PROVIDER_ID = `custom::${ALBERT_PROVIDER_NAME}`;
export const ALBERT_PROVIDER_DISPLAY_NAME = "Albert - DINUM";
export const ALBERT_API_BASE_URL = "https://albert.api.etalab.gouv.fr/v1";
export const ALBERT_ENV_VAR_NAME = "ALBERT_API_KEY";

export const ALBERT_MODEL_ID = "deepseek-v4-flash-0731";
export const ALBERT_MODEL_DISPLAY_NAME = "DeepSeek V4 Flash - Albert";
export const ALBERT_CONTEXT_WINDOW = 131_072;
// Must stay well below the context window: Dyad sends this verbatim as the
// request's max tokens, and reserving the whole window for output makes every
// request fail.
export const ALBERT_MAX_OUTPUT_TOKENS = 8_192;

// Other chat models listed in the Albert API guide (guides.ia.numerique.gouv.fr).
// They are offered from the first launch; once a key is connected, the limits
// are refreshed from GET /v1/models (see albert_models.ts). Limits here are
// conservative until then.
export interface AlbertKnownModel {
  id: string;
  displayName: string;
  contextWindow: number;
}

export const ALBERT_KNOWN_MODELS: readonly AlbertKnownModel[] = [
  {
    id: "gpt-oss-120b",
    displayName: "GPT-OSS 120B - Albert",
    contextWindow: 131_072,
  },
  {
    id: "mistral-medium-2508",
    displayName: "Mistral Medium - Albert",
    contextWindow: 131_072,
  },
  {
    id: "mistral-small-3-2-24b-instruct-2506",
    displayName: "Mistral Small 3.2 24B - Albert",
    contextWindow: 131_072,
  },
  {
    id: "ministral-3-8b-instruct-2512",
    displayName: "Ministral 3 8B - Albert",
    contextWindow: 131_072,
  },
  {
    id: "qwen3-coder-30b-a3b-instruct",
    displayName: "Qwen3 Coder 30B - Albert",
    contextWindow: 131_072,
  },
];
