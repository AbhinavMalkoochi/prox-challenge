import type MiniSearch from "minisearch";

import { normalizeExcerptText } from "@/lib/knowledge/excerpt-match";
import type { ManualChunk } from "@/lib/knowledge/types";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";

export type SearchHit = ManualChunk & {
  score: number;
};

export type SearchFilters = {
  processFilter?: "mig" | "tig" | "stick" | "flux-cored" | "any";
  sourceKindFilter?: "text" | "table" | "diagram" | "chart" | "photo" | "any";
};

// ── Query analysis ──────────────────────────────────────────────────────────

function extractQueryNumbers(query: string): string[] {
  return query.match(/\d+(?:\.\d+)?/g) ?? [];
}

function extractQueryTerms(query: string): string[] {
  return [
    ...new Set(
      normalizeExcerptText(query)
        .split(" ")
        .filter((t) => t.length >= 2)
    ),
  ];
}

function generateNgrams(tokens: string[], n: number): Set<string> {
  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
}

function detectProcess(query: string): string | null {
  const lower = query.toLowerCase();
  if (/\bmig\b/.test(lower)) return "mig";
  if (/\btig\b/.test(lower)) return "tig";
  if (/\bstick\b/.test(lower)) return "stick";
  if (/\bflux[- ]?core/i.test(lower)) return "flux-cored";
  return null;
}

function detectVoltage(query: string): string | null {
  const match = query.match(/\b(120|240)\s*v/i);
  return match ? match[1] : null;
}

// ── BM25 scoring ────────────────────────────────────────────────────────────

const BM25_K1 = 1.2;
const BM25_B = 0.75;

function computeBm25Score(
  queryTerms: string[],
  docTokens: string[],
  idfMap: Map<string, number>,
  avgDocLength: number
): number {
  const docLength = docTokens.length;
  const termFreqs = new Map<string, number>();
  for (const token of docTokens) {
    termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const tf = termFreqs.get(term) ?? 0;
    const idf = idfMap.get(term) ?? 0;
    if (tf === 0 || idf === 0) continue;

    const numerator = tf * (BM25_K1 + 1);
    const denominator =
      tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }
  return score;
}

// ── N-gram overlap scoring ──────────────────────────────────────────────────

function scoreNgramOverlap(
  queryTokens: string[],
  docTokens: string[]
): number {
  if (queryTokens.length < 2 || docTokens.length < 2) return 0;

  const queryBigrams = generateNgrams(queryTokens, 2);
  const docBigrams = generateNgrams(docTokens, 2);
  let bigramHits = 0;
  for (const ng of queryBigrams) {
    if (docBigrams.has(ng)) bigramHits++;
  }

  let trigramHits = 0;
  if (queryTokens.length >= 3 && docTokens.length >= 3) {
    const queryTrigrams = generateNgrams(queryTokens, 3);
    const docTrigrams = generateNgrams(docTokens, 3);
    for (const ng of queryTrigrams) {
      if (docTrigrams.has(ng)) trigramHits++;
    }
  }

  const bigramScore =
    queryBigrams.size > 0 ? (bigramHits / queryBigrams.size) * 4 : 0;
  const trigramScore =
    queryTokens.length >= 3
      ? (trigramHits / Math.max(1, generateNgrams(queryTokens, 3).size)) * 6
      : 0;
  return bigramScore + trigramScore;
}

// ── Metadata scoring ────────────────────────────────────────────────────────

function scoreTitleRelevance(query: string, title: string): number {
  const queryTerms = extractQueryTerms(query).filter((t) => t.length >= 3);
  const titleLower = title.toLowerCase();
  let hits = 0;
  for (const term of queryTerms) {
    if (titleLower.includes(term)) hits++;
  }
  return hits >= 2 ? hits * 8 : hits * 2;
}

function scoreMetadata(
  chunk: ManualChunk,
  query: string,
  filters: SearchFilters
): number {
  let score = 0;
  const lower = query.toLowerCase();
  const chunkText = chunk.normalizedText;

  score += scoreTitleRelevance(query, chunk.title);

  const detectedProcess = detectProcess(query);
  if (detectedProcess && chunkText.includes(detectedProcess)) {
    score += 3;
  }

  const detectedVoltage = detectVoltage(query);
  if (detectedVoltage && chunkText.includes(detectedVoltage)) {
    score += 2;
  }

  if (
    filters.processFilter &&
    filters.processFilter !== "any" &&
    !chunkText.includes(filters.processFilter)
  ) {
    score -= 5;
  }

  if (
    filters.sourceKindFilter &&
    filters.sourceKindFilter !== "any" &&
    chunk.sourceKind !== filters.sourceKindFilter
  ) {
    score -= 3;
  }

  if (lower.includes("duty cycle") && chunk.sourceKind === "table") score += 4;
  if (lower.includes("diagram") && chunk.sourceKind === "diagram") score += 4;
  if (lower.includes("troubleshoot") && chunk.sourceKind === "photo") score += 3;
  if (lower.includes("polarity") && chunk.sourceKind === "diagram") score += 3;
  if (lower.includes("parts") && chunkText.includes("part")) score += 2;

  if (chunk.manualKind === "manual") score += 1;

  return score;
}

// ── Numeric matching ────────────────────────────────────────────────────────

