// @vitest-environment node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const holder = vi.hoisted(() => ({
  userData: "",
  connection: null as null | { baseUrl: string; apiKey: string },
  mode: "albert" as "local" | "albert" | "keywords",
}));

vi.mock("electron-log", () => {
  const scoped = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { default: { scope: () => scoped } };
});
vi.mock("@/paths/paths", () => ({ getUserDataPath: () => holder.userData }));
vi.mock("@/main/settings", () => ({
  readSettings: () => ({ knowledgeEmbeddingMode: holder.mode }),
}));
vi.mock("@/ipc/services/albert_service", () => ({
  getAlbertConnection: () => holder.connection,
}));

import { closeKnowledgeDb, listSources } from "./store";
import {
  addToKnowledgeBase,
  collectFiles,
  deleteSource,
  embedPending,
  getKnowledgeStats,
  searchKnowledge,
  waitForKnowledgeIdle,
} from "./service";
import { pickEmbeddingModel } from "./embeddings";
import {
  isLocalEmbeddingAvailable,
  stopLocalEmbeddingWorker,
} from "./local_embeddings";

// A tiny fake Albert: one embedding model; vectors group "animal" vs "cuisine" words.
let server: http.Server;
let embeddingCalls = 0;
const topicVector = (text: string) =>
  /chat|chien|animal|félin|felin/i.test(text)
    ? [1, 0.1, 0]
    : /recette|cuisine|gâteau|gateau/i.test(text)
      ? [0, 0.1, 1]
      : [0.3, 1, 0.3];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/v1/models") {
        res.end(
          JSON.stringify({
            data: [
              { id: "llm", type: "text-generation" },
              { id: "bge-m3", type: "text-embeddings-inference" },
            ],
          }),
        );
      } else if (req.url === "/v1/embeddings") {
        embeddingCalls += 1;
        const { input } = JSON.parse(body) as { input: string[] };
        res.end(
          JSON.stringify({
            data: input.map((text, index) => ({
              index,
              embedding: topicVector(text),
            })),
          }),
        );
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});
afterAll(() => {
  server.close();
  stopLocalEmbeddingWorker();
});

const OFFICE_PATH = "../skills/builtin-assets/office.mjs";
const waitForIdle = () => waitForKnowledgeIdle();

describe("knowledge base", () => {
  let docs: string;
  beforeEach(async () => {
    await waitForKnowledgeIdle();
    closeKnowledgeDb();
    holder.userData = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-kb-"));
    holder.connection = null;
    holder.mode = "albert";
    embeddingCalls = 0;
    docs = path.join(holder.userData, "docs");
    fs.mkdirSync(path.join(docs, "sous-dossier"), { recursive: true });
    fs.writeFileSync(
      path.join(docs, "animaux.md"),
      "# Animaux\n\nLe chat est un félin domestique. Le chien est un compagnon fidèle.",
    );
    fs.writeFileSync(
      path.join(docs, "sous-dossier", "cuisine.txt"),
      "Recette du gâteau au chocolat : farine, œufs, sucre et cacao.",
    );
    fs.writeFileSync(path.join(docs, "image.png"), "not supported");
  });

  it("collects supported files recursively and skips the rest", async () => {
    const files = await collectFiles([docs]);
    expect(files.map((f) => path.basename(f)).sort()).toEqual([
      "animaux.md",
      "cuisine.txt",
    ]);
  });

  it("indexes documents and answers with keywords only when Albert is not connected", async () => {
    expect(await addToKnowledgeBase([docs])).toBe(2);
    await waitForIdle();
    expect(getKnowledgeStats()).toMatchObject({ sources: 2, ready: 2 });
    expect(listSources().every((s) => s.embeddedCount === 0)).toBe(true);
    const hits = await searchKnowledge("recette gâteau");
    expect(hits[0].source).toBe("cuisine.txt");
    expect(await searchKnowledge("zzzinconnu")).toEqual([]);
  });

  it("embeds passages through Albert and fuses semantic with keyword results", async () => {
    const { port } = server.address() as AddressInfo;
    holder.connection = { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "k" };
    await addToKnowledgeBase([docs]);
    await waitForIdle();
    expect(
      listSources().every(
        (s) => s.embeddedCount === s.chunkCount && s.chunkCount > 0,
      ),
    ).toBe(true);
    // No shared word with the passage, found through the vectors ("animal" vs "félin/chien").
    const hits = await searchKnowledge("quel animal de compagnie");
    expect(hits[0].source).toBe("animaux.md");
    expect(embeddingCalls).toBeGreaterThan(0);
  });

  it("does not send anything to Albert when embeddings are switched off", async () => {
    const { port } = server.address() as AddressInfo;
    holder.connection = { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "k" };
    holder.mode = "keywords";
    await addToKnowledgeBase([docs]);
    await waitForIdle();
    expect(embeddingCalls).toBe(0);
    expect((await searchKnowledge("chat félin"))[0].source).toBe("animaux.md");
  });

  it("reports a clear error for unreadable files and supports removal", async () => {
    fs.writeFileSync(path.join(docs, "vide.txt"), "   ");
    await addToKnowledgeBase([
      path.join(docs, "vide.txt"),
      path.join(docs, "animaux.md"),
    ]);
    await waitForIdle();
    const empty = listSources().find((s) => s.name === "vide.txt")!;
    expect(empty.status).toBe("error");
    expect(empty.error).toMatch(/Aucun texte/);
    deleteSource(empty.id);
    expect(listSources().map((s) => s.name)).toEqual(["animaux.md"]);
  });

  it("reads Word, Excel and PowerPoint through the office toolkit", async () => {
    const { markdownToDocx, csvToXlsx, jsonToPptx } = (await import(
      /* @vite-ignore */ OFFICE_PATH
    )) as {
      markdownToDocx(md: string, out: string): Promise<void>;
      csvToXlsx(csv: string, out: string): Promise<void>;
      jsonToPptx(slides: unknown[], out: string): Promise<void>;
    };
    await markdownToDocx(
      "# Photosynthèse\n\nLes plantes transforment la lumière en énergie.",
      path.join(docs, "cours.docx"),
    );
    fs.writeFileSync(path.join(docs, "n.csv"), "Nom;Note\nAwa;12");
    await csvToXlsx(path.join(docs, "n.csv"), path.join(docs, "notes.xlsx"));
    await jsonToPptx(
      [{ title: "Volcans" }, { title: "Magma", bullets: ["lave", "cratère"] }],
      path.join(docs, "expose.pptx"),
    );
    await addToKnowledgeBase([
      path.join(docs, "cours.docx"),
      path.join(docs, "notes.xlsx"),
      path.join(docs, "expose.pptx"),
    ]);
    await waitForIdle();
    expect(listSources().map((s) => s.status)).toEqual([
      "ready",
      "ready",
      "ready",
    ]);
    expect((await searchKnowledge("photosynthèse lumière"))[0].source).toBe(
      "cours.docx",
    );
    expect((await searchKnowledge("lave cratère"))[0]).toMatchObject({
      source: "expose.pptx",
      location: "diapo 2",
    });
  }, 60_000);
});

