// Cimes Office toolkit: read, create and edit Word, Excel and PowerPoint files
// without Microsoft Office. Usable as a CLI (`node office.mjs help`) or as a
// library (`import { docx, ExcelJS, PptxGenJS, mammoth, JSZip, extractText, getDocumentProxy } from "./office.mjs"`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import zlib from "node:zlib";
import * as docx from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import mammoth from "mammoth";
import JSZip from "jszip";
import { extractImages, extractText, getDocumentProxy } from "unpdf";

export { docx, ExcelJS, PptxGenJS, mammoth, JSZip, extractText, getDocumentProxy };

const decodeXml = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const encodeXml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const extOf = (file) => path.extname(file).toLowerCase();

async function openZip(file) {
  return JSZip.loadAsync(fs.readFileSync(file));
}

// ---------------------------------------------------------------- reading

export async function readDocx(file) {
  const { value } = await mammoth.convertToMarkdown({ path: file });
  return value;
}

export async function readXlsx(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheets = [];
  workbook.eachSheet((sheet) => {
    const rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, number) => {
      const cells = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        let value = cell.value;
        if (value && typeof value === "object") {
          if ("result" in value) value = value.result;
          else if ("richText" in value)
            value = value.richText.map((r) => r.text).join("");
          else if ("text" in value) value = value.text;
          else if (value instanceof Date) value = value.toISOString();
        }
        cells[col - 1] = value ?? "";
      });
      rows.push({ row: number, cells: Array.from(cells, (c) => c ?? "") });
    });
    sheets.push({ name: sheet.name, rows });
  });
  return sheets;
}

const numericKey = (name) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);

export async function readPptx(file) {
  const zip = await openZip(file);
  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => numericKey(a) - numericKey(b));
  const slides = [];
  for (const name of names) {
    const xml = await zip.file(name).async("string");
    const paragraphs = [
      ...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p [^>]*>[\s\S]*?<\/a:p>/g),
    ].map((match) =>
      decodeXml(
        [...match[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
          .map((t) => t[1])
          .join(""),
      ),
    );
    const notesName = name.replace("slides/slide", "notesSlides/notesSlide");
    let notes = "";
    if (zip.file(notesName)) {
      const notesXml = await zip.file(notesName).async("string");
      // Only the notes body placeholder (not the slide number or the slide image).
      const body =
        [...notesXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
          .map((m) => m[0])
          .find((sp) => /type="body"/.test(sp)) ?? "";
      notes = decodeXml(
        [...body.matchAll(/<a:t(?: [^>]*)?>([\s\S]*?)<\/a:t>/g)]
          .map((t) => t[1])
          .join(" "),
      );
    }
    slides.push({
      slide: numericKey(name),
      text: paragraphs.filter(Boolean),
      notes,
    });
  }
  return slides;
}

/** Text of a PDF, page by page (scanned PDFs without a text layer return nothing). */
export async function readPdf(file) {
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.map((pageText, index) => ({ page: index + 1, text: pageText.trim() }));
}

// ---------------------------------------------------------------- OCR

/** Folder holding tesseract.js and the French/English data shipped with Cimes. */
function findOcrDir() {
  const candidates = [process.env.CIMES_OCR_DIR];
  try {
    const hint = path.join(path.dirname(fileURLToPath(import.meta.url)), "ocr-dir.txt");
    candidates.push(fs.readFileSync(hint, "utf8").trim());
  } catch {}
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, "ocr"));
  return candidates.find(
    (dir) => dir && fs.existsSync(path.join(dir, "node_modules", "tesseract.js", "package.json")),
  );
}

