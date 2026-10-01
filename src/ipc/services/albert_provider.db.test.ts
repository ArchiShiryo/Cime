import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("electron-log", () => {
  const scoped = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { scope: () => scoped } };
});
vi.mock("@/main/settings", () => ({
  readSettings: vi.fn(),
  writeSettings: vi.fn(),
}));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import {
  ALBERT_API_BASE_URL,
  ALBERT_CONTEXT_WINDOW,
  ALBERT_MAX_OUTPUT_TOKENS,
  ALBERT_MODEL_ID,
  ALBERT_PROVIDER_ID,
} from "@/shared/albert";
import { ensureAlbertProvider } from "./albert_service";

describe("ensureAlbertProvider", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
    holder.db = db;
  });

  const providers = () =>
    db.select().from(schema.language_model_providers).all();
  const models = () => db.select().from(schema.language_models).all();

  it("creates the provider and model with the right limits", () => {
    ensureAlbertProvider();
    expect(providers()).toHaveLength(1);
    expect(providers()[0]).toMatchObject({
      id: ALBERT_PROVIDER_ID,
      api_base_url: ALBERT_API_BASE_URL,
      env_var_name: "ALBERT_API_KEY",
    });
    expect(models()).toHaveLength(1);
    expect(models()[0]).toMatchObject({
      apiName: ALBERT_MODEL_ID,
      customProviderId: ALBERT_PROVIDER_ID,
      context_window: ALBERT_CONTEXT_WINDOW,
      max_output_tokens: ALBERT_MAX_OUTPUT_TOKENS,
    });
  });

  it("is idempotent", () => {
    ensureAlbertProvider();
    ensureAlbertProvider();
    ensureAlbertProvider();
    expect(providers()).toHaveLength(1);
    expect(models()).toHaveLength(1);
  });

  it("repairs a hand-made model with a 131072 output limit and removes duplicates", () => {
    db.insert(schema.language_model_providers)
      .values({
        id: ALBERT_PROVIDER_ID,
        name: "Albert (old)",
        api_base_url: "https://old.example/v1",
      })
      .run();
    for (let i = 0; i < 2; i++) {
      db.insert(schema.language_models)
        .values({
          displayName: "DeepSeek",
          apiName: ALBERT_MODEL_ID,
          customProviderId: ALBERT_PROVIDER_ID,
          context_window: 131072,
          max_output_tokens: 131072,
        })
        .run();
    }
    ensureAlbertProvider();
    expect(providers()).toHaveLength(1);
    expect(providers()[0].api_base_url).toBe(ALBERT_API_BASE_URL);
    expect(models()).toHaveLength(1);
    expect(models()[0].max_output_tokens).toBe(8192);
  });
});
