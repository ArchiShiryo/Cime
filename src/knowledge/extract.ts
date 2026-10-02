/**
 * Text extraction for the knowledge base. Plain-text formats are read
 * directly; PDF, Word, Excel and PowerPoint reuse the dependency-free office
 * toolkit that the `office-fichiers` skill writes to disk, so no extra
 * parsing libraries are bundled twice.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { discoverSkills } from "@/skills/registry";
import { logActivity } from "@/activity/activity_log";
import type { ChunkInput } from "./chunker";

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".md",
  ".txt",
  ".csv",
  ".html",
  ".htm",
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
] as const;

/** A PDF page with less text than this is treated as a scan and read with OCR. */
const SCANNED_PAGE_MIN_CHARS = 20;
const MAX_OCR_PAGES = 60;

type OfficeToolkit = {
  readPdf(file: string): Promise<{ page: number; text: string }[]>;
  ocrAvailable(): boolean;
  ocrImage(file: string): Promise<string>;
  ocrPdf(
    file: string,
    options: { pages?: number[]; maxPages?: number },
  ): Promise<{ page: number; text: string }[]>;
  readDocx(file: string): Promise<string>;
  readOdt(file: string): Promise<string>;
  readOds(
    file: string,
  ): Promise<{ name: string; rows: { cells: unknown[] }[] }[]>;
  readOdp(
    file: string,
  ): Promise<{ slide: number; text: string[]; notes: string }[]>;
  readXlsx(
    file: string,
  ): Promise<{ name: string; rows: { cells: unknown[] }[] }[]>;
  readPptx(
    file: string,
  ): Promise<{ slide: number; text: string[]; notes: string }[]>;
};

let toolkitPromise: Promise<OfficeToolkit> | null = null;

async function loadToolkit(): Promise<OfficeToolkit> {
  toolkitPromise ??= (async () => {
    // Writing the skill files to disk is a side effect of discovering skills.
    const skills = await discoverSkills({ includeDisabled: true });
    const office = skills.find((skill) => skill.name === "office-fichiers");
    if (!office?.dir) {
      throw new DyadError(
        "Office toolkit unavailable",
        DyadErrorKind.Precondition,
      );
    }
    const file = path.join(office.dir, "scripts", "office.mjs");
    return (await import(
      /* @vite-ignore */ pathToFileURL(file).href
    )) as OfficeToolkit;
  })();
  try {
    return await toolkitPromise;
  } catch (error) {
    toolkitPromise = null;
    throw error;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Extracted text of a file, as inputs for the chunker (one per page, slide or sheet). */
export async function extractDocument(file: string): Promise<ChunkInput[]> {
  const ext = path.extname(file).toLowerCase();
  switch (ext) {
    case ".md":
    case ".txt":
    case ".csv":
      return [{ text: await fs.promises.readFile(file, "utf8") }];
    case ".html":
    case ".htm":
      return [{ text: stripHtml(await fs.promises.readFile(file, "utf8")) }];
    case ".pdf": {
      const toolkit = await loadToolkit();
      const pages = await toolkit.readPdf(file);
      const scanned = pages
        .filter((page) => page.text.length < SCANNED_PAGE_MIN_CHARS)
        .map((page) => page.page);
      if (scanned.length > 0 && toolkit.ocrAvailable()) {
        const started = Date.now();
        try {
          const read = await toolkit.ocrPdf(file, {
            pages: scanned,
            maxPages: MAX_OCR_PAGES,
          });
          for (const result of read) {
            const page = pages.find((p) => p.page === result.page);
            if (page) page.text = result.text;
          }
          logActivity({
            kind: "ocr",
            name: "pdf",
            status: "ok",
            ms: Date.now() - started,
            detail: `${path.basename(file)}: ${read.length} page(s) read`,
          });
        } catch (error) {
          logActivity({
            kind: "ocr",
            name: "pdf",
            status: "error",
            detail: `${path.basename(file)}: ${error instanceof Error ? error.message : String(error)}`,
          });
          throw error;
        }
      }
      return pages.map((page) => ({
        text: page.text,
        location: `p. ${page.page}`,
      }));
    }
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".bmp": {
      const toolkit = await loadToolkit();
      if (!toolkit.ocrAvailable()) {
        throw new DyadError(
          "OCR is not installed with this version.",
          DyadErrorKind.Precondition,
        );
      }
      const started = Date.now();
      const text = await toolkit.ocrImage(file);
      logActivity({
        kind: "ocr",
        name: "image",
        status: "ok",
        ms: Date.now() - started,
        detail: path.basename(file),
      });
      return [{ text }];
    }
    case ".docx":
      return [{ text: await (await loadToolkit()).readDocx(file) }];
    case ".odt":
      return [{ text: await (await loadToolkit()).readOdt(file) }];
    case ".xlsx":
    case ".ods": {
      const toolkit = await loadToolkit();
      const sheets =
        ext === ".ods"
          ? await toolkit.readOds(file)
          : await toolkit.readXlsx(file);
      return sheets.map((sheet) => ({
        location: `sheet ${sheet.name}`,
        text: sheet.rows
          .map((row) => row.cells.map(String).join(" | "))
          .join("\n\n"),
      }));
    }
    case ".pptx":
    case ".odp": {
      const toolkit = await loadToolkit();
      const slides =
        ext === ".odp"
          ? await toolkit.readOdp(file)
          : await toolkit.readPptx(file);
      return slides.map((slide) => ({
        location: `slide ${slide.slide}`,
        text: [...slide.text, slide.notes].filter(Boolean).join("\n\n"),
      }));
    }
    default:
      throw new DyadError(
        `Unsupported file type: ${ext}`,
        DyadErrorKind.Validation,
      );
  }
}
