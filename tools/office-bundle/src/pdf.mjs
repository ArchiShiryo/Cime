// Markdown to PDF with pdf-lib: A4, headings, paragraphs with bold/italic/code, lists, quotes,
// code blocks, tables, page numbers. Standard fonts only (Latin text with accents), so it works
// offline and needs no font files. Characters a standard font cannot show are replaced.
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = { x: 56, top: 64, bottom: 60 };
const ACCENT = rgb(0, 0.353, 0.357); // Canopé turquoise #005A5B
const GREY = rgb(0.35, 0.35, 0.35);
const LIGHT = rgb(0.957, 0.937, 0.929);

const REPLACEMENTS = { " ": " ", " ": " ", " ": " ", "→": "->", "←": "<-", "✓": "v", "✔": "v", "•": "•" };

/** Splits inline Markdown into styled segments: bold, italic, code, plain. */
function inline(text) {
  const segments = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith("`")) segments.push({ text: token.slice(1, -1), style: "code" });
    else if (token.startsWith("**") || token.startsWith("__")) segments.push({ text: token.slice(2, -2), style: "bold" });
    else segments.push({ text: token.slice(1, -1), style: "italic" });
    last = m.index + token.length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.map((s) => ({ ...s, text: s.text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") }));
}

/** Parses the Markdown subset into blocks. */
function parseBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fence = line.match(/^```/);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: "code", lines: code });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        }
        i++;
      }
      i--;
      blocks.push({ type: "table", rows });
      continue;
    }
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const indent = Math.floor((bullet ?? numbered)[1].length / 2);
      blocks.push({ type: "item", indent, marker: bullet ? "•" : `${numbered[2]}.`, text: bullet ? bullet[2] : numbered[3] });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      i--;
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }
    const paragraph = [line.trim()];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(#{1,4}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>\s?|\s*\|)/.test(lines[i + 1])
    ) {
      paragraph.push(lines[++i].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

export async function markdownToPdf(markdown, outFile, options = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title ?? "");
  pdf.setProducer("Cimes");
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    code: await pdf.embedFont(StandardFonts.Courier),
  };
  const supported = new Map(Object.entries(fonts).map(([k, f]) => [k, new Set(f.getCharacterSet())]));
  const clean = (text, style = "regular") => {
    const set = supported.get(style === undefined ? "regular" : style);
    let out = "";
    for (const ch of text.replace(/\t/g, "    ")) {
      const mapped = REPLACEMENTS[ch] ?? ch;
      for (const c of mapped) out += set.has(c.codePointAt(0)) ? c : "?";
    }
    return out;
  };

  let page;
  let y;
  const newPage = () => {
    page = pdf.addPage([PAGE.w, PAGE.h]);
    y = PAGE.h - MARGIN.top;
  };
  newPage();
  const ensure = (height) => {
    if (y - height < MARGIN.bottom) newPage();
  };
  const contentWidth = PAGE.w - 2 * MARGIN.x;

  /** Lays out styled words in lines no wider than `width`. */
  const wrap = (segments, size, width, baseStyle = "regular") => {
    const words = [];
    for (const seg of segments) {
      const style = seg.style ?? baseStyle;
      for (const part of seg.text.split(/(\s+)/)) {
        if (part) words.push({ text: clean(part, style), style, space: /^\s+$/.test(part) });
      }
    }
    const lines = [];
    let line = [];
    let lineWidth = 0;
    for (const word of words) {
      const w = fonts[word.style].widthOfTextAtSize(word.text, size);
      if (word.space) {
        if (line.length) {
          line.push({ ...word, text: " " });
          lineWidth += fonts[word.style].widthOfTextAtSize(" ", size);
        }
        continue;
      }
      if (lineWidth + w > width && line.length) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      line.push(word);
      lineWidth += w;
    }
    while (line.length && line[line.length - 1].space) line.pop();
    if (line.length) lines.push(line);
    return lines;
  };

  const drawLines = (lines, size, x, leading, color = rgb(0.1, 0.1, 0.1)) => {
    for (const line of lines) {
      ensure(leading);
      let cursor = x;
      for (const word of line) {
        page.drawText(word.text, { x: cursor, y: y - size, size, font: fonts[word.style], color });
        cursor += fonts[word.style].widthOfTextAtSize(word.text, size);
      }
      y -= leading;
    }
  };

  if (options.title) {
    const lines = wrap([{ text: options.title, style: "bold" }], 22, contentWidth);
    drawLines(lines, 22, MARGIN.x, 28, ACCENT);
    page.drawLine({ start: { x: MARGIN.x, y: y + 1 }, end: { x: PAGE.w - MARGIN.x, y: y + 1 }, thickness: 1.2, color: ACCENT });
    y -= 14;
  }

  const sizes = { 1: 18, 2: 15, 3: 13, 4: 12 };
  for (const block of parseBlocks(markdown)) {
    switch (block.type) {
      case "heading": {
        const size = sizes[block.level];
        const lines = wrap(inline(block.text), size, contentWidth, "bold");
        ensure(lines.length * (size + 5) + 18);
        y -= block.level === 1 ? 14 : 10;
        drawLines(lines, size, MARGIN.x, size + 5, ACCENT);
        y -= 4;
        break;
      }
      case "paragraph": {
        const lines = wrap(inline(block.text), 10.5, contentWidth);
        drawLines(lines, 10.5, MARGIN.x, 15);
        y -= 7;
        break;
      }
      case "item": {
        const x = MARGIN.x + 14 + block.indent * 16;
        const lines = wrap(inline(block.text), 10.5, PAGE.w - MARGIN.x - x);
        ensure(15);
        page.drawText(clean(block.marker), { x: x - 14, y: y - 10.5, size: 10.5, font: fonts.regular, color: ACCENT });
        drawLines(lines, 10.5, x, 15);
        y -= 3;
        break;
      }
      case "quote": {
        const lines = wrap(inline(block.text), 10.5, contentWidth - 18, "italic");
        const height = lines.length * 15;
        ensure(Math.min(height, 120));
        const top = y;
        drawLines(lines, 10.5, MARGIN.x + 14, 15, GREY);
        page.drawLine({ start: { x: MARGIN.x + 4, y: top }, end: { x: MARGIN.x + 4, y: Math.max(y, MARGIN.bottom) }, thickness: 2, color: ACCENT });
        y -= 7;
        break;
      }
      case "code": {
        for (const raw of block.lines.length ? block.lines : [""]) {
          const lines = wrap([{ text: raw || " ", style: "code" }], 9, contentWidth - 12, "code");
          for (const line of lines.length ? lines : [[{ text: " ", style: "code", space: false }]]) {
            ensure(12.5);
            page.drawRectangle({ x: MARGIN.x, y: y - 11, width: contentWidth, height: 12.5, color: LIGHT });
            let cursor = MARGIN.x + 6;
            for (const word of line) {
              page.drawText(word.text, { x: cursor, y: y - 8.5, size: 9, font: fonts.code, color: rgb(0.1, 0.1, 0.1) });
              cursor += fonts.code.widthOfTextAtSize(word.text, 9);
            }
            y -= 12.5;
          }
        }
        y -= 8;
        break;
      }
      case "rule": {
        ensure(14);
        page.drawLine({ start: { x: MARGIN.x, y: y - 6 }, end: { x: PAGE.w - MARGIN.x, y: y - 6 }, thickness: 0.8, color: GREY });
        y -= 16;
        break;
      }
      case "table": {
        const cols = Math.max(...block.rows.map((r) => r.length));
        const colWidth = contentWidth / cols;
        block.rows.forEach((row, r) => {
          const cells = Array.from({ length: cols }, (_, c) => wrap(inline(row[c] ?? ""), 9.5, colWidth - 10, r === 0 ? "bold" : "regular"));
          const height = Math.max(1, ...cells.map((l) => l.length)) * 13 + 8;
          ensure(height);
          if (r === 0) page.drawRectangle({ x: MARGIN.x, y: y - height, width: contentWidth, height, color: LIGHT });
          page.drawRectangle({ x: MARGIN.x, y: y - height, width: contentWidth, height, borderColor: GREY, borderWidth: 0.5 });
          cells.forEach((lines, c) => {
            const startY = y;
            const saved = y;
            y = startY - 4;
            // draw without page breaks inside a row
            let ly = y;
            for (const line of lines) {
              let cursor = MARGIN.x + c * colWidth + 5;
              for (const word of line) {
                page.drawText(word.text, { x: cursor, y: ly - 9.5, size: 9.5, font: fonts[word.style], color: rgb(0.1, 0.1, 0.1) });
                cursor += fonts[word.style].widthOfTextAtSize(word.text, 9.5);
              }
              ly -= 13;
            }
            y = saved;
            if (c > 0) page.drawLine({ start: { x: MARGIN.x + c * colWidth, y }, end: { x: MARGIN.x + c * colWidth, y: y - height }, thickness: 0.5, color: GREY });
          });
          y -= height;
        });
        y -= 8;
        break;
      }
      default:
        break;
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    const w = fonts.regular.widthOfTextAtSize(label, 8.5);
    p.drawText(label, { x: (PAGE.w - w) / 2, y: 30, size: 8.5, font: fonts.regular, color: GREY });
    if (options.footer) p.drawText(clean(options.footer), { x: MARGIN.x, y: 30, size: 8.5, font: fonts.regular, color: GREY });
  });
  fs.writeFileSync(outFile, await pdf.save());
  return pages.length;
}
