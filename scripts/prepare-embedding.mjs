// Prepares the embedded local-embedding runtime (run before packaging):
//   resources/models/multilingual-e5-small/  model + tokenizer, downloaded from
//     Hugging Face at a pinned commit and verified with SHA-256 (not stored in git)
//   resources/embedding/                     bundled worker + ONNX Runtime WASM files
// Usage: node scripts/prepare-embedding.mjs [--check]
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMIT = "761b726dd34fb83930e26aab4e9ac3899aa1fa78";
const MODEL_DIR = path.join(
  root,
  "resources",
  "models",
  "multilingual-e5-small",
);
const RUNTIME_DIR = path.join(root, "resources", "embedding");
const FILES = [
  [
    "config.json",
    "cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1",
  ],
  [
    "tokenizer_config.json",
    "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b",
  ],
  [
    "tokenizer.json",
    "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
  ],
  [
    "onnx/model_quantized.onnx",
    "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193",
  ],
];

const sha256 = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

async function ensureModel() {
  for (const [name, hash] of FILES) {
    const target = path.join(MODEL_DIR, ...name.split("/"));
    if (fs.existsSync(target) && sha256(target) === hash) continue;
    if (process.argv.includes("--check"))
      throw new Error(`Missing or corrupt: ${name}`);
    console.log(`Downloading ${name}…`);
    const url = `https://huggingface.co/Xenova/multilingual-e5-small/resolve/${COMMIT}/${name}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    if (sha256(target) !== hash)
      throw new Error(`Checksum mismatch for ${name}`);
  }
}

async function buildRuntime() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  await build({
    entryPoints: [
      path.join(root, "tools", "embedding", "embedding_worker.mjs"),
    ],
    outfile: path.join(RUNTIME_DIR, "embedding_worker.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node20",
    minify: true,
    legalComments: "none",
    // Resolve the Node build of ONNX Runtime Web (WASM, no native binary).
    conditions: ["node"],
    // ONNX Runtime Web reads import.meta.url; provide it in the CommonJS bundle.
    define: { "import.meta.url": "__importMetaUrl" },
    banner: {
      js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
    },
    logLevel: "warning",
  });
  const dist = path.join(root, "node_modules", "onnxruntime-web", "dist");
  for (const name of [
    "ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.wasm",
  ]) {
    fs.copyFileSync(path.join(dist, name), path.join(RUNTIME_DIR, name));
  }
}

await ensureModel();
if (!process.argv.includes("--check")) await buildRuntime();
console.log("Embedding runtime ready:", RUNTIME_DIR);
