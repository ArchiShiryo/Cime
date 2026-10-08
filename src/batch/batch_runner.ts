import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export type BatchStatus = "done" | "error";

export interface BatchItem {
  status: BatchStatus;
  /** Output file name inside the output folder (done items). */
  output?: string;
  error?: string;
  note?: string;
}

interface Manifest {
  version: 1;
  instructionHash: string;
  instruction: string;
  createdAt: string;
  items: Record<string, BatchItem>;
}

export interface BatchResult {
  done: number;
  failed: number;
  skipped: number;
  remaining: number;
  cancelled: boolean;
  outputDir: string;
}

export const MANIFEST_NAME = "batch.json";
export const SUMMARY_NAME = "summary.csv";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

/** "sub/dir/report.pdf" -> "sub__dir__report.pdf.md": unique, flat and safe on every OS. */
export function outputNameFor(relative: string): string {
  return (
    relative
      .split(/[\\/]+/)
      .join("__")
      .replace(/[<>:"|?*\x00-\x1f]/g, "_") + ".md"
  );
}

function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

function readManifest(file: string): Manifest | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
    return parsed?.version === 1 && parsed.items ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Runs `processFile` over files, one output Markdown file each, in `outputDir`.
 * Never touches the inputs and never overwrites anything outside its own
 * manifest. Calling it again with the same instruction resumes: files already
 * done are skipped. A different instruction in the same folder is refused.
 */
export async function runBatch(options: {
  files: { relative: string; absolute: string }[];
  outputDir: string;
  instruction: string;
  processFile: (
    file: { relative: string; absolute: string },
    signal: AbortSignal | undefined,
  ) => Promise<{ markdown: string; note?: string }>;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (state: {
    finished: number;
    total: number;
    file: string;
  }) => void;
}): Promise<BatchResult> {
  const { files, outputDir, instruction, processFile, signal } = options;
  fs.mkdirSync(outputDir, { recursive: true });
  const manifestPath = path.join(outputDir, MANIFEST_NAME);
  const existing = readManifest(manifestPath);
  const instructionHash = hash(instruction.trim());
  if (existing && existing.instructionHash !== instructionHash) {
    throw new Error(
      "This output folder already holds results for another instruction. Choose a new folder.",
    );
  }
  if (!existing && fs.readdirSync(outputDir).length > 0) {
    throw new Error(
      "The output folder is not empty and was not created by a previous batch. Choose a new folder.",
    );
  }
  const manifest: Manifest = existing ?? {
    version: 1,
    instructionHash,
    instruction: instruction.trim(),
    createdAt: new Date().toISOString(),
    items: {},
  };
  const save = () =>
    writeAtomic(manifestPath, JSON.stringify(manifest, null, 2));
  save();

  const todo = files.filter(
    (f) => manifest.items[f.relative]?.status !== "done",
  );
  const skipped = files.length - todo.length;
  let cursor = 0;
  let finished = 0;
  let cancelled = false;
  const worker = async () => {
    while (cursor < todo.length) {
      if (signal?.aborted) {
        cancelled = true;
        return;
      }
      const file = todo[cursor++];
      try {
        const { markdown, note } = await processFile(file, signal);
        const name = outputNameFor(file.relative);
        writeAtomic(path.join(outputDir, name), markdown);
        manifest.items[file.relative] = { status: "done", output: name, note };
      } catch (error) {
        if (signal?.aborted) {
          cancelled = true;
          return;
        }
        manifest.items[file.relative] = {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
      save();
      finished += 1;
      options.onProgress?.({
        finished,
        total: todo.length,
        file: file.relative,
      });
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.max(1, Math.min(options.concurrency ?? 2, 4)) },
      worker,
    ),
  );

  const rows = files.map((f) => {
    const item = manifest.items[f.relative];
    return [
      f.relative,
      item?.status ?? "not processed",
      item?.output ?? "",
      item?.error ?? item?.note ?? "",
    ]
      .map(csvCell)
      .join(";");
  });
  writeAtomic(
    path.join(outputDir, SUMMARY_NAME),
    ["file;status;result;note", ...rows].join("\n") + "\n",
  );

  const statuses = files.map((f) => manifest.items[f.relative]?.status);
  return {
    done: statuses.filter((s) => s === "done").length - skipped,
    failed: statuses.filter((s) => s === "error").length,
    skipped,
    remaining: statuses.filter((s) => s === undefined).length,
    cancelled,
    outputDir,
  };
}
