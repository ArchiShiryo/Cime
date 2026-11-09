/**
 * Local embeddings: multilingual-e5-small (int8) shipped with Cimes and run on
 * the CPU in a separate process (ONNX Runtime WebAssembly). No network, no GPU.
 * See tools/embedding/embedding_worker.mjs and scripts/prepare-embedding.mjs.
 */
import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, utilityProcess } from "electron";
import log from "electron-log";
import type { EmbeddingEngine } from "./embeddings";
import { prefixesFor } from "./embeddings";

const logger = log.scope("local_embeddings");

export const LOCAL_EMBEDDING_MODEL = "local:multilingual-e5-small";
const IDLE_SHUTDOWN_MS = 60_000;
const INIT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 10 * 60_000;
const MAX_TEXTS_PER_REQUEST = 32;

export interface LocalEmbeddingPaths {
  modelDir: string;
  runtimeDir: string;
}

/** Packaged: <resources>/models and <resources>/embedding; dev/tests: ./resources. */
export function getLocalEmbeddingPaths(): LocalEmbeddingPaths | null {
  const bases: string[] = [];
  if (process.env.CIMES_RESOURCES_DIR)
    bases.push(process.env.CIMES_RESOURCES_DIR);
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  if (app?.isPackaged && resourcesPath) bases.push(resourcesPath);
  if (typeof app?.getAppPath === "function")
    bases.push(path.join(app.getAppPath(), "resources"));
  bases.push(path.join(process.cwd(), "resources"));
  for (const base of bases) {
    // Packaged resources are flat (models/, embedding/); the repo nests them in resources/.
    const candidates = [base, path.join(base, "resources")];
    for (const root of candidates) {
      const modelDir = path.join(root, "models", "multilingual-e5-small");
      const runtimeDir = path.join(root, "embedding");
      if (
        fs.existsSync(path.join(modelDir, "onnx", "model_quantized.onnx")) &&
        fs.existsSync(path.join(runtimeDir, "embedding_worker.cjs"))
      ) {
        return { modelDir, runtimeDir };
      }
    }
  }
  return null;
}

export function isLocalEmbeddingAvailable(): boolean {
  return getLocalEmbeddingPaths() !== null;
}

type Pending = {
  resolve: (value: Float32Array[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

interface Transport {
  post(message: unknown): void;
  kill(): void;
}

class LocalEmbeddingHost {
  private transport: Transport | null = null;
  private ready: Promise<void> | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  private start(paths: LocalEmbeddingPaths): Promise<void> {
    const script = path.join(paths.runtimeDir, "embedding_worker.cjs");
    let transport: Transport;
    const onMessage = (message: {
      type: string;
      id?: number;
      vectors?: ArrayLike<number>[];
      message?: string;
    }) => {
      if (
        message.type === "ready" ||
        message.type === "result" ||
        message.type === "error"
      ) {
        const entry =
          message.id === undefined ? undefined : this.pending.get(message.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        this.pending.delete(message.id!);
        if (message.type === "error")
          entry.reject(new Error(message.message ?? "Embedding worker error"));
        else
          entry.resolve(
            (message.vectors ?? []).map((v) =>
              Float32Array.from(v as ArrayLike<number>),
            ),
          );
      }
    };
    const onExit = () => {
      if (this.transport === transport) {
        this.transport = null;
        this.ready = null;
      }
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("The local embedding process stopped"));
        this.pending.delete(id);
      }
    };
    if (
      process.versions.electron &&
      typeof utilityProcess?.fork === "function"
    ) {
      const child = utilityProcess.fork(script, [], {
        serviceName: "cimes-embeddings",
      });
      child.on("message", onMessage);
      child.on("exit", onExit);
      transport = {
        post: (m) => child.postMessage(m),
        kill: () => child.kill(),
      };
    } else {
      // Tests and scripts: the same worker as a plain Node child process.
      const child: ChildProcess = fork(script, [], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      child.on("message", onMessage);
      child.on("exit", onExit);
      transport = {
        post: (m) => child.send(m as never),
        kill: () => void child.kill(),
      };
    }
    this.transport = transport;
    const threads = Math.max(1, Math.min(4, os.cpus().length - 1));
    logger.info(`Starting local embedding worker (${threads} thread(s))`);
    return this.request(
      {
        type: "init",
        modelDir: paths.modelDir,
        wasmDir: paths.runtimeDir,
        threads,
      },
      INIT_TIMEOUT_MS,
    ).then(() => undefined);
  }

  private request(
    message: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Float32Array[]> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("The local embedding process did not answer in time"));
        this.stop();
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.transport?.post({ ...message, id });
    });
  }

  private armIdleShutdown() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stop(), IDLE_SHUTDOWN_MS);
    // Never keep the app alive just for this timer.
    (this.idleTimer as { unref?: () => void }).unref?.();
  }

  stop() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const transport = this.transport;
    this.transport = null;
    this.ready = null;
    transport?.kill();
  }

  /** Requests run one at a time; the process starts on demand and sleeps when idle. */
  embed(texts: string[]): Promise<Float32Array[]> {
    const run = async (): Promise<Float32Array[]> => {
      const paths = getLocalEmbeddingPaths();
      if (!paths) throw new Error("The local embedding model is not installed");
      if (this.idleTimer) clearTimeout(this.idleTimer);
      try {
        if (!this.transport || !this.ready) {
          this.ready = this.start(paths);
        }
        await this.ready;
        const out: Float32Array[] = [];
        for (let i = 0; i < texts.length; i += MAX_TEXTS_PER_REQUEST) {
          out.push(
            ...(await this.request(
              {
                type: "embed",
                texts: texts.slice(i, i + MAX_TEXTS_PER_REQUEST),
              },
              REQUEST_TIMEOUT_MS,
            )),
          );
        }
        return out;
      } catch (error) {
        this.stop();
        throw error;
      } finally {
        this.armIdleShutdown();
      }
    };
    const result = this.chain.then(run, run);
    this.chain = result.catch(() => undefined);
    return result;
  }
}

const host = new LocalEmbeddingHost();

export function stopLocalEmbeddingWorker(): void {
  host.stop();
}

export function getLocalEmbeddingEngine(): EmbeddingEngine | null {
  if (!isLocalEmbeddingAvailable()) return null;
  const prefixes = prefixesFor("e5");
  return {
    model: LOCAL_EMBEDDING_MODEL,
    embedPassages: (texts) =>
      host.embed(
        texts.map((text) => `${prefixes.passage}${text.slice(0, 2000)}`),
      ),
    embedQuery: async (text) =>
      (await host.embed([`${prefixes.query}${text.slice(0, 2000)}`]))[0],
  };
}
