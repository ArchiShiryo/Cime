// Bundles src/office.mjs (library + CLI) into one dependency-free ESM file that
// the Cimes office skills ship and the agent runs with a plain `node`.
import { build } from "esbuild";
import { mkdirSync, statSync } from "node:fs";

const out = new URL(
  "../../src/skills/builtin-assets/office.mjs",
  import.meta.url,
);
mkdirSync(new URL("./", out), { recursive: true });
await build({
  entryPoints: [new URL("./src/office.mjs", import.meta.url).pathname],
  outfile: out.pathname,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  minify: true,
  legalComments: "none",
  // Some CommonJS dependencies call require() on Node built-ins.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  logLevel: "info",
});
console.log(`${out.pathname}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
