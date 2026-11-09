// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDyadGitignored } from "./gitignoreUtils";

describe("ensureDyadGitignored", () => {
  it("ignores .dyad and the lock files Office leaves next to open documents, once", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-gitignore-"));
    await ensureDyadGitignored(dir);
    await ensureDyadGitignored(dir);
    const lines = fs
      .readFileSync(path.join(dir, ".gitignore"), "utf8")
      .split("\n");
    expect(lines).toEqual(
      expect.arrayContaining([".dyad/", "~$*", ".~lock.*#"]),
    );
    expect(lines.filter((l) => l === "~$*")).toHaveLength(1);
  });
});
