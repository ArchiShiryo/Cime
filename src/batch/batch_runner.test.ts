// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MANIFEST_NAME,
  outputNameFor,
  runBatch,
  SUMMARY_NAME,
} from "./batch_runner";

let dir: string;
const files = (...names: string[]) =>
  names.map((n) => ({ relative: n, absolute: path.join(dir, "in", n) }));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-batch-"));
});

describe("runBatch", () => {
  it("writes one result per file plus a manifest and a summary", async () => {
    const out = path.join(dir, "out");
    const result = await runBatch({
      files: files("a.pdf", "sub/b.docx"),
      outputDir: out,
      instruction: "Summarize",
      processFile: async (f) => ({ markdown: `# ${f.relative}` }),
    });
    expect(result).toMatchObject({
      done: 2,
      failed: 0,
      remaining: 0,
      cancelled: false,
    });
    expect(fs.readFileSync(path.join(out, "sub__b.docx.md"), "utf8")).toBe(
      "# sub/b.docx",
    );
    const summary = fs.readFileSync(path.join(out, SUMMARY_NAME), "utf8");
    expect(summary).toContain('"a.pdf";"done";"a.pdf.md"');
    expect(fs.existsSync(path.join(out, MANIFEST_NAME))).toBe(true);
  });

  it("keeps going after a failure and resumes only what is missing", async () => {
    const out = path.join(dir, "out");
    let fail = true;
    const run = () =>
      runBatch({
        files: files("a.pdf", "b.pdf", "c.pdf"),
        outputDir: out,
        instruction: "Extract the date",
        processFile: async (f) => {
          if (f.relative === "b.pdf" && fail) throw new Error("unreadable");
          return { markdown: f.relative };
        },
      });
    const first = await run();
    expect(first).toMatchObject({ done: 2, failed: 1 });
    fail = false;
    const calls: string[] = [];
    const second = await runBatch({
      files: files("a.pdf", "b.pdf", "c.pdf"),
      outputDir: out,
      instruction: "Extract the date",
      processFile: async (f) => {
        calls.push(f.relative);
        return { markdown: f.relative };
      },
    });
    expect(calls).toEqual(["b.pdf"]);
    expect(second).toMatchObject({ done: 1, failed: 0, skipped: 2 });
  });

  it("refuses another instruction or an unrelated non-empty folder", async () => {
    const out = path.join(dir, "out");
    await runBatch({
      files: files("a.pdf"),
      outputDir: out,
      instruction: "A",
      processFile: async () => ({ markdown: "x" }),
    });
    await expect(
      runBatch({
        files: files("a.pdf"),
        outputDir: out,
        instruction: "B",
        processFile: async () => ({ markdown: "x" }),
      }),
    ).rejects.toThrow(/another instruction/);
    const other = path.join(dir, "docs");
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, "precious.txt"), "keep");
    await expect(
      runBatch({
        files: files("a.pdf"),
        outputDir: other,
        instruction: "A",
        processFile: async () => ({ markdown: "x" }),
      }),
    ).rejects.toThrow(/not empty/);
    expect(fs.readFileSync(path.join(other, "precious.txt"), "utf8")).toBe(
      "keep",
    );
  });

  it("stops launching work when cancelled and reports what remains", async () => {
    const controller = new AbortController();
    const result = await runBatch({
      files: files("a", "b", "c", "d"),
      outputDir: path.join(dir, "out"),
      instruction: "x",
      concurrency: 1,
      signal: controller.signal,
      processFile: async (f) => {
        if (f.relative === "b") controller.abort();
        return { markdown: f.relative };
      },
    });
    expect(result.cancelled).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("builds flat, safe output names", () => {
    expect(outputNameFor("a/b\\c:d.pdf")).toBe("a__b__c_d.pdf.md");
  });
});
