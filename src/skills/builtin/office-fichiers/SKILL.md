---
name: office-fichiers
description: Read, create and edit Word (.docx), Excel (.xlsx) and PowerPoint (.pptx) files, and read the text of PDFs without Microsoft Office, using a provided Node toolkit (no installation, works offline on a locked-down PC). Use whenever the user mentions a Word, Excel or PowerPoint file, a spreadsheet, a report, a slide deck, a mail merge, or wants to modify an existing document.
---

# Word, Excel and PowerPoint files

Everything goes through a single Node script: `office.mjs`, in this skill's folder (the exact path is given by `read_skill`, on the line "The skill folder is"). It works with the Node version already used by Cimes, **with no `npm install` and no internet access**. Run it with the shell tool: `node "<folder>/scripts/office.mjs" <command> ...` (the user is warned before each command).

## Golden rules

1. **Never overwrite the original**: write to a new file (`name-v2.docx`) and say where it is. The user's files are not in the application folder: ask for the full path if needed.
2. **Read before modifying** (`read`), then **read the result back** to check it.
3. Supported formats: `.docx`, `.xlsx`, `.pptx` (read, create, modify), `.pdf` and the LibreOffice formats `.odt`, `.ods`, `.odp` (read-only; to change one, create a new `.docx`/`.xlsx`/`.pptx` or ask the user to "Save as" it). For older `.doc`, `.xls`, `.ppt`: ask the user to "Save as" the recent format. To give the user a **PDF**: write the content in Markdown, then `md2pdf` (or create a Word file and `docx2pdf`); say that the PDF layout is simple and that Word or LibreOffice "Export as PDF" keeps an exact layout.
4. A PDF whose `read` output has empty pages is a scan: use `ocr` on it (optionally with the page numbers). OCR is slow (a few seconds per page) and imperfect: tell the user the text comes from a scan and may contain errors, especially on names, numbers and handwriting (handwriting is not supported).
5. No visual rendering possible (no preview, no PDF): describe what was produced and invite the user to open the file to check the layout.
6. Personal data (pupils, trainees): see `donnees-eleves-rgpd`.

## Commands

```
node office.mjs read file.docx|xlsx|pptx|pdf|odt|ods|odp           # docx: Markdown; xlsx/pptx: JSON; pdf: text by page
node office.mjs md2docx input.md output.docx [title]   # Markdown -> Word (headings, lists, bold/italic, tables)
node office.mjs csv2xlsx input.csv output.xlsx         # CSV -> Excel, bold header, adjusted columns. Write French data with ";" as separator (decimals like 14,5 stay whole)
node office.mjs xlsx2csv input.xlsx output.csv [sheet]
node office.mjs json2pptx slides.json output.pptx      # [{"title","subtitle","bullets":[],"text","notes"}]
node office.mjs replace file replacements.json output  # {"old":"new"}: keeps the formatting
node office.mjs md2pdf input.md output.pdf [title]       # PDF export from Markdown (A4, headings, lists, tables, page numbers), offline
node office.mjs docx2pdf input.docx output.pdf [title]  # Word -> PDF, simplified layout (text, headings, lists, tables; no images)
node office.mjs ocr scan.pdf|png|jpg|bmp [1,2,5]       # OCR for scanned documents and photos of text (French + English), offline
```

`replace` works on .docx (body, headers, footers), .pptx (slides and notes) and .xlsx (text). Ideal for **filling in a template**: keep the template file, replace markers such as `{{NOM}}`.

## When the commands are not enough: write a script

The same file is also a **library**. Create a `.mjs` script (in the project folder, never in the skill folder):

```js
import {
  docx,
  ExcelJS,
  PptxGenJS,
  mammoth,
  JSZip,
} from "<folder>/scripts/office.mjs";
```

- **Word** (`docx`): `new docx.Document({ sections: [{ children: [new docx.Paragraph(...), new docx.Table(...)] }] })`, then `docx.Packer.toBuffer(doc)` and `fs.writeFileSync`. Footers, page numbers (`docx.PageNumber.CURRENT`), images (`docx.ImageRun`), heading styles, landscape orientation, sections.
- **Excel** (`ExcelJS`): `const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)` to open a workbook **keeping its formats**, modify `sheet.getCell("B2").value = ...`, formulas `{ formula: "SUM(B2:B10)" }`, number formats (`numFmt: "0.00 €"`), widths, colours, data validation, conditional formatting, charts not supported. Then `await wb.xlsx.writeFile(output)`.
- **PowerPoint** (`PptxGenJS`): `pptx.addSlide()`, `addText`, `addImage`, `addTable`, `addChart` (native charts), `addNotes`. To modify an existing .pptx, prefer `replace`; to change its structure, `JSZip` lets you edit the XML (slide = `ppt/slides/slideN.xml`).
- **Reading**: `mammoth.convertToMarkdown({ path })` (Word); `ExcelJS` (Excel).

## Canopé charter (if requested)

Background `#F4EFED`, turquoise `#005A5B` (titles, headers), sage `#94A088` (accents), text `#222222`. Font Calibri/Arial (Marianne is often not installed on workstations). Details: `charte-canope` skill. For an exact institutional presentation (official masks), start from the user's .potx template and use `replace`.

## Known pitfalls

- **PDF**: only the text is read (not the layout, nor the images). A scanned PDF has no text: reading returns nothing, tell the user. Creating a PDF is impossible: produce a .docx and ask the user to save it as PDF from Word.

- An Excel cell with a formula has no calculated value until the file is opened in Excel: do not announce numerical results from a formula without computing them yourself.
- Macros (.xlsm, .docm), revision comments, track changes and existing Excel charts may be lost if the file is rewritten with `ExcelJS`: tell the user and work on a copy.
- Words split across several "runs": `replace` handles this case; a home-made script must merge the runs of a paragraph.
- Accents and UTF-8 are handled; for a CSV intended for French Excel, use `;` (that is what `xlsx2csv` does).
