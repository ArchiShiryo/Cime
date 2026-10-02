import { describe, expect, it } from "vitest";
import { chunkText, MAX_CHUNK_CHARS } from "./chunker";
import {
  bm25Scores,
  dot,
  fuseRankings,
  normalizeVector,
  rankIds,
  tokenizeForSearch,
} from "./ranking";

describe("chunkText", () => {
  it("returns nothing for empty text and one chunk for short text", () => {
    expect(chunkText({ text: "  \n " })).toEqual([]);
    expect(chunkText({ text: "Bonjour.", location: "p.1" })).toEqual([
      { text: "Bonjour.", location: "p.1" },
    ]);
  });

  it("splits long text into bounded, overlapping passages", () => {
    const paragraph = Array.from(
      { length: 40 },
      (_, i) => `Phrase numéro ${i} sur les cartes mentales.`,
    ).join(" ");
    const chunks = chunkText({ text: `${paragraph}\n\n${paragraph}` });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks)
      expect(chunk.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 200);
    // Overlap: the end of one passage reappears at the start of the next.
    const tail = chunks[0].text.slice(-60).split(" ").slice(1, 4).join(" ");
    expect(chunks[1].text).toContain(tail);
  });

  it("hard-splits unbroken text", () => {
    const chunks = chunkText({ text: "x".repeat(5000) });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.text.length <= MAX_CHUNK_CHARS + 200)).toBe(
      true,
    );
  });
});

describe("ranking", () => {
  it("folds accents, plurals and stopwords", () => {
    expect(tokenizeForSearch("Les élèves de la classe")).toEqual(
      tokenizeForSearch("eleve classe"),
    );
  });

  it("scores the passage that shares the rarer terms highest", () => {
    const docs = [
      {
        id: 1,
        tokens: tokenizeForSearch(
          "La photosynthèse transforme la lumière en énergie",
        ),
      },
      { id: 2, tokens: tokenizeForSearch("La classe de 6eB visite le musée") },
      { id: 3, tokens: tokenizeForSearch("Le musée est ouvert le lundi") },
    ];
    const scores = bm25Scores(tokenizeForSearch("musée de la classe"), docs);
    expect(rankIds(scores)[0]).toBe(2);
    expect(scores.has(1)).toBe(false);
  });

  it("computes cosine similarity on normalized vectors", () => {
    const a = normalizeVector([3, 4]);
    expect(dot(a, a)).toBeCloseTo(1);
    expect(dot(a, normalizeVector([-4, 3]))).toBeCloseTo(0);
  });

  it("fuses rankings so items found by both lists win", () => {
    const fused = fuseRankings([
      [1, 2, 3],
      [3, 4, 1],
    ]);
    const order = rankIds(fused);
    expect(order[0]).toBe(1);
    expect(new Set(order)).toEqual(new Set([1, 2, 3, 4]));
  });
});
