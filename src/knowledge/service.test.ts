// @vitest-environment node
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { strToU8, zipSync } from "fflate";
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
import { getOcrDir } from "./ocr_paths";
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
    fs.writeFileSync(path.join(docs, "image.gif"), "not supported");
  });

  it("keeps a project's documentation apart from the global base", async () => {
    holder.mode = "keywords";
    const project = path.join(holder.userData, "projet");
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(
      path.join(project, "referentiel.md"),
      "Indicateur 12 : tracer les preuves de formation.",
    );
    await addToKnowledgeBase([docs]);
    await addToKnowledgeBase([project], project);
    await waitForKnowledgeIdle();
    expect(listSources(null, project).map((s) => s.name)).toEqual([
      "referentiel.md",
    ]);
    expect(listSources().some((s) => s.name === "referentiel.md")).toBe(false);
    const scoped = await searchKnowledge(
      "indicateur preuves",
      3,
      undefined,
      project,
    );
    expect(scoped[0]?.source).toBe("referentiel.md");
    const global = await searchKnowledge("indicateur preuves", 3);
    expect(global.some((hit) => hit.source === "referentiel.md")).toBe(false);
    expect(getKnowledgeStats(project).ready).toBe(1);
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
    expect(empty.error).toMatch(/No readable text/);
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
      location: "slide 2",
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

describe("LibreOffice documents", () => {
  beforeEach(async () => {
    await waitForKnowledgeIdle();
    closeKnowledgeDb();
    holder.userData = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-kb-odf-"));
    holder.mode = "keywords";
  });

  it("indexes an .odt and an .ods and answers from them", async () => {
    const ns =
      'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';
    const make = (body: string, mime: string) =>
      Buffer.from(
        zipSync({
          mimetype: [strToU8(mime), { level: 0 }],
          "content.xml": strToU8(
            `<office:document-content ${ns}><office:body>${body}</office:body></office:document-content>`,
          ),
        }),
      );
    const dir = path.join(holder.userData, "odf");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, "reglement.odt"),
      make(
        '<office:text><text:h text:outline-level="1">Règlement</text:h><text:p>Les tablettes sont rangées dans l\'armoire bleue.</text:p></office:text>',
        "application/vnd.oasis.opendocument.text",
      ),
    );
    fs.writeFileSync(
      path.join(dir, "stock.ods"),
      make(
        '<office:spreadsheet><table:table table:name="Stock"><table:table-row><table:table-cell office:value-type="string"><text:p>Chargeurs</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="12"><text:p>12</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>',
        "application/vnd.oasis.opendocument.spreadsheet",
      ),
    );
    await addToKnowledgeBase([dir]);
    await waitForKnowledgeIdle();
    expect(listSources().map((s) => s.status)).toEqual(["ready", "ready"]);
    expect((await searchKnowledge("armoire bleue tablettes"))[0].source).toBe(
      "reglement.odt",
    );
    expect((await searchKnowledge("chargeurs"))[0].source).toBe("stock.ods");
  }, 60_000);
});

describe.skipIf(!getOcrDir())("OCR (offline, shipped with Cimes)", () => {
  beforeEach(async () => {
    await waitForKnowledgeIdle();
    closeKnowledgeDb();
    holder.userData = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-kb-ocr-"));
    holder.mode = "keywords";
  });

  it("finds the text of a scanned PDF and of an image, and answers searches", async () => {
    const fixtures = path.join(__dirname, "fixtures");
    await addToKnowledgeBase([
      path.join(fixtures, "scanned-note.pdf"),
      path.join(fixtures, "scanned-note.png"),
    ]);
    await waitForKnowledgeIdle();
    const sources = listSources();
    expect(sources.map((s) => s.status)).toEqual(["ready", "ready"]);
    const hits = await searchKnowledge("code secret", 4);
    expect(hits.some((hit) => /ZEBRE-4471/.test(hit.text))).toBe(true);
    const pdfHit = hits.find((hit) => hit.source === "scanned-note.pdf");
    expect(pdfHit?.location).toBe("p. 1");
  }, 90_000);
});
