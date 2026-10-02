import fs from "node:fs";
import path from "node:path";

/** Folder with tesseract.js and the French/English data, or null when this build has none. */
export function getOcrDir(): string | null {
  const candidates = [
    process.env.CIMES_OCR_DIR,
    // Packaged app: copied next to the app by electron-forge (extraResource).
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
      ? path.join(
          (process as NodeJS.Process & { resourcesPath: string }).resourcesPath,
          "ocr",
        )
      : undefined,
    // Development: prepared by scripts/prepare-ocr.mjs.
    path.join(process.cwd(), "resources", "ocr"),
  ];
  for (const dir of candidates) {
    if (
      dir &&
      fs.existsSync(
        path.join(dir, "node_modules", "tesseract.js", "package.json"),
      )
    ) {
      return dir;
    }
  }
  return null;
}
