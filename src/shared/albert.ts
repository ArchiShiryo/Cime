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
