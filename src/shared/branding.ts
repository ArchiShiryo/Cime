// Side-effect-free branding constants for the Cimes fork (a play on "Canopé").
// Safe to import from both the main process and the renderer.

export const APP_DISPLAY_NAME = "Cimes";

// The upstream update feed (api.dyad.sh, repo dyad-sh/dyad) only serves
// official Dyad builds: following it would replace Cimes with Dyad. Cimes
// ships through its own GitHub Actions build instead, so the updater stays off
// until a Cimes feed exists.
export const AUTO_UPDATE_AVAILABLE = false;

// Cimes runs on Albert (free for the public sector): every Dyad Pro / paid
// upsell, subscription banner and the paid "Dyad" auto provider stay hidden.
export const PAID_FEATURES_ENABLED = false;

// No usage data leaves a Cimes install: PostHog is initialized opted-out with
// no network calls, every event is dropped, and the consent prompt and
// telemetry settings are hidden.
export const TELEMETRY_ENABLED = false;

// The agent reads and searches the web locally (no Dyad engine, no API key):
// keyless search plus a readable-page fetcher, with private addresses refused.
export const LOCAL_WEB_TOOLS_ENABLED = true;

// Cimes never contacts Dyad's servers (api.dyad.sh, engine.dyad.sh,
// academy.dyad.sh): the model catalog, templates, desktop config, MCP catalog,
// pnpm build allow-list and billing checks all use local data only. Network
// calls remaining are the ones the user triggers (Albert, web tools, MCP
// servers, GitHub for template downloads, npm).
export const DYAD_SERVICES_ENABLED = false;

/** Interface language used until the user picks another (French and English are offered). */
export const DEFAULT_LANGUAGE = "fr" as const;
