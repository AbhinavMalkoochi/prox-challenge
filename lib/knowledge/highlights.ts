import type { ManualPage } from "@/lib/knowledge/types";
import { findBestExcerptMatch } from "@/lib/knowledge/excerpt-match";

export type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getHighlightRects(page: ManualPage, excerpt: string): HighlightRect[] {
  const bestMatch = findBestExcerptMatch(page, excerpt);

  if (!bestMatch) {
    return [];
  }

  return bestMatch.lines.map((line) => ({
    x: line.x,
    y: line.y - line.height,
    width: line.width,
    height: line.height + 4
  }));
}
