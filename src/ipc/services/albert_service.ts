import log from "electron-log";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { language_model_providers, language_models } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import {
  findInvalidProviderApiKeyCharacter,
  normalizeProviderApiKeyInput,
} from "@/lib/providerApiKey";
import { readSettings, writeSettings } from "@/main/settings";
import {
  parseAlbertModels,
  type AlbertModelInfo,
} from "@/shared/albert_models";
import { systemFetch } from "@/ipc/utils/system_fetch";
import {
  ALBERT_API_BASE_URL,
  ALBERT_CONTEXT_WINDOW,
  ALBERT_KNOWN_MODELS,
  ALBERT_ENV_VAR_NAME,
  ALBERT_MAX_OUTPUT_TOKENS,
  ALBERT_MODEL_DISPLAY_NAME,
  ALBERT_MODEL_ID,
  ALBERT_PROVIDER_DISPLAY_NAME,
  ALBERT_PROVIDER_ID,
} from "@/shared/albert";
import type { AlbertStatus } from "@/ipc/types/albert";

// Never log the API key or the Authorization header from this module.
const logger = log.scope("albert");

const VALIDATION_TIMEOUT_MS = 15_000;

// Test-only: the packaged-app e2e scripts (testing/cimes-e2e) point Cimes at
// another OpenAI-compatible endpoint. Ignored unless CIMES_E2E=1.
function getAlbertBaseUrl(): string {
  return (
    (process.env.CIMES_E2E === "1" && process.env.CIMES_E2E_BASE_URL) ||
    ALBERT_API_BASE_URL
  );
}
function getAlbertModelId(): string {
  return (
    (process.env.CIMES_E2E === "1" && process.env.CIMES_E2E_MODEL) ||
    ALBERT_MODEL_ID
  );
}

/**
 * Idempotently creates or repairs the Albert provider and its default model.
 * Runs at startup and before connecting, so an existing install (with or
 * without a hand-made Albert provider) converges on the right limits instead
 * of getting a duplicate.
 */
export function ensureAlbertProvider(): void {
  db.insert(language_model_providers)
    .values({
      id: ALBERT_PROVIDER_ID,
      name: ALBERT_PROVIDER_DISPLAY_NAME,
      api_base_url: getAlbertBaseUrl(),
      env_var_name: ALBERT_ENV_VAR_NAME,
    })
    .onConflictDoUpdate({
      target: language_model_providers.id,
      set: {
        name: ALBERT_PROVIDER_DISPLAY_NAME,
        api_base_url: getAlbertBaseUrl(),
        env_var_name: ALBERT_ENV_VAR_NAME,
        updatedAt: new Date(),
      },
    })
    .run();

  const modelValues = {
    displayName: ALBERT_MODEL_DISPLAY_NAME,
    apiName: getAlbertModelId(),
    customProviderId: ALBERT_PROVIDER_ID,
    max_output_tokens: ALBERT_MAX_OUTPUT_TOKENS,
    context_window: ALBERT_CONTEXT_WINDOW,
  };
  const existing = db
    .select({ id: language_models.id })
    .from(language_models)
    .where(
      and(
        eq(language_models.customProviderId, ALBERT_PROVIDER_ID),
        eq(language_models.apiName, getAlbertModelId()),
      ),
    )
    .all();

  if (existing.length === 0) {
    db.insert(language_models).values(modelValues).run();
  } else {
    // Fix the limits of the first match and drop accidental duplicates.
    db.update(language_models)
      .set({ ...modelValues, updatedAt: new Date() })
      .where(eq(language_models.id, existing[0].id))
      .run();
    for (const duplicate of existing.slice(1)) {
      db.delete(language_models)
        .where(eq(language_models.id, duplicate.id))
        .run();
    }
  }
  // Other Albert chat models (GPT-OSS, Mistral, Qwen…): added when missing,
  // never overwritten, since a connected key refreshes their real limits.
  for (const known of ALBERT_KNOWN_MODELS) {
    const present = db
      .select({ id: language_models.id })
      .from(language_models)
      .where(
        and(
          eq(language_models.customProviderId, ALBERT_PROVIDER_ID),
          eq(language_models.apiName, known.id),
        ),
      )
      .all();
    if (present.length === 0) {
      db.insert(language_models)
        .values({
          displayName: known.displayName,
          apiName: known.id,
          customProviderId: ALBERT_PROVIDER_ID,
          context_window: known.contextWindow,
          max_output_tokens: ALBERT_MAX_OUTPUT_TOKENS,
        })
        .run();
    }
  }
  logger.info("provider initialized");
}

/**
 * Checks the key against GET /v1/models: HTTP 200 and the default model
 * must be listed.
 */
