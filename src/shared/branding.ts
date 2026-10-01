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
