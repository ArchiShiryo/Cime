// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/paths/paths", () => ({ getUserDataPath: () => holder.dir }));

import {
  clearActivity,
  logActivity,
  readActivity,
  redact,
  summarizeArgs,
} from "./activity_log";

describe("activity log", () => {
  beforeEach(() => {
    holder.dir = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-activity-"));
  });

  it("writes JSON lines and reads them back newest first", () => {
    logActivity({ kind: "tool", name: "read_file", status: "ok", ms: 12 });
    logActivity({
      kind: "tool",
      name: "run_shell",
      status: "error",
      detail: "boom",
    });
    const events = readActivity();
    expect(events.map((e) => e.name)).toEqual(["run_shell", "read_file"]);
    expect(readActivity(10, { errorsOnly: true })).toHaveLength(1);
  });

  it("redacts credentials and bounds long text", () => {
    expect(redact("key sk-abcdef123456 and Bearer abcdefghijkl")).not.toMatch(
      /abcdef123456|abcdefghijkl/,
    );
    expect(redact("apiKey: hunter2xyz")).toContain("***");
    expect(redact("x".repeat(1000)).length).toBeLessThan(310);
    expect(summarizeArgs({ path: "a.md", content: "z".repeat(500) })).toContain(
      "500 chars",
    );
  });

  it("skips a corrupted line and can be cleared", () => {
    logActivity({ kind: "turn", status: "start" });
    const file = path.join(holder.dir, "logs", "activity.jsonl");
    fs.appendFileSync(file, '{"ts": broken\n');
    logActivity({ kind: "turn", status: "ok" });
    expect(readActivity()).toHaveLength(2);
    clearActivity();
    expect(readActivity()).toEqual([]);
  });
});