export function ocrAvailable() {
  return Boolean(findOcrDir());
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
/** Encodes raw 8-bit pixels (1, 3 or 4 channels) as a PNG, which tesseract.js reads. */
export function encodePng(width, height, channels, data) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = channels === 1 ? 0 : channels === 3 ? 2 : 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

async function withOcrWorker(lang, run) {
  const dir = findOcrDir();
  if (!dir) {
    throw new Error("OCR indisponible : le module de reconnaissance de texte n'est pas installé avec cette version.");
  }
  const req = createRequire(path.join(dir, "package.json"));
  const { createWorker } = req("tesseract.js");
  const worker = await createWorker(lang, 1, {
    langPath: path.join(dir, "lang"),
    corePath: path.join(dir, "node_modules", "tesseract.js-core"),
    workerPath: req.resolve("tesseract.js/src/worker-script/node/index.js"),
    gzip: true,
    cacheMethod: "none",
    logger: () => {},
  });
  try {
    return await run(worker);
  } finally {
    await worker.terminate();
  }
}

/** Text of an image file (png, jpg, bmp). */
export async function ocrImage(file, { lang = "fra+eng" } = {}) {
  return withOcrWorker(lang, async (worker) => {
    const { data } = await worker.recognize(fs.readFileSync(file));
    return data.text.trim();
  });
}

/**
 * Text of scanned PDF pages: the page images are extracted and read.
 * `pages` limits the work (1-based); `maxPages` bounds it when omitted.
 */
export async function ocrPdf(file, { pages, lang = "fra+eng", maxPages = 60, onPage } = {}) {
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
  const wanted = (pages ?? Array.from({ length: pdf.numPages }, (_, i) => i + 1)).slice(0, maxPages);
  return withOcrWorker(lang, async (worker) => {
    const results = [];
    for (const page of wanted) {
      const images = (await extractImages(pdf, page))
        .filter((image) => image.width * image.height >= 90000)
        .sort((a, b) => b.width * b.height - a.width * a.height)
        .slice(0, 3);
      let text = "";
      for (const image of images) {
        const { data } = await worker.recognize(
          encodePng(image.width, image.height, image.channels, image.data),
        );
        text += (text ? "\n" : "") + data.text.trim();
      }
      results.push({ page, text: text.trim() });
      onPage?.(page, wanted.length);
    }
    return results;
  });
}

// ---------------------------------------------------------------- editing

/** Replace text inside w:p / a:p paragraphs, even when split over several runs. */
function replaceInXml(xml, replacements, paragraphTag, runTag, textTag) {
  let count = 0;
  const paragraphRe = new RegExp(
    `<${paragraphTag}[ >][\\s\\S]*?</${paragraphTag}>`,
    "g",
  );
  const textRe = new RegExp(
    `(<${textTag}(?: [^>]*)?>)([\\s\\S]*?)(</${textTag}>)`,
    "g",
  );
  const out = xml.replace(paragraphRe, (paragraph) => {
    const texts = [...paragraph.matchAll(textRe)];
    if (texts.length === 0) return paragraph;
    const full = decodeXml(texts.map((m) => m[2]).join(""));
    let replaced = full;
    for (const [from, to] of Object.entries(replacements)) {
      replaced = replaced.split(from).join(to);
    }
    if (replaced === full) return paragraph;
    count += 1;
    let index = 0;
    // First text node receives everything (keeps its formatting); the rest are emptied.
    return paragraph.replace(textRe, (_all, open, _text, close) => {
      const body = index === 0 ? encodeXml(replaced) : "";
      const opened =
        textTag === "w:t" && index === 0 && !/xml:space/.test(open)
          ? open.replace(/>$/, ' xml:space="preserve">')
          : open;
      index += 1;
      return `${opened}${body}${close}`;
    });
  });
  return { xml: out, count };
}

export async function replaceText(file, replacements, outFile) {
  const ext = extOf(file);
  const zip = await openZip(file);
  let total = 0;
  for (const name of Object.keys(zip.files)) {
    let spec = null;
    if (
      ext === ".docx" &&
      /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(
        name,
      )
    ) {
      spec = ["w:p", "w:r", "w:t"];
    } else if (
      ext === ".pptx" &&
      /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(name)
    ) {
      spec = ["a:p", "a:r", "a:t"];
    } else if (ext === ".xlsx" && name === "xl/sharedStrings.xml") {
      let xml = await zip.file(name).async("string");
      for (const [from, to] of Object.entries(replacements)) {
        const before = xml;
        xml = xml.split(encodeXml(from)).join(encodeXml(to));
        if (xml !== before) total += 1;
      }
      zip.file(name, xml);
      continue;
    }
    if (!spec) continue;
    const { xml, count } = replaceInXml(
      await zip.file(name).async("string"),
      replacements,
      ...spec,
    );
    if (count) zip.file(name, xml);
    total += count;
  }
  fs.writeFileSync(
    outFile,
    await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
  );
  return total;
}

// ---------------------------------------------------------------- creating

function inlineRuns(text, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > last)
      runs.push(
        new docx.TextRun({ text: text.slice(last, match.index), ...base }),
      );
    const token = match[0];
    if (token.startsWith("**"))
      runs.push(
        new docx.TextRun({ text: token.slice(2, -2), bold: true, ...base }),
      );
    else if (token.startsWith("`"))
      runs.push(
        new docx.TextRun({
          text: token.slice(1, -1),
          font: "Consolas",
          ...base,
        }),
      );
    else
      runs.push(
        new docx.TextRun({ text: token.slice(1, -1), italics: true, ...base }),
      );
    last = match.index + token.length;
  }
  if (last < text.length)
    runs.push(new docx.TextRun({ text: text.slice(last), ...base }));
  return runs;
}

