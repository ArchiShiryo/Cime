// Prepares the offline OCR runtime shipped with Cimes (run before packaging):
//   resources/ocr/node_modules/   tesseract.js and the WASM cores it needs (no downloads at runtime)
//   resources/ocr/lang/           French and English trained data (verified with SHA-256)
// Usage: node scripts/prepare-ocr.mjs [--check]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "resources", "ocr");
const LANG_DIR = path.join(OUT, "lang");
const CHECK = process.argv.includes("--check");

const TESSERACT_VERSION = "7.0.0";
// [file in the npm data package, published name, sha256]
const LANGS = [
  [
    "@tesseract.js-data/fra",
    "4.0.0_best_int/fra.traineddata.gz",
    "fra.traineddata.gz",
    "d611139672b3752c7097e671e4a1d9209dfd37f2aeb081ef6487fba3351e9255",
  ],
  [
    "@tesseract.js-data/eng",
    "4.0.0/eng.traineddata.gz",
    "eng.traineddata.gz",
    "ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468",
  ],
];

// tesseract.js (Node) loads the plain cores (.js loader + .wasm), one per CPU feature level.
const CORE_KEEP = /^tesseract-core(-simd|-relaxedsimd)?\.(wasm|js)$/;

const sha256 = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function langOk() {
  return LANGS.every(([, , name, hash]) => {
    const file = path.join(LANG_DIR, name);
    return fs.existsSync(file) && sha256(file) === hash;
  });
}
const toolOk = () =>
  fs.existsSync(
    path.join(OUT, "node_modules", "tesseract.js", "package.json"),
  ) &&
  fs.existsSync(
    path.join(
      OUT,
      "node_modules",
      "tesseract.js-core",
      "tesseract-core-lstm.wasm",
    ),
  );

if (toolOk() && langOk()) {
  console.log("OCR runtime already prepared.");
  process.exit(0);
}
if (CHECK)
  throw new Error(
    "OCR runtime is missing or corrupt (run npm run prepare:ocr)",
  );

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(LANG_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUT, "package.json"),
  JSON.stringify({ name: "cimes-ocr", private: true, version: "1.0.0" }),
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args, cwd) =>
  execFileSync(npm, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

console.log("Installing tesseract.js…");
run(
  [
    "install",
    `tesseract.js@${TESSERACT_VERSION}`,
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--engine-strict=false",
  ],
  OUT,
);
const core = path.join(OUT, "node_modules", "tesseract.js-core");
for (const entry of fs.readdirSync(core)) {
  if (/^tesseract-core/.test(entry) && !CORE_KEEP.test(entry)) {
    fs.rmSync(path.join(core, entry), { force: true });
  }
}

console.log("Fetching trained data…");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-ocr-"));
fs.writeFileSync(path.join(tmp, "package.json"), '{"name":"t","private":true}');
run(
  [
    "install",
    ...LANGS.map(([pkg]) => pkg),
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--engine-strict=false",
  ],
  tmp,
);
for (const [pkg, from, name, hash] of LANGS) {
  const source = path.join(
    tmp,
    "node_modules",
    ...pkg.split("/"),
    ...from.split("/"),
  );
  const target = path.join(LANG_DIR, name);
  fs.copyFileSync(source, target);
  if (sha256(target) !== hash) throw new Error(`Checksum mismatch for ${name}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log("OCR runtime ready:", OUT);
