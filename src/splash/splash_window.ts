import { BrowserWindow } from "electron";
import log from "electron-log";
import { buildSplashHtml } from "./splash_html";

const logger = log.scope("splash");

const SPLASH_WIDTH = 900;
const SPLASH_HEIGHT = 560;
// Keep the splash up long enough to be read instead of flashing.
const MIN_VISIBLE_MS = 2_000;
// Never leave the user stuck behind a splash if the renderer never signals.
const MAX_WAIT_MS = 20_000;

export interface Splash {
  /**
   * Shows `target` and closes the splash once `target` is ready (and the
   * splash has been visible for a minimum time), or after a safety timeout.
   */
  revealWhenReady(target: BrowserWindow): void;
}

export function showSplash(): Splash | null {
  try {
    const splash = new BrowserWindow({
      width: SPLASH_WIDTH,
      height: SPLASH_HEIGHT,
      frame: false,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      center: true,
      show: false,
      skipTaskbar: true,
      backgroundColor: "#ffffff",
      title: "Cimes",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    const shownAt = { value: 0 };
    splash.once("ready-to-show", () => {
      shownAt.value = Date.now();
      splash.show();
    });
    void splash
      .loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(buildSplashHtml())}`,
      )
      .catch((error) => logger.warn("Splash failed to load:", error));

    return {
      revealWhenReady(target) {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(safetyTimer);
          if (!target.isDestroyed()) {
            target.show();
            target.focus();
          }
          if (!splash.isDestroyed()) splash.close();
        };
        const safetyTimer = setTimeout(finish, MAX_WAIT_MS);
        const onReady = () => {
          const elapsed = shownAt.value ? Date.now() - shownAt.value : 0;
          setTimeout(finish, Math.max(0, MIN_VISIBLE_MS - elapsed));
        };
        if (target.isDestroyed()) return finish();
        target.once("ready-to-show", onReady);
        target.once("closed", () => {
          done = true;
          clearTimeout(safetyTimer);
          if (!splash.isDestroyed()) splash.close();
        });
      },
    };
  } catch (error) {
    logger.warn("Could not create the splash window:", error);
    return null;
  }
}
