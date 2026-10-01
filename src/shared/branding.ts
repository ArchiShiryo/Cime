// Side-effect-free branding constants for the Cimes fork (a play on "Canopé").
// Safe to import from both the main process and the renderer.

export const APP_DISPLAY_NAME = "Cimes";

// The upstream update feed (api.dyad.sh, repo dyad-sh/dyad) only serves
// official Dyad builds: following it would replace Cimes with Dyad. Cimes
// ships through its own GitHub Actions build instead, so the updater stays off
// until a Cimes feed exists.
export const AUTO_UPDATE_AVAILABLE = false;