/** Markdown (headings, lists, bold/italic, tables, code) to a styled .docx. */
export async function markdownToDocx(markdown, outFile, options = {}) {
  const font = options.font ?? "Calibri";
  const accent = options.accent ?? "005A5B";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const children = [];
  const headingLevels = [
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
    docx.HeadingLevel.HEADING_4,
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      children.push(
        new docx.Paragraph({
          heading: headingLevels[heading[1].length - 1],
          children: inlineRuns(heading[2], { color: accent }),
          spacing: { before: 240, after: 120 },
        }),
      );
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
          rows.push(
            lines[i]
              .trim()
              .replace(/^\||\|$/g, "")
              .split("|")
              .map((c) => c.trim()),
          );
        }
        i++;
      }
      i--;
      children.push(
        new docx.Table({
          width: { size: 100, type: docx.WidthType.PERCENTAGE },
          rows: rows.map(
            (cells, r) =>
              new docx.TableRow({
                tableHeader: r === 0,
                children: cells.map(
                  (cell) =>
                    new docx.TableCell({
                      shading:
                        r === 0
                          ? { type: docx.ShadingType.CLEAR, fill: "F4EFED" }
                          : undefined,
                      children: [
                        new docx.Paragraph({
                          children: inlineRuns(
                            cell,
                            r === 0 ? { bold: true } : {},
                          ),
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
      );
      continue;
    }
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      children.push(
        new docx.Paragraph({
          bullet: { level: Math.min(Math.floor(bullet[1].length / 2), 3) },
          children: inlineRuns(bullet[2]),
        }),
      );
      continue;
    }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      children.push(
        new docx.Paragraph({
          numbering: { reference: "cimes-numbered", level: 0 },
          children: inlineRuns(numbered[2]),
        }),
      );
      continue;
    }
    children.push(
      new docx.Paragraph({
        children: inlineRuns(line),
        spacing: { after: 120 },
      }),
    );
  }
  const doc = new docx.Document({
    creator: options.author ?? "Cimes",
    title: options.title,
    styles: { default: { document: { run: { font, size: 22 } } } },
    numbering: {
      config: [
        {
          reference: "cimes-numbered",
          levels: [
            {
              level: 0,
              format: docx.LevelFormat.DECIMAL,
              text: "%1.",
              alignment: docx.AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  fs.writeFileSync(outFile, await docx.Packer.toBuffer(doc));
}

export function parseCsv(text, delimiter) {
  const sep =
    delimiter ??
    (text.split("\n", 1)[0].split(";").length >
    text.split("\n", 1)[0].split(",").length
      ? ";"
      : ",");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function csvToXlsx(csvFile, outFile, sheetName = "Feuille 1") {
  const rows = parseCsv(fs.readFileSync(csvFile, "utf8"));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of rows) {
    sheet.addRow(
      row.map((value) =>
        value !== "" &&
        !isNaN(Number(value.replace(",", "."))) &&
        /^-?[\d\s]+([.,]\d+)?$/.test(value)
          ? Number(value.replace(/\s/g, "").replace(",", "."))
          : value,
      ),
    );
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4EFED" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns.forEach((column) => {
    let width = 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      width = Math.max(
        width,
        Math.min(60, String(cell.value ?? "").length + 2),
      );
    });
    column.width = width;
  });
  await workbook.xlsx.writeFile(outFile);
}

export async function xlsxToCsv(file, outFile, sheetName) {
  const sheets = await readXlsx(file);
  const sheet = sheetName
    ? sheets.find((s) => s.name === sheetName)
    : sheets[0];
  if (!sheet) throw new Error(`Feuille introuvable : ${sheetName}`);
  const quote = (v) =>
    /[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  fs.writeFileSync(
    outFile,
    "﻿" + sheet.rows.map((r) => r.cells.map(quote).join(";")).join("\n"),
    "utf8",
  );
}

/** Slides from JSON: [{ title, bullets?, text?, notes? }]. */
export async function jsonToPptx(slides, outFile, options = {}) {
  const accent = options.accent ?? "005A5B";
  const background = options.background ?? "F4EFED";
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = options.author ?? "Cimes";
  pptx.title = options.title ?? "";
  slides.forEach((spec, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: background };
    const isCover = index === 0 && !spec.bullets && !spec.text;
    slide.addText(spec.title ?? "", {
      x: 0.6,
      y: isCover ? 2.6 : 0.4,
      w: 12.1,
      h: isCover ? 1.6 : 0.9,
      fontFace: options.font ?? "Calibri",
      fontSize: isCover ? 40 : 30,
      bold: true,
      color: accent,
    });
    if (spec.subtitle) {
      slide.addText(spec.subtitle, {
        x: 0.6,
        y: 4.2,
        w: 12.1,
        h: 0.8,
        fontSize: 20,
        color: "333333",
      });
    }
    if (spec.bullets?.length) {
      slide.addText(
        spec.bullets.map((b) => ({
          text: b,
          options: { bullet: true, breakLine: true },
        })),
        {
          x: 0.8,
          y: 1.5,
          w: 11.7,
          h: 5,
          fontSize: 24,
          color: "222222",
          valign: "top",
          paraSpaceAfter: 10,
        },
      );
    } else if (spec.text) {
      slide.addText(spec.text, {
        x: 0.8,
        y: 1.5,
        w: 11.7,
        h: 5,
        fontSize: 24,
        color: "222222",
        valign: "top",
      });
    }
    if (spec.notes) slide.addNotes(spec.notes);
  });
  await pptx.writeFile({ fileName: outFile });
}

// ---------------------------------------------------------------- CLI

const HELP = `Cimes Office toolkit (Word, Excel, PowerPoint sans Microsoft Office)

Lire
  node office.mjs read <fichier.docx|xlsx|pptx|pdf>    texte (docx: Markdown, autres: JSON ; pdf: texte par page)
Créer
  node office.mjs md2docx <entree.md> <sortie.docx> [titre]
  node office.mjs csv2xlsx <entree.csv> <sortie.xlsx>
  node office.mjs xlsx2csv <entree.xlsx> <sortie.csv> [feuille]
  node office.mjs json2pptx <diapos.json> <sortie.pptx>     [{"title","bullets":[],"text","notes","subtitle"}]
OCR (documents scannés, hors ligne)
  node office.mjs ocr <fichier.pdf|png|jpg|bmp> [pages ex. 1,2,5]   texte reconnu (français et anglais)
Modifier (garde la mise en forme)
  node office.mjs replace <fichier> <remplacements.json> <sortie>   {"ancien":"nouveau"}
Bibliothèque : import { docx, ExcelJS, PptxGenJS, mammoth, JSZip } from "<chemin>/office.mjs"`;

async function main(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case "read": {
      const file = args[0];
      const ext = extOf(file);
      if (ext === ".docx") console.log(await readDocx(file));
      else if (ext === ".xlsx")
        console.log(JSON.stringify(await readXlsx(file), null, 1));
      else if (ext === ".pptx")
        console.log(JSON.stringify(await readPptx(file), null, 1));
      else if (ext === ".pdf") console.log(JSON.stringify(await readPdf(file), null, 1));
      else throw new Error("Formats lus : .docx, .xlsx, .pptx, .pdf");
      return;
    }
    case "ocr": {
      const file = args[0];
      const ext = extOf(file);
      if (ext === ".pdf") {
        const pages = args[1] ? args[1].split(",").map(Number).filter(Boolean) : undefined;
        console.log(JSON.stringify(await ocrPdf(file, { pages }), null, 1));
      } else if ([".png", ".jpg", ".jpeg", ".bmp"].includes(ext)) {
        console.log(await ocrImage(file));
      } else throw new Error("Formats OCR : .pdf, .png, .jpg, .jpeg, .bmp");
      return;
    }
    case "md2docx":
      await markdownToDocx(fs.readFileSync(args[0], "utf8"), args[1], {
        title: args[2],
      });
      console.log(`Créé : ${args[1]}`);
      return;
    case "csv2xlsx":
      await csvToXlsx(args[0], args[1]);
      console.log(`Créé : ${args[1]}`);
      return;
    case "xlsx2csv":
      await xlsxToCsv(args[0], args[1], args[2]);
      console.log(`Créé : ${args[1]}`);
      return;
    case "json2pptx":
      await jsonToPptx(JSON.parse(fs.readFileSync(args[0], "utf8")), args[1]);
      console.log(`Créé : ${args[1]}`);
      return;
    case "replace": {
      const map = JSON.parse(fs.readFileSync(args[1], "utf8"));
      const count = await replaceText(args[0], map, args[2]);
      console.log(`${count} remplacement(s) -> ${args[2]}`);
      return;
    }
    default:
      console.log(HELP);
  }
}

const invoked =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`Erreur : ${error.message}`);
    process.exit(1);
  });
}