function scoreNumericMatches(text: string, queryNumbers: string[]): number {
  if (queryNumbers.length === 0) return 0;
  return queryNumbers.reduce(
    (acc, val) => acc + (new RegExp(`\\b${val}\\b`).test(text) ? 4 : 0),
    0
  );
}

// ── Strategy runners ────────────────────────────────────────────────────────

type MiniSearchResult = ReturnType<MiniSearch<ManualChunk>["search"]>[number];

type ScoredChunk = {
  chunk: ManualChunk;
  score: number;
};

function runLexicalSearch(
  searchIndex: MiniSearch<ManualChunk>,
  query: string
): ScoredChunk[] {
  const rawResults = searchIndex.search(query, { combineWith: "AND" });
  const fallbackResults =
    rawResults.length > 0
      ? rawResults
      : searchIndex.search(query, { combineWith: "OR" });

  return fallbackResults.map((result: MiniSearchResult) => ({
    chunk: {
      id: result.id as string,
      manualId: result.manualId as string,
      manualTitle: result.manualTitle as string,
      manualKind: result.manualKind as string,
      pageNumber: result.pageNumber as number,
      title: result.title as string,
      text: result.text as string,
      normalizedText: result.normalizedText as string,
      sourceKind: result.sourceKind as ManualChunk["sourceKind"],
    },
    score: result.score,
  }));
}

function runBm25Search(
  chunks: ManualChunk[],
  query: string,
  idfMap: Map<string, number>,
  avgDocLength: number
): ScoredChunk[] {
  const queryTerms = extractQueryTerms(query);
  if (queryTerms.length === 0) return [];

  const scored: ScoredChunk[] = [];
  for (const chunk of chunks) {
    const docTokens = normalizeExcerptText(chunk.text).split(" ").filter(Boolean);
    const score = computeBm25Score(queryTerms, docTokens, idfMap, avgDocLength);
    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 30);
}

function runNgramSearch(
  chunks: ManualChunk[],
  query: string
): ScoredChunk[] {
  const queryTokens = extractQueryTerms(query);
  if (queryTokens.length < 2) return [];

  const scored: ScoredChunk[] = [];
  for (const chunk of chunks) {
    const docTokens = normalizeExcerptText(chunk.text).split(" ").filter(Boolean);
    const score = scoreNgramOverlap(queryTokens, docTokens);
    if (score > 0) {
      scored.push({ chunk, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 30);
}

// ── Reciprocal rank fusion ──────────────────────────────────────────────────

function buildBm25Map(results: ScoredChunk[]): Map<string, number> {
  const map = new Map<string, number>();
  if (results.length === 0) return map;
  const maxScore = results[0].score || 1;
  for (const r of results) {
    map.set(r.chunk.id, r.score / maxScore);
  }
  return map;
}

function buildNgramMap(results: ScoredChunk[]): Map<string, number> {
  const map = new Map<string, number>();
  if (results.length === 0) return map;
  const maxScore = results[0].score || 1;
  for (const r of results) {
    map.set(r.chunk.id, r.score / maxScore);
  }
  return map;
}

function rerankWithHybridSignals(
  lexicalResults: ScoredChunk[],
  bm25Results: ScoredChunk[],
  ngramResults: ScoredChunk[],
  query: string,
  filters: SearchFilters
): SearchHit[] {
  const queryNumbers = extractQueryNumbers(query);
  const bm25Scores = buildBm25Map(bm25Results);
  const ngramScores = buildNgramMap(ngramResults);

  const seen = new Set<string>();
  const candidates: ScoredChunk[] = [...lexicalResults];
  for (const r of lexicalResults) seen.add(r.chunk.id);
  for (const r of bm25Results) {
    if (!seen.has(r.chunk.id)) { seen.add(r.chunk.id); candidates.push(r); }
  }
  for (const r of ngramResults) {
    if (!seen.has(r.chunk.id)) { seen.add(r.chunk.id); candidates.push(r); }
  }

  return candidates
    .map(({ chunk, score: baseScore }) => {
      const fullText = `${chunk.manualTitle} ${chunk.title} ${chunk.text}`;
      const bm25Boost = (bm25Scores.get(chunk.id) ?? 0) * 3;
      const ngramBoost = (ngramScores.get(chunk.id) ?? 0) * 4;
      const numericBoost = scoreNumericMatches(fullText, queryNumbers) * 0.3;
      const metadataBoost = scoreMetadata(chunk, query, filters) * 5;

      return {
        ...chunk,
        score:
          baseScore + bm25Boost + ngramBoost + numericBoost + metadataBoost,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function searchManual(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchHit[]> {
  const store = await getKnowledgeStore();

  const lexicalResults = runLexicalSearch(store.searchIndex, query);
  const bm25Results = runBm25Search(
    store.chunks,
    query,
    store.idfMap,
    store.avgDocLength
  );
  const ngramResults = runNgramSearch(store.chunks, query);

  const ranked = rerankWithHybridSignals(
    lexicalResults,
    bm25Results,
    ngramResults,
    query,
    filters
  );

  const deduped = new Map<string, SearchHit>();
  for (const hit of ranked) {
    const pageKey = getPageKey(hit.manualId, hit.pageNumber);
    const current = deduped.get(pageKey);
    if (!current || hit.score > current.score) {
      deduped.set(pageKey, hit);
    }
    if (deduped.size >= 8) break;
  }

  return [...deduped.values()];
}
