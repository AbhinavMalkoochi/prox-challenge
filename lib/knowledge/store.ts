import MiniSearch from "minisearch";

import knowledgeBaseData from "@/data/manual/knowledge-base.json";
import { normalizeExcerptText } from "@/lib/knowledge/excerpt-match";
import type {
  ManualChunk,
  ManualKnowledgeBase,
  ManualPage,
} from "@/lib/knowledge/types";

export type KnowledgeStore = {
  chunks: ManualChunk[];
  pages: ManualPage[];
  pageMap: Map<string, ManualPage>;
  searchIndex: MiniSearch<ManualChunk>;
  idfMap: Map<string, number>;
  avgDocLength: number;
};

let cachedStore: KnowledgeStore | undefined;

function buildPageKey(manualId: string, pageNumber: number): string {
  return `${manualId}:${pageNumber}`;
}

function loadKnowledgeBase(): ManualKnowledgeBase {
  return knowledgeBaseData as ManualKnowledgeBase;
}

function computeIdfMap(chunks: ManualChunk[]): Map<string, number> {
  const docCount = chunks.length;
  const docFreqs = new Map<string, number>();

  for (const chunk of chunks) {
    const uniqueTerms = new Set(
      normalizeExcerptText(chunk.text).split(" ").filter(Boolean)
    );
    for (const term of uniqueTerms) {
      docFreqs.set(term, (docFreqs.get(term) ?? 0) + 1);
    }
  }

  const idfMap = new Map<string, number>();
  for (const [term, df] of docFreqs) {
    idfMap.set(term, Math.log((docCount - df + 0.5) / (df + 0.5) + 1));
  }
  return idfMap;
}

function computeAvgDocLength(chunks: ManualChunk[]): number {
  if (chunks.length === 0) return 1;
  const totalTokens = chunks.reduce(
    (sum, chunk) =>
      sum + chunk.normalizedText.split(" ").filter(Boolean).length,
    0
  );
  return totalTokens / chunks.length;
}

function createKnowledgeStore(): KnowledgeStore {
  const knowledgeBase = loadKnowledgeBase();
  const searchIndex = new MiniSearch<ManualChunk>({
    fields: ["text", "title", "manualTitle"],
    storeFields: [
      "id",
      "manualId",
      "manualTitle",
      "manualKind",
      "pageNumber",
      "title",
      "text",
      "normalizedText",
      "sourceKind",
    ],
    searchOptions: {
      prefix: true,
      fuzzy: 0.12,
      boost: {
        title: 2,
        manualTitle: 1.5,
      },
    },
  });

  searchIndex.addAll(knowledgeBase.chunks);

  const idfMap = computeIdfMap(knowledgeBase.chunks);
  const avgDocLength = computeAvgDocLength(knowledgeBase.chunks);

  return {
    chunks: knowledgeBase.chunks,
    pages: knowledgeBase.pages,
    pageMap: new Map(
      knowledgeBase.pages.map((page) => [
        buildPageKey(page.manualId, page.pageNumber),
        page,
      ])
    ),
    searchIndex,
    idfMap,
    avgDocLength,
  };
}

export function getPageKey(manualId: string, pageNumber: number): string {
  return buildPageKey(manualId, pageNumber);
}

export function getKnowledgeStore(): KnowledgeStore {
  if (!cachedStore) {
    cachedStore = createKnowledgeStore();
  }
  return cachedStore;
}