export async function validateAlbertApiKey(
  rawKey: string,
): Promise<AlbertModelInfo[]> {
  const apiKey = normalizeProviderApiKeyInput(rawKey);
  if (!apiKey) {
    throw new DyadError("Enter your Albert API key.", DyadErrorKind.Validation);
  }
  if (findInvalidProviderApiKeyCharacter(apiKey)) {
    throw new DyadError(
      "This Albert key is not valid.\nCheck it and try again.",
      DyadErrorKind.Validation,
    );
  }

  logger.info("validating API key");
  let response: Response;
  try {
    response = await systemFetch(`${getAlbertBaseUrl()}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn(
      `/v1/models -> unreachable (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)})`,
    );
    throw new DyadError(
      "Could not reach Albert.\nCheck your network connection and try again.",
      DyadErrorKind.Precondition,
    );
  }
  logger.info(`/v1/models -> ${response.status}`);

  if (response.status === 401 || response.status === 403) {
    throw new DyadError(
      "This Albert key is not valid.\nCheck it and try again.",
      DyadErrorKind.Auth,
    );
  }
  if (response.status === 429) {
    throw new DyadError(
      "Albert is temporarily rate-limiting requests.\nTry again in a moment.",
      DyadErrorKind.RateLimited,
    );
  }
  if (!response.ok) {
    throw new DyadError(
      `Albert answered with an error (HTTP ${response.status}).\nTry again later.`,
      DyadErrorKind.External,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DyadError(
      "Unexpected answer from Albert.\nTry again later.",
      DyadErrorKind.External,
    );
  }
  const data = (body as { data?: unknown } | null)?.data;
  const hasModel =
    Array.isArray(data) &&
    data.some((m) => (m as { id?: unknown } | null)?.id === getAlbertModelId());
  if (!hasModel) {
    throw new DyadError(
      `The model ${getAlbertModelId()} is not available with this Albert key.`,
      DyadErrorKind.Precondition,
    );
  }
  logger.info(`${getAlbertModelId()} available`);
  return parseAlbertModels(data);
}

/**
 * Offers every chat model the key can use. The default model keeps its fixed
 * limits (set by ensureAlbertProvider); others take the limits Albert reports.
 * Models that are no longer listed are left alone.
 */
export function syncAlbertModels(models: AlbertModelInfo[]): void {
  for (const model of models) {
    if (model.id === getAlbertModelId()) continue;
    const values = {
      displayName: model.displayName,
      apiName: model.id,
      customProviderId: ALBERT_PROVIDER_ID,
      max_output_tokens: model.maxOutputTokens,
      context_window: model.contextWindow,
    };
    const existing = db
      .select({ id: language_models.id })
      .from(language_models)
      .where(
        and(
          eq(language_models.customProviderId, ALBERT_PROVIDER_ID),
          eq(language_models.apiName, model.id),
        ),
      )
      .all();
    if (existing.length === 0) {
      db.insert(language_models).values(values).run();
    } else {
      db.update(language_models)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(language_models.id, existing[0].id))
        .run();
    }
  }
  logger.info(`synced ${models.length} Albert chat models`);
}

function getStoredKey(): string | undefined {
  const settings = readSettings();
  return settings.providerSettings?.[ALBERT_PROVIDER_ID]?.apiKey?.value;
}

export function getAlbertStatus(): AlbertStatus {
  const storedKey = getStoredKey();
  // Only a key saved through Cimes counts as connected: an ALBERT_API_KEY
  // environment variable must not skip the onboarding, which is also what
  // selects the Albert model.
  const fromEnvironment =
    !storedKey && Boolean(process.env[ALBERT_ENV_VAR_NAME]);
  return {
    connected: Boolean(storedKey),
    modelDisplayName: ALBERT_MODEL_DISPLAY_NAME,
    fromEnvironment,
  };
}

export async function connectAlbert(rawKey: string): Promise<AlbertStatus> {
  const models = await validateAlbertApiKey(rawKey);
  const apiKey = normalizeProviderApiKeyInput(rawKey);
  ensureAlbertProvider();
  syncAlbertModels(models);

  // Re-read right before writing: validation awaited the network.
  const settings = readSettings();
  writeSettings({
    providerSettings: {
      ...settings.providerSettings,
      [ALBERT_PROVIDER_ID]: {
        ...settings.providerSettings?.[ALBERT_PROVIDER_ID],
        apiKey: { value: apiKey },
      },
    },
    selectedModel: { provider: ALBERT_PROVIDER_ID, name: getAlbertModelId() },
  });
  logger.info("selected as default provider");
  return getAlbertStatus();
}

export async function testAlbertConnection(): Promise<void> {
  const key = getStoredKey() ?? process.env[ALBERT_ENV_VAR_NAME];
  if (!key) {
    throw new DyadError("Albert is not connected.", DyadErrorKind.Precondition);
  }
  // Also refreshes the model list, so new Albert models appear after a test.
  const models = await validateAlbertApiKey(key);
  ensureAlbertProvider();
  syncAlbertModels(models);
}

export function disconnectAlbert(): AlbertStatus {
  const settings = readSettings();
  const { [ALBERT_PROVIDER_ID]: current, ...others } =
    settings.providerSettings ?? {};
  const remaining = current ? { ...current, apiKey: undefined } : undefined;
  writeSettings({
    providerSettings: remaining
      ? { ...others, [ALBERT_PROVIDER_ID]: remaining }
      : others,
  });
  return getAlbertStatus();
}

/** Base URL and key for other Albert endpoints (embeddings…), or null when not connected. */
export function getAlbertConnection(): {
  baseUrl: string;
  apiKey: string;
} | null {
  const apiKey = getStoredKey();
  return apiKey ? { baseUrl: getAlbertBaseUrl(), apiKey } : null;
}
