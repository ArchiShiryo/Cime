// Reading OpenDocument files (LibreOffice): .odt text, .ods spreadsheets, .odp presentations.
// They are zip files whose content.xml is parsed with a small XML reader (no dependency).
import fs from "node:fs";
import JSZip from "jszip";

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&amp;": "&" };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(?:lt|gt|quot|apos|amp);/g, (e) => ENTITIES[e]);

/** Minimal XML tree: { name, attrs, children: (node|string)[] }. */
export function parseXml(xml) {
  const root = { name: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.children.push(m[1]);
    else if (m[3] !== undefined) {
      if (m[2]) {
        if (stack.length > 1) stack.pop();
      } else {
        const attrs = {};
        for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
          attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
        }
        const node = { name: m[3], attrs, children: [] };
        top.children.push(node);
        if (!m[5]) stack.push(node);
      }
    } else if (m[6] !== undefined) top.children.push(decode(m[6]));
  }
  return root;
}

const isNode = (n) => typeof n === "object" && n !== null;

/** Text of an ODF paragraph-like node, honouring spaces, tabs, line breaks and ignoring notes/annotations. */
function inlineText(node) {
  let out = "";
  for (const child of node.children) {
    if (!isNode(child)) out += child;
    else if (child.name === "text:s") out += " ".repeat(Math.min(Number(child.attrs["text:c"] ?? 1), 50));
    else if (child.name === "text:tab") out += "\t";
    else if (child.name === "text:line-break") out += "\n";
    else if (child.name === "office:annotation" || child.name === "text:note" || child.name === "text:tracked-changes") continue;
    else out += inlineText(child);
  }
  return out;
}

function* descendants(node, names) {
  for (const child of node.children) {
    if (!isNode(child)) continue;
    if (names.has(child.name)) yield child;
    else yield* descendants(child, names);
  }
}
const firstChild = (node, name) => node.children.find((c) => isNode(c) && c.name === name);
const findAll = (node, name) => [...descendants(node, new Set([name]))];

async function contentXml(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const entry = zip.file("content.xml");
  if (!entry) throw new Error("Not an OpenDocument file: content.xml is missing");
  return parseXml(await entry.async("string"));
}

const bodyOf = (doc, kind) => {
  const office = [...descendants(doc, new Set(["office:document-content"]))][0];
  const body = office && firstChild(office, "office:body");
  return body && firstChild(body, `office:${kind}`);
};

// ------------------------------------------------------------------ .odt

