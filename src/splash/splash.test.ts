import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { windows, FakeWindow } = vi.hoisted(() => {
  const windows: InstanceType<typeof FakeWindow>[] = [];
  class FakeWindow {
    destroyed = false;
    handlers = new Map<string, () => void>();
    contentsHandlers = new Map<string, () => void>();
    webContents = {
      once: (event: string, handler: () => void) => {
        this.contentsHandlers.set(event, handler);
      },
    };
    show = vi.fn();
    focus = vi.fn();
    close = vi.fn(() => {
      this.destroyed = true;
    });
    loadFile = vi.fn().mockResolvedValue(undefined);
    isDestroyed() {
      return this.destroyed;
    }
    once(event: string, handler: () => void) {
      this.handlers.set(event, handler);
    }
    emit(event: string) {
      this.handlers.get(event)?.();
    }
    emitContents(event: string) {
      this.contentsHandlers.get(event)?.();
    }
    constructor() {
      windows.push(this);
    }
  }
  return { windows, FakeWindow };
});

vi.mock("electron", () => ({
  BrowserWindow: FakeWindow,
  app: { getPath: () => "/tmp" },
}));
vi.mock("node:fs", () => ({ default: { writeFileSync: vi.fn() } }));
vi.mock("electron-log", () => ({
  default: { scope: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) },
}));

import { buildSplashHtml } from "./splash_html";
import { notifyRendererReady, showSplash } from "./splash_window";

describe("buildSplashHtml", () => {
  it("is self-contained and shows the Cimes branding", () => {
    const html = buildSplashHtml();
    expect(html).toContain("Cimes");
    expect(html).toContain("Réseau Canopé");
    expect(html).toContain(
      "L’assistant IA pour les équipes éducatives en Guyane",
    );
    // Vite turns these into data URIs in the real build; Vitest keeps file
    // paths, so only check that every image has a non-empty source.
    const sources = [...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(sources).toHaveLength(3);
    expect(sources.every((src) => src && src !== "undefined")).toBe(true);
    // No network or file dependency, and no script.
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain("<script");
    expect(html).toContain("default-src 'none'");
  });
});

describe("showSplash", () => {
  beforeEach(() => {
    windows.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function setup() {
    const splash = showSplash()!;
    const splashWindow = windows[0];
    const main = new FakeWindow();
    splash.revealWhenReady(main as never);
    return { splashWindow, main };
  }

  it("loads the splash from a file instead of a long data URL", () => {
    const { splashWindow } = setup();
    expect(splashWindow.loadFile).toHaveBeenCalledWith(
      expect.stringContaining("cimes-splash.html"),
    );
  });

  it("reveals the app once the renderer is ready, after a minimum time", () => {
    const { splashWindow, main } = setup();
    notifyRendererReady();
    vi.advanceTimersByTime(1_000);
    expect(main.show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_600);
    expect(main.show).toHaveBeenCalledTimes(1);
    expect(splashWindow.close).toHaveBeenCalledTimes(1);
  });

  it("does not reveal a blank window just because the page loaded", () => {
    const { main } = setup();
    main.emitContents("did-finish-load");
    vi.advanceTimersByTime(5_000);
    expect(main.show).not.toHaveBeenCalled();
    // ...but still opens if the renderer never reports in.
    vi.advanceTimersByTime(3_100);
    expect(main.show).toHaveBeenCalledTimes(1);
  });

  it("never leaves the user behind the splash", () => {
    const { splashWindow, main } = setup();
    vi.advanceTimersByTime(30_001);
    expect(main.show).toHaveBeenCalledTimes(1);
    expect(splashWindow.close).toHaveBeenCalledTimes(1);
  });

  it("closes the splash without showing a window that was closed meanwhile", () => {
    const { splashWindow, main } = setup();
    main.emit("closed");
    expect(splashWindow.close).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(40_000);
    expect(main.show).not.toHaveBeenCalled();
  });
});
