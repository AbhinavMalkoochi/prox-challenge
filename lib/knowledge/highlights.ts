import type { ManualLine, ManualPage } from "@/lib/knowledge/types";

export type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function lineWindowText(lines: ManualLine[], startIndex: number, windowSize: number): string {
  return normalize(
    lines
      .slice(startIndex, startIndex + windowSize)
      .map((line) => line.text)
      .join(" ")
  );
}

export function getHighlightRects(page: ManualPage, excerpt: string): HighlightRect[] {
  const normalizedExcerpt = normalize(excerpt);

  if (!normalizedExcerpt) {
    return [];
  }

  let bestMatch:
    | {
        score: number;
        lines: ManualLine[];
      }
    | undefined;

  for (let startIndex = 0; startIndex < page.lines.length; startIndex += 1) {
    for (const windowSize of [1, 2, 3]) {
      const lines = page.lines.slice(startIndex, startIndex + windowSize);

      if (lines.length === 0) {
        continue;
      }

      const candidate = lineWindowText(page.lines, startIndex, windowSize);
      const candidateTokens = new Set(candidate.split(" "));
      const excerptTokens = normalizedExcerpt.split(" ");
      const overlap = excerptTokens.filter((token) => candidateTokens.has(token)).length;
      const score =
        overlap +
        (candidate.includes(normalizedExcerpt) ? 100 : 0) +
        (normalizedExcerpt.includes(candidate) ? 20 : 0);

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { score, lines };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 3) {
    return [];
  }

  return bestMatch.lines.map((line) => ({
    x: line.x,
    y: line.y - line.height,
    width: line.width,
    height: line.height + 4
  }));
}