function tableToMarkdown(table) {
  const rows = [];
  for (const row of findAll(table, "table:table-row")) {
    const cells = [];
    for (const cell of row.children.filter((c) => isNode(c) && /^table:(covered-)?table-cell$/.test(c.name))) {
      const repeat = Math.min(Number(cell.attrs["table:number-columns-repeated"] ?? 1), 30);
      const text = findAll(cell, "text:p").map(inlineText).join(" ").replace(/\s+/g, " ").trim();
      for (let i = 0; i < repeat; i++) cells.push(text);
    }
    if (cells.some(Boolean)) rows.push(cells);
  }
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r) => `| ${Array.from({ length: width }, (_, i) => (r[i] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(rows[0]), `| ${Array.from({ length: width }, () => "---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

function blocksToMarkdown(container, out, listDepth = 0) {
  for (const node of container.children) {
    if (!isNode(node)) continue;
    switch (node.name) {
      case "text:h": {
        const level = Math.min(Math.max(Number(node.attrs["text:outline-level"] ?? 1), 1), 6);
        const t = inlineText(node).trim();
        if (t) out.push(`${"#".repeat(level)} ${t}`);
        break;
      }
      case "text:p": {
        const t = inlineText(node).trim();
        if (t) out.push(t);
        break;
      }
      case "text:list":
        for (const item of findAll(node, "text:list-item")) {
          const lead = item.children.find((c) => isNode(c) && (c.name === "text:p" || c.name === "text:h"));
          const t = lead ? inlineText(lead).trim() : "";
          if (t) out.push(`${"  ".repeat(listDepth)}- ${t}`);
          for (const nested of item.children.filter((c) => isNode(c) && c.name === "text:list")) {
            blocksToMarkdown({ children: [nested] }, out, listDepth + 1);
          }
        }
        break;
      case "table:table": {
        const md = tableToMarkdown(node);
        if (md) out.push(md);
        break;
      }
      case "text:section":
      case "text:table-of-content":
      case "text:index-body":
        blocksToMarkdown(node, out, listDepth);
        break;
      default:
        break;
    }
  }
}

/** Text of an .odt as Markdown (headings, paragraphs, lists, tables). */
export async function readOdt(file) {
  const text = bodyOf(await contentXml(file), "text");
  if (!text) throw new Error("Not a text document (.odt)");
  const out = [];
  blocksToMarkdown(text, out);
  return out.join("\n\n");
}

// ------------------------------------------------------------------ .ods

function cellValue(cell) {
  const type = cell.attrs["office:value-type"];
  if (type === "float" || type === "percentage" || type === "currency") {
    const n = Number(cell.attrs["office:value"]);
    if (Number.isFinite(n)) return n;
  }
  if (type === "boolean") return cell.attrs["office:boolean-value"] === "true";
  if (type === "date") return cell.attrs["office:date-value"];
  return findAll(cell, "text:p").map(inlineText).join("\n").trim();
}

/** Sheets of an .ods: [{ name, rows: [{ row, cells }] }] (same shape as readXlsx). */
export async function readOds(file) {
  const spreadsheet = bodyOf(await contentXml(file), "spreadsheet");
  if (!spreadsheet) throw new Error("Not a spreadsheet (.ods)");
  const sheets = [];
  for (const table of findAll(spreadsheet, "table:table")) {
    const rows = [];
    let rowNumber = 0;
    for (const row of table.children.filter((c) => isNode(c) && c.name === "table:table-row")) {
      const repeat = Math.min(Number(row.attrs["table:number-rows-repeated"] ?? 1), 200);
      const cells = [];
      for (const cell of row.children.filter((c) => isNode(c) && /^table:(covered-)?table-cell$/.test(c.name))) {
        const columns = Math.min(Number(cell.attrs["table:number-columns-repeated"] ?? 1), 200);
        const value = cellValue(cell);
        for (let i = 0; i < columns; i++) cells.push(value);
      }
      while (cells.length && (cells[cells.length - 1] === "" || cells[cells.length - 1] === undefined)) cells.pop();
      for (let i = 0; i < repeat; i++) {
        rowNumber++;
        if (cells.length) rows.push({ row: rowNumber, cells: [...cells] });
        else if (repeat > 1) break;
      }
    }
    sheets.push({ name: table.attrs["table:name"] ?? `Sheet${sheets.length + 1}`, rows });
  }
  return sheets;
}

// ------------------------------------------------------------------ .odp

/** Slides of an .odp: [{ slide, text: string[], notes }] (same shape as readPptx). */
export async function readOdp(file) {
  const presentation = bodyOf(await contentXml(file), "presentation");
  if (!presentation) throw new Error("Not a presentation (.odp)");
  const slides = [];
  for (const page of presentation.children.filter((c) => isNode(c) && c.name === "draw:page")) {
    const notesNode = firstChild(page, "presentation:notes");
    const text = [];
    for (const frame of findAll(page, "draw:frame")) {
      if (notesNode && findAll(notesNode, "draw:frame").includes(frame)) continue;
      for (const p of findAll(frame, "text:p")) {
        const t = inlineText(p).trim();
        if (t) text.push(t);
      }
    }
    const notes = notesNode ? findAll(notesNode, "text:p").map((p) => inlineText(p).trim()).filter(Boolean).join("\n") : "";
    slides.push({ slide: slides.length + 1, text, notes });
  }
  return slides;
}
