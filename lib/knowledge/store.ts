import { readFile } from "node:fs/promises";
import path from "node:path";

import MiniSearch from "minisearch";

import { GENERATED_DIRECTORY } from "@/lib/manuals";
import type {
  ManualChunk,
  ManualKnowledgeBase,
  ManualPage
} from "@/lib/knowledge/types";

type SearchableChunk = ManualChunk & {
  boostTerms: string;
};

export type KnowledgeStore = {
  chunks: ManualChunk[];
  pages: ManualPage[];
  pageMap: Map<string, ManualPage>;
  searchIndex: MiniSearch<SearchableChunk>;
};

let knowledgeStorePromise: Promise<KnowledgeStore> | undefined;

function buildPageKey(manualId: string, pageNumber: number): string {
  return `${manualId}:${pageNumber}`;
}

async function loadKnowledgeBase(): Promise<ManualKnowledgeBase> {
  const knowledgeBasePath = path.join(
    process.cwd(),
    GENERATED_DIRECTORY,
    "knowledge-base.json"
  );
  const rawContent = await readFile(knowledgeBasePath, "utf8");
  return JSON.parse(rawContent) as ManualKnowledgeBase;
}

async function createKnowledgeStore(): Promise<KnowledgeStore> {
  const knowledgeBase = await loadKnowledgeBase();
  const searchableChunks: SearchableChunk[] = knowledgeBase.chunks.map((chunk) => ({
    ...chunk,
    boostTerms: chunk.keywordHints.join(" ")
  }));

  const searchIndex = new MiniSearch<SearchableChunk>({
    fields: ["text", "title", "boostTerms"],
    storeFields: [
      "id",
      "manualId",
      "manualTitle",
      "manualKind",
      "pageNumber",
      "title",
      "text",
      "normalizedText",
      "keywordHints",
      "sourceKind"
    ],
    searchOptions: {
      prefix: true,
      fuzzy: 0.1,
      boost: {
        title: 2,
        boostTerms: 5
      }
    }
  });

  searchIndex.addAll(searchableChunks);

  return {
    chunks: knowledgeBase.chunks,
    pages: knowledgeBase.pages,
    pageMap: new Map(
      knowledgeBase.pages.map((page) => [buildPageKey(page.manualId, page.pageNumber), page])
    ),
    searchIndex
  };
}

export function getPageKey(manualId: string, pageNumber: number): string {
  return buildPageKey(manualId, pageNumber);
}

export async function getKnowledgeStore(): Promise<KnowledgeStore> {
  if (!knowledgeStorePromise) {
    knowledgeStorePromise = createKnowledgeStore();
  }

  return knowledgeStorePromise;
}
