import type MiniSearch from "minisearch";

import type { ManualChunk } from "@/lib/knowledge/types";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";

export type SearchHit = ManualChunk & {
  score: number;
};

function extractQueryNumbers(query: string): string[] {
  return query.match(/\d+(?:\.\d+)?/g) ?? [];
}

function extractSignificantTerms(query: string): string[] {
  const stopwords = new Set([
    "the",
    "and",
    "for",
    "with",
    "what",
    "which",
    "into",
    "from",
    "that",
    "this",
    "when",
    "your",
    "should",
    "check",
    "need"
  ]);

  return [...new Set(query.toLowerCase().match(/[a-z][a-z-]+/g) ?? [])].filter(
    (term) => !stopwords.has(term)
  );
}

function extractImportantPhrases(query: string): string[] {
  const normalized = query.toLowerCase();
  const phrases = [
    "ground clamp",
    "duty cycle",
    "flux-cored",
    "wire feed",
    "selection chart"
  ];

  return phrases.filter((phrase) => normalized.includes(phrase));
}

function extractCriticalDomainTerms(query: string): string[] {
  const normalized = query.toLowerCase();
  const terms = [
    "mig",
    "tig",
    "stick",
    "flux",
    "flux-cored",
    "polarity",
    "socket",
    "porosity",
    "duty",
    "cycle"
  ];

  return terms.filter((term) => normalized.includes(term));
}

function scoreNumericMatches(text: string, queryNumbers: string[]): number {
  if (queryNumbers.length === 0) {
    return 0;
  }

  return queryNumbers.reduce((score, value) => {
    return score + (text.includes(value) ? 8 : 0);
  }, 0);
}

function boostManualKind(manualKind: string): number {
  if (manualKind === "manual") {
    return 4;
  }

  if (manualKind === "guide") {
    return 2;
  }

  return 1;
}

type MiniSearchResult = ReturnType<MiniSearch<ManualChunk>["search"]>[number];

function rerankResults(results: MiniSearchResult[], query: string): SearchHit[] {
  const queryNumbers = extractQueryNumbers(query);
  const significantTerms = extractSignificantTerms(query);
  const importantPhrases = extractImportantPhrases(query);
  const criticalDomainTerms = extractCriticalDomainTerms(query);

  return results
    .map((result) => {
      const text = `${result.title} ${result.text}`.toLowerCase();
      const numericBoost = scoreNumericMatches(text, queryNumbers);
      const kindBoost = boostManualKind(result.manualKind);
      const termBoost = significantTerms.reduce((score, term) => {
        return score + (text.includes(term) ? 8 : 0);
      }, 0);
      const phraseBoost = importantPhrases.reduce((score, phrase) => {
        return score + (text.includes(phrase) ? 24 : 0);
      }, 0);
      const criticalBoost = criticalDomainTerms.reduce((score, term) => {
        return score + (text.includes(term) ? 28 : -18);
      }, 0);

      return {
        id: result.id,
        manualId: result.manualId,
        manualTitle: result.manualTitle,
        manualKind: result.manualKind,
        pageNumber: result.pageNumber,
        title: result.title,
        text: result.text,
        normalizedText: result.normalizedText,
        keywordHints: result.keywordHints,
        sourceKind: result.sourceKind,
        score:
          result.score +
          numericBoost +
          kindBoost +
          termBoost +
          phraseBoost +
          criticalBoost
      };
    })
    .sort((left, right) => right.score - left.score);
}

export async function searchManual(query: string): Promise<SearchHit[]> {
  const knowledgeStore = await getKnowledgeStore();
  const rawResults = knowledgeStore.searchIndex.search(query, {
    combineWith: "AND"
  });
  const fallbackResults =
    rawResults.length > 0
      ? rawResults
      : knowledgeStore.searchIndex.search(query, {
          combineWith: "OR"
        });

  const reranked = rerankResults(fallbackResults, query);
  const deduped = new Map<string, SearchHit>();

  for (const result of reranked) {
    const pageKey = getPageKey(result.manualId, result.pageNumber);
    const current = deduped.get(pageKey);

    if (!current || result.score > current.score) {
      deduped.set(pageKey, result);
    }

    if (deduped.size >= 8) {
      break;
    }
  }

  return [...deduped.values()];
}
