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
import type { ChunkInput } from "./chunker";

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".md",
  ".txt",
  ".csv",
  ".html",
  ".htm",
] as const;

type OfficeToolkit = {
  readPdf(file: string): Promise<{ page: number; text: string }[]>;
  readDocx(file: string): Promise<string>;
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
      const pages = await (await loadToolkit()).readPdf(file);
      return pages.map((page) => ({
        text: page.text,
        location: `p. ${page.page}`,
      }));
    }
    case ".docx":
      return [{ text: await (await loadToolkit()).readDocx(file) }];
    case ".xlsx": {
      const sheets = await (await loadToolkit()).readXlsx(file);
      return sheets.map((sheet) => ({
        location: `feuille ${sheet.name}`,
        text: sheet.rows
          .map((row) => row.cells.map(String).join(" | "))
          .join("\n\n"),
      }));
    }
    case ".pptx": {
      const slides = await (await loadToolkit()).readPptx(file);
      return slides.map((slide) => ({
        location: `diapo ${slide.slide}`,
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
