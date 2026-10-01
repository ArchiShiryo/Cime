import { BrowserWindow, app } from "electron";
import fs from "node:fs";
import path from "node:path";
import log from "electron-log";
import { buildSplashHtml } from "./splash_html";

const logger = log.scope("splash");

const SPLASH_WIDTH = 900;
const SPLASH_HEIGHT = 560;
// Keep the splash up long enough to be read instead of flashing.
const MIN_VISIBLE_MS = 2_500;
// If the renderer never says it rendered, reveal this long after its page
// finished loading anyway.
const AFTER_LOAD_FALLBACK_MS = 8_000;
// Never leave the user stuck behind a splash.
const MAX_WAIT_MS = 30_000;

let rendererReadyListener: (() => void) | null = null;
let rendererReadyBeforeListener = false;

/**
 * Called (through IPC) once the renderer has painted the real app, so the
 * main window is never revealed as an empty page.
 */
export function notifyRendererReady(): void {
  if (rendererReadyListener) {
    rendererReadyListener();
  } else {
    rendererReadyBeforeListener = true;
  }
}

export interface Splash {
  /**
   * Shows `target` and closes the splash once the renderer reported it has
   * rendered (and the splash has been visible for a minimum time), with
   * fallbacks so the app always opens.
   */
  revealWhenReady(target: BrowserWindow): void;
}

function writeSplashFile(): string {
  const file = path.join(app.getPath("temp"), "cimes-splash.html");
  fs.writeFileSync(file, buildSplashHtml(), "utf8");
  return file;
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
      // Shown right away (white background) so it is visible even before the
      // images decode.
      show: true,
      skipTaskbar: true,
      backgroundColor: "#ffffff",
      title: "Cimes",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    const shownAt = Date.now();
    void splash
      .loadFile(writeSplashFile())
      .catch((error) => logger.warn("Splash failed to load:", error));

    return {
      revealWhenReady(target) {
        let done = false;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const clearTimers = () => timers.forEach(clearTimeout);
        const finish = (reason: string) => {
          if (done) return;
          done = true;
          rendererReadyListener = null;
          clearTimers();
          logger.info(`revealing main window (${reason})`);
          if (!target.isDestroyed()) {
            target.show();
            target.focus();
          }
          if (!splash.isDestroyed()) splash.close();
        };
        const finishAfterMinimum = (reason: string) => {
          const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
          timers.push(setTimeout(() => finish(reason), wait));
        };

        timers.push(setTimeout(() => finish("timeout"), MAX_WAIT_MS));
        rendererReadyListener = () => finishAfterMinimum("renderer ready");
        if (rendererReadyBeforeListener) {
          rendererReadyBeforeListener = false;
          finishAfterMinimum("renderer ready");
        }
        target.webContents.once("did-finish-load", () => {
          timers.push(
            setTimeout(() => finish("load fallback"), AFTER_LOAD_FALLBACK_MS),
          );
        });
        target.once("closed", () => {
          done = true;
          rendererReadyListener = null;
          clearTimers();
          if (!splash.isDestroyed()) splash.close();
        });
      },
    };
  } catch (error) {
    logger.warn("Could not create the splash window:", error);
    return null;
  }
}
