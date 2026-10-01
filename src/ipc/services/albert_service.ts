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
  ALBERT_API_BASE_URL,
  ALBERT_CONTEXT_WINDOW,
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
      api_base_url: ALBERT_API_BASE_URL,
      env_var_name: ALBERT_ENV_VAR_NAME,
    })
    .onConflictDoUpdate({
      target: language_model_providers.id,
      set: {
        name: ALBERT_PROVIDER_DISPLAY_NAME,
        api_base_url: ALBERT_API_BASE_URL,
        env_var_name: ALBERT_ENV_VAR_NAME,
        updatedAt: new Date(),
      },
    })
    .run();

  const modelValues = {
    displayName: ALBERT_MODEL_DISPLAY_NAME,
    apiName: ALBERT_MODEL_ID,
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
        eq(language_models.apiName, ALBERT_MODEL_ID),
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
  logger.info("provider initialized");
}

/**
 * Checks the key against GET /v1/models: HTTP 200 and the default model
 * must be listed.
 */
export async function validateAlbertApiKey(rawKey: string): Promise<void> {
  const apiKey = normalizeProviderApiKeyInput(rawKey);
  if (!apiKey) {
    throw new DyadError(
      "Entrez votre clé API Albert.",
      DyadErrorKind.Validation,
    );
  }
  if (findInvalidProviderApiKeyCharacter(apiKey)) {
    throw new DyadError(
      "Cette clé Albert n'est pas valide.\nVérifiez-la puis réessayez.",
      DyadErrorKind.Validation,
    );
  }

  logger.info("validating API key");
  let response: Response;
  try {
    response = await fetch(`${ALBERT_API_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
    });
  } catch {
    logger.warn("/v1/models -> unreachable");
    throw new DyadError(
      "Impossible de joindre Albert.\nVérifiez votre connexion réseau puis réessayez.",
      DyadErrorKind.Precondition,
    );
  }
  logger.info(`/v1/models -> ${response.status}`);

  if (response.status === 401 || response.status === 403) {
    throw new DyadError(
      "Cette clé Albert n'est pas valide.\nVérifiez-la puis réessayez.",
      DyadErrorKind.Auth,
    );
  }
  if (response.status === 429) {
    throw new DyadError(
      "Albert limite temporairement les requêtes.\nRéessayez dans un instant.",
      DyadErrorKind.RateLimited,
    );
  }
  if (!response.ok) {
    throw new DyadError(
      `Albert a répondu avec une erreur (HTTP ${response.status}).\nRéessayez plus tard.`,
      DyadErrorKind.External,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DyadError(
      "Réponse inattendue d'Albert.\nRéessayez plus tard.",
      DyadErrorKind.External,
    );
  }
  const data = (body as { data?: unknown } | null)?.data;
  const hasModel =
    Array.isArray(data) &&
    data.some((m) => (m as { id?: unknown } | null)?.id === ALBERT_MODEL_ID);
  if (!hasModel) {
    throw new DyadError(
      `Le modèle ${ALBERT_MODEL_ID} n'est pas disponible avec cette clé Albert.`,
      DyadErrorKind.Precondition,
    );
  }
  logger.info(`${ALBERT_MODEL_ID} available`);
}

function getStoredKey(): string | undefined {
  const settings = readSettings();
  return settings.providerSettings?.[ALBERT_PROVIDER_ID]?.apiKey?.value;
}

export function getAlbertStatus(): AlbertStatus {
  const storedKey = getStoredKey();
  const fromEnvironment =
    !storedKey && Boolean(process.env[ALBERT_ENV_VAR_NAME]);
  return {
    connected: Boolean(storedKey) || fromEnvironment,
    modelDisplayName: ALBERT_MODEL_DISPLAY_NAME,
    fromEnvironment,
  };
}

export async function connectAlbert(rawKey: string): Promise<AlbertStatus> {
  await validateAlbertApiKey(rawKey);
  const apiKey = normalizeProviderApiKeyInput(rawKey);
  ensureAlbertProvider();

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
    selectedModel: { provider: ALBERT_PROVIDER_ID, name: ALBERT_MODEL_ID },
  });
  logger.info("selected as default provider");
  return getAlbertStatus();
}

export async function testAlbertConnection(): Promise<void> {
  const key = getStoredKey() ?? process.env[ALBERT_ENV_VAR_NAME];
  if (!key) {
    throw new DyadError(
      "Albert n'est pas connecté.",
      DyadErrorKind.Precondition,
    );
  }
  await validateAlbertApiKey(key);
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
