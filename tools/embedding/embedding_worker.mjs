// Local text embeddings (multilingual-e5-small, int8) on CPU with ONNX Runtime
// WebAssembly: no GPU, no server, no network. Runs as an Electron
// utilityProcess (its own memory) or, in tests, a plain Node child process.
// Bundled to resources/embedding/embedding_worker.cjs by scripts/prepare-embedding.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as ort from "onnxruntime-web";
import { Tokenizer } from "@huggingface/tokenizers";

const MAX_TOKENS = 512;
const BATCH = 8;

// Transport: Electron utilityProcess (parentPort) or Node IPC.
const port = process.parentPort ?? {
  on: (_event, callback) => process.on("message", (data) => callback({ data })),
  postMessage: (message) => process.send?.(message),
};

let session = null;
let tokenizer = null;

async function init({ modelDir, wasmDir, threads }) {
  ort.env.wasm.numThreads = Math.max(1, threads ?? 2);
  ort.env.wasm.wasmPaths = pathToFileURL(wasmDir + path.sep).href;
  tokenizer = new Tokenizer(
    JSON.parse(fs.readFileSync(path.join(modelDir, "tokenizer.json"), "utf8")),
    JSON.parse(
      fs.readFileSync(path.join(modelDir, "tokenizer_config.json"), "utf8"),
    ),
  );
  session = await ort.InferenceSession.create(
    path.join(modelDir, "onnx", "model_quantized.onnx"),
    { executionProviders: ["wasm"] },
  );
}

async function embedBatch(texts) {
  const encoded = texts.map((text) => tokenizer.encode(text));
  const length = Math.min(
    MAX_TOKENS,
    Math.max(1, ...encoded.map((item) => item.ids.length)),
  );
  const count = texts.length;
  const ids = new BigInt64Array(count * length);
  const mask = new BigInt64Array(count * length);
  const types = new BigInt64Array(count * length);
  encoded.forEach((item, row) => {
    const usable = Math.min(length, item.ids.length);
    for (let col = 0; col < usable; col++) {
      ids[row * length + col] = BigInt(item.ids[col]);
      mask[row * length + col] = 1n;
    }
    // Keep the closing </s> token when a long text is truncated.
    if (item.ids.length > length)
      ids[row * length + length - 1] = BigInt(item.ids[item.ids.length - 1]);
  });
  const feeds = {
    input_ids: new ort.Tensor("int64", ids, [count, length]),
    attention_mask: new ort.Tensor("int64", mask, [count, length]),
  };
  if (session.inputNames.includes("token_type_ids")) {
    feeds.token_type_ids = new ort.Tensor("int64", types, [count, length]);
  }
  const output = await session.run(feeds);
  const hidden = output[session.outputNames[0]];
  const size = hidden.dims[2];
  const data = hidden.data;
  return encoded.map((_item, row) => {
    // Mean pooling over real tokens, then L2 normalization.
    const vector = new Float32Array(size);
    let tokens = 0;
    for (let col = 0; col < length; col++) {
      if (!mask[row * length + col]) continue;
      tokens += 1;
      for (let k = 0; k < size; k++)
        vector[k] += data[(row * length + col) * size + k];
    }
    let norm = 0;
    for (let k = 0; k < size; k++) {
      vector[k] /= tokens || 1;
      norm += vector[k] * vector[k];
    }
    norm = Math.sqrt(norm) || 1;
    for (let k = 0; k < size; k++) vector[k] /= norm;
    return vector;
  });
}

async function embed(texts) {
  // Sort by length so batches waste little padding, then restore the order.
  const order = texts
    .map((_t, index) => index)
    .sort((a, b) => texts[a].length - texts[b].length);
  const vectors = new Array(texts.length);
  for (let start = 0; start < order.length; start += BATCH) {
    const slice = order.slice(start, start + BATCH);
    const result = await embedBatch(slice.map((index) => texts[index]));
    slice.forEach((index, i) => (vectors[index] = result[i]));
  }
  return vectors;
}

port.on("message", async (event) => {
  const message = event?.data ?? event;
  try {
    if (message.type === "init") {
      await init(message);
      port.postMessage({ type: "ready", id: message.id });
    } else if (message.type === "embed") {
      const vectors = await embed(message.texts);
      port.postMessage({ type: "result", id: message.id, vectors });
    }
  } catch (error) {
    port.postMessage({
      type: "error",
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
