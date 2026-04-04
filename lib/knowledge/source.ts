import { MANUALS } from "@/lib/manuals";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";

export type SourceReference = {
  manualId: string;
  pageNumber: number;
  excerpt?: string;
};

export async function getSourcePage(reference: SourceReference) {
  const knowledgeStore = await getKnowledgeStore();
  const page = knowledgeStore.pageMap.get(
    getPageKey(reference.manualId, reference.pageNumber)
  );

  if (!page) {
    return null;
  }

  const manual = MANUALS.find((entry) => entry.id === reference.manualId);

  return {
    manualId: reference.manualId,
    manualTitle: manual?.title ?? reference.manualId,
    manualFilename: manual?.filename ?? "",
    pageNumber: reference.pageNumber,
    excerpt: reference.excerpt ?? "",
    page
  };
}
