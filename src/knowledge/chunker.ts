/**
 * Splits extracted document text into overlapping passages for retrieval.
 * Splits on paragraph and sentence boundaries first so a passage rarely cuts
 * a thought in half; very long unbroken text falls back to a hard cut.
 */
export interface ChunkInput {
  text: string;
  /** Page (PDF), slide (PowerPoint) or sheet name, when known. */
  location?: string;
}

export interface Chunk {
  text: string;
  location?: string;
}

export const TARGET_CHUNK_CHARS = 900;
export const MAX_CHUNK_CHARS = 1400;
const OVERLAP_CHARS = 150;

function splitSentences(paragraph: string): string[] {
  const parts = paragraph.match(/[^.!?…\n]+[.!?…]*\s*/g);
  return parts ? parts.map((part) => part.trim()).filter(Boolean) : [];
}

function hardSplit(text: string): string[] {
  const pieces: string[] = [];
  for (
    let start = 0;
    start < text.length;
    start += MAX_CHUNK_CHARS - OVERLAP_CHARS
  ) {
    pieces.push(text.slice(start, start + MAX_CHUNK_CHARS));
  }
  return pieces;
}

export function chunkText(input: ChunkInput): Chunk[] {
  const normalized = input.text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!normalized) return [];
  const units: string[] = [];
  for (const paragraph of normalized.split(/\n{2,}/)) {
    const clean = paragraph.replace(/\n/g, " ").trim();
    if (!clean) continue;
    if (clean.length <= MAX_CHUNK_CHARS) {
      units.push(clean);
      continue;
    }
    for (const sentence of splitSentences(clean)) {
      if (sentence.length <= MAX_CHUNK_CHARS) units.push(sentence);
      else units.push(...hardSplit(sentence));
    }
  }
  const chunks: Chunk[] = [];
  let current = "";
  const flush = () => {
    const text = current.trim();
    if (text) chunks.push({ text, location: input.location });
  };
  for (const unit of units) {
    if (current && current.length + unit.length + 1 > TARGET_CHUNK_CHARS) {
      flush();
      // Carry the tail of the previous passage so context is not lost.
      const tail = current.slice(-OVERLAP_CHARS);
      current = tail.includes(" ") ? tail.slice(tail.indexOf(" ") + 1) : "";
    }
    current = current ? `${current} ${unit}` : unit;
  }
  flush();
  return chunks;
}