describe.skipIf(!isLocalEmbeddingAvailable())(
  "local embeddings (model shipped with Cimes)",
  () => {
    let docs: string;
    beforeEach(async () => {
      await waitForKnowledgeIdle();
      closeKnowledgeDb();
      holder.userData = fs.mkdtempSync(
        path.join(os.tmpdir(), "cimes-kb-local-"),
      );
      holder.connection = null;
      holder.mode = "local";
      docs = path.join(holder.userData, "docs");
      fs.mkdirSync(docs, { recursive: true });
      fs.writeFileSync(
        path.join(docs, "animaux.md"),
        "Le chat est un félin domestique. Le chien est un compagnon fidèle pour la famille.",
      );
      fs.writeFileSync(
        path.join(docs, "cuisine.txt"),
        "Recette du gâteau au chocolat : mélanger la farine, les œufs, le sucre et le cacao, puis cuire au four.",
      );
      fs.writeFileSync(
        path.join(docs, "tablettes.txt"),
        "Les tablettes numériques doivent être rendues avant seize heures trente dans le casier.",
      );
    });

    it("finds passages by meaning with no word in common, with nothing sent to Albert", async () => {
      await addToKnowledgeBase([docs]);
      await waitForIdle();
      const sources = listSources();
      expect(
        sources.every(
          (s) => s.chunkCount > 0 && s.embeddedCount === s.chunkCount,
        ),
      ).toBe(true);
      const hits = await searchKnowledge("quel animal de compagnie adopter ?");
      expect(hits[0].source).toBe("animaux.md");
      const cooking = await searchKnowledge(
        "comment préparer un dessert sucré",
      );
      expect(cooking[0].source).toBe("cuisine.txt");
    }, 180_000);

    it("re-embeds with the new engine when the mode changes", async () => {
      holder.mode = "keywords";
      await addToKnowledgeBase([docs]);
      await waitForIdle();
      expect(listSources().every((s) => s.embeddedCount === 0)).toBe(true);
      holder.mode = "local";
      await embedPending();
      expect(listSources().every((s) => s.embeddedCount === s.chunkCount)).toBe(
        true,
      );
    }, 180_000);
  },
);

describe("pickEmbeddingModel", () => {
  it("prefers typed embedding models and ignores vision-language ones when others exist", () => {
    expect(
      pickEmbeddingModel([
        { id: "llm", type: "text-generation" },
        { id: "qwen3-vl-embedding-8b", type: "text-embeddings-inference" },
        { id: "bge-m3", type: "text-embeddings-inference" },
      ]),
    ).toBe("bge-m3");
    expect(pickEmbeddingModel([{ id: "multilingual-e5-large" }])).toBe(
      "multilingual-e5-large",
    );
    expect(
      pickEmbeddingModel([{ id: "llm", type: "text-generation" }]),
    ).toBeNull();
  });
});
