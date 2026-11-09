// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { beforeAll, describe, expect, it } from "vitest";

const BUNDLE = path.join(__dirname, "builtin-assets", "office.mjs");
let dir: string;
const run = (...args: string[]) =>
  execFileSync(process.execPath, [BUNDLE, ...args], {
    encoding: "utf8",
    cwd: dir,
  });

const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"';

async function odf(file: string, mime: string, body: string) {
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:body>${body}</office:body></office:document-content>`;
  fs.writeFileSync(
    path.join(dir, file),
    zipSync({
      mimetype: [strToU8(mime), { level: 0 }],
      "content.xml": strToU8(content),
    }),
  );
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-odf-"));
  await odf(
    "note.odt",
    "application/vnd.oasis.opendocument.text",
    `<office:text><text:h text:outline-level="1">Compte rendu</text:h><text:p>Réunion du <text:span>12 mars</text:span>.<text:s text:c="2"/>Décision&#160;: acheter 12 tablettes &amp; chargeurs.</text:p><text:list><text:list-item><text:p>Point 1</text:p></text:list-item><text:list-item><text:p>Point 2</text:p></text:list-item></text:list><table:table><table:table-row><table:table-cell><text:p>Nom</text:p></table:table-cell><table:table-cell><text:p>Note</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>Léa</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="14.5"><text:p>14,5</text:p></table:table-cell></table:table-row></table:table></office:text>`,
  );
  await odf(
    "notes.ods",
    "application/vnd.oasis.opendocument.spreadsheet",
    `<office:spreadsheet><table:table table:name="Élèves"><table:table-row><table:table-cell office:value-type="string"><text:p>Nom</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>Note</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="string"><text:p>Léa</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="14.5"><text:p>14,5</text:p></table:table-cell></table:table-row><table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="1024"/></table:table-row></table:table></office:spreadsheet>`,
  );
  await odf(
    "expose.odp",
    "application/vnd.oasis.opendocument.presentation",
    `<office:presentation><draw:page draw:name="p1"><draw:frame><draw:text-box><text:p>Les volcans</text:p></draw:text-box></draw:frame><draw:frame><draw:text-box><text:list><text:list-item><text:p>Etna</text:p></text:list-item></text:list></draw:text-box></draw:frame><presentation:notes><draw:frame><draw:text-box><text:p>Dire bonjour</text:p></draw:text-box></draw:frame></presentation:notes></draw:page><draw:page draw:name="p2"><draw:frame><draw:text-box><text:p>Conclusion</text:p></draw:text-box></draw:frame></draw:page></office:presentation>`,
  );
}, 30_000);

describe("OpenDocument reading", () => {
  it("reads an .odt as Markdown with headings, spaces, entities, lists and tables", () => {
    const out = run("read", "note.odt");
    expect(out).toContain("# Compte rendu");
    expect(out).toContain(
      "Réunion du 12 mars.  Décision : acheter 12 tablettes & chargeurs.",
    );
    expect(out).toContain("- Point 1");
    expect(out).toContain("| Nom | Note |");
    expect(out).toContain("| Léa | 14,5 |");
  });

  it("reads an .ods with real numbers and ignores the empty repeated rows", () => {
    const sheets = JSON.parse(run("read", "notes.ods"));
    expect(sheets[0].name).toBe("Élèves");
    expect(sheets[0].rows).toEqual([
      { row: 1, cells: ["Nom", "Note"] },
      { row: 2, cells: ["Léa", 14.5] },
    ]);
  });

  it("reads an .odp slide by slide with the speaker notes apart", () => {
    const slides = JSON.parse(run("read", "expose.odp"));
    expect(slides).toEqual([
      { slide: 1, text: ["Les volcans", "Etna"], notes: "Dire bonjour" },
      { slide: 2, text: ["Conclusion"], notes: "" },
    ]);
  });
});

describe("PDF export", () => {
  it("writes a readable multi-page PDF from Markdown, with accents, lists and a table", () => {
    const body = [
      "# Note de service",
      "",
      "Réunion **importante** du 12 mars : décisions prises, œuvres à « valider » et coût de 1 200 € (« très élevé »).",
      "",
      "- Premier point",
      "- Deuxième point",
      "",
      "| Nom | Note |",
      "| --- | --- |",
      "| Léa | 14,5 |",
      "",
      ...Array.from(
        { length: 60 },
        (_, i) =>
          `Paragraphe ${i + 1} : ${"texte administratif ".repeat(12)}\n`,
      ),
    ].join("\n");
    fs.writeFileSync(path.join(dir, "note.md"), body);
    const created = run("md2pdf", "note.md", "note.pdf", "Titre du document");
    expect(created).toMatch(/Created: note\.pdf \(\d+ page/);
    const pages = JSON.parse(run("read", "note.pdf")) as {
      page: number;
      text: string;
    }[];
    expect(pages.length).toBeGreaterThan(1);
    const all = pages.map((p) => p.text).join("\n");
    expect(all).toContain("Titre du document");
    expect(all).toContain("Réunion importante du 12 mars");
    expect(all).toContain("œuvres");
    expect(all).toContain("1 200 €");
    expect(all).toContain("Léa");
    expect(all).toContain("Paragraphe 60");
    expect(all).toContain(`1 / ${pages.length}`);
  }, 60_000);

  it("converts a Word file to PDF with its text and headings", async () => {
    run("md2docx", "note.md", "note.docx", "Titre");
    const created = run("docx2pdf", "note.docx", "from-docx.pdf");
    expect(created).toContain("Created: from-docx.pdf");
    const text = (
      JSON.parse(run("read", "from-docx.pdf")) as { text: string }[]
    )
      .map((p) => p.text)
      .join("\n");
    expect(text).toContain("Note de service");
    expect(text).toContain("Deuxième point");
  }, 60_000);
});
