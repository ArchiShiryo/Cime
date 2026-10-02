/**
 * Hybrid retrieval primitives: BM25 over passages, cosine similarity over
 * embeddings, and reciprocal-rank fusion to combine them. Pure functions.
 */

const FRENCH_STOPWORDS = new Set(
  (
    "le la les l un une des du de d et en à a au aux pour par sur dans que qui quoi est sont été être " +
    "ce cet cette ces se sa son ses leur leurs ne pas plus ou où mais donc car ni il elle ils elles on nous vous je tu " +
    "y avec sans sous entre vers chez comme si the of and to in is are for on with"
  ).split(" "),
);

function foldAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function stem(token: string): string {
  // Light French/English plural and feminine folding.
  if (token.length > 5 && token.endsWith("aux"))
    return `${token.slice(0, -3)}al`;
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  if (token.length > 5 && token.endsWith("e")) return token.slice(0, -1);
  return token;
}

export function tokenizeForSearch(text: string): string[] {
  return foldAccents(text.toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !FRENCH_STOPWORDS.has(token))
    .map(stem);
}

export interface Bm25Document {
  id: number;
  tokens: string[];
}

const K1 = 1.5;
const B = 0.75;

/** BM25 scores for every document that shares at least one term with the query. */
export function bm25Scores(
  queryTokens: string[],
  documents: Bm25Document[],
): Map<number, number> {
  const scores = new Map<number, number>();
  if (documents.length === 0 || queryTokens.length === 0) return scores;
  const averageLength =
    documents.reduce((sum, doc) => sum + doc.tokens.length, 0) /
      documents.length || 1;
  const documentFrequency = new Map<string, number>();
  const termFrequencies = new Map<number, Map<string, number>>();
  const terms = new Set(queryTokens);
  for (const doc of documents) {
    const frequencies = new Map<string, number>();
    for (const token of doc.tokens) {
      if (terms.has(token))
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
    termFrequencies.set(doc.id, frequencies);
    for (const term of frequencies.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  for (const doc of documents) {
    const frequencies = termFrequencies.get(doc.id)!;
    let score = 0;
    for (const term of terms) {
      const tf = frequencies.get(term);
      if (!tf) continue;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      score +=
        (idf * tf * (K1 + 1)) /
        (tf + K1 * (1 - B + (B * doc.tokens.length) / averageLength));
    }
    if (score > 0) scores.set(doc.id, score);
  }
  return scores;
}

export function normalizeVector(vector: ArrayLike<number>): Float32Array {
  const out = new Float32Array(vector.length);
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
  return out;
}

/** Dot product; with normalized vectors this is the cosine similarity. */
export function dot(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += a[i] * b[i];
  return sum;
}

/** Reciprocal-rank fusion of several best-first id lists. */
export function fuseRankings(
  rankings: number[][],
  k = 60,
): Map<number, number> {
  const fused = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      fused.set(id, (fused.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return fused;
}

export function rankIds(scores: Map<number, number>): number[] {
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
