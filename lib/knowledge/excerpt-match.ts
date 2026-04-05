import type { ManualLine, ManualPage } from "@/lib/knowledge/types";

export type ExcerptMatch = {
  score: number;
  coverage: number;
  lines: ManualLine[];
  normalizedExcerpt: string;
  normalizedWindow: string;
  excerptText: string;
};

function stripPunctuation(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, " ");
}

export function normalizeExcerptText(value: string): string {
  return stripPunctuation(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeExcerptText(value).split(" ").filter(Boolean);
}

function getWindowText(lines: ManualLine[]): string {
  return lines.map((line) => line.text).join(" ");
}

function getUniqueOverlapRatio(excerptTokens: string[], candidateTokens: string[]): number {
  if (excerptTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  const candidateTokenSet = new Set(candidateTokens);
  const matchedTokenCount = [...new Set(excerptTokens)].filter((token) =>
    candidateTokenSet.has(token)
  ).length;

  return matchedTokenCount / new Set(excerptTokens).size;
}

function getLongestContiguousMatchRatio(
  excerptTokens: string[],
  candidateTokens: string[]
): number {
  if (excerptTokens.length === 0 || candidateTokens.length === 0) {
    return 0;
  }

  let longestMatch = 0;

  for (let excerptIndex = 0; excerptIndex < excerptTokens.length; excerptIndex += 1) {
    for (let candidateIndex = 0; candidateIndex < candidateTokens.length; candidateIndex += 1) {
      let runLength = 0;

      while (
        excerptTokens[excerptIndex + runLength] &&
        excerptTokens[excerptIndex + runLength] === candidateTokens[candidateIndex + runLength]
      ) {
        runLength += 1;
      }

      longestMatch = Math.max(longestMatch, runLength);
    }
  }

  return longestMatch / excerptTokens.length;
}

function scoreLineWindow(lines: ManualLine[], excerpt: string): ExcerptMatch | null {
  const normalizedExcerpt = normalizeExcerptText(excerpt);

  if (!normalizedExcerpt) {
    return null;
  }

  const excerptTokens = tokenize(excerpt);
  const excerptText = getWindowText(lines);
  const normalizedWindow = normalizeExcerptText(excerptText);
  const candidateTokens = tokenize(excerptText);

  if (!normalizedWindow || candidateTokens.length === 0) {
    return null;
  }

  const exactWindowContainsExcerpt = normalizedWindow.includes(normalizedExcerpt);
  const excerptContainsWindow =
    normalizedExcerpt.includes(normalizedWindow) && normalizedWindow.length >= 24;
  const tokenCoverage = getUniqueOverlapRatio(excerptTokens, candidateTokens);
  const contiguousCoverage = getLongestContiguousMatchRatio(excerptTokens, candidateTokens);
  const windowPenalty = Math.max(0, lines.length - 2) * 0.05;
  const exactBonus = exactWindowContainsExcerpt ? 1 : 0;
  const inclusionBonus = excerptContainsWindow ? 0.5 : 0;
  const score =
    exactBonus * 10 + inclusionBonus * 4 + contiguousCoverage * 3 + tokenCoverage * 2 - windowPenalty;

  if (!exactWindowContainsExcerpt && tokenCoverage < 0.62 && contiguousCoverage < 0.45) {
    return null;
  }

  return {
    score,
    coverage: Math.max(tokenCoverage, contiguousCoverage),
    lines,
    normalizedExcerpt,
    normalizedWindow,
    excerptText
  };
}

export function findBestExcerptMatch(page: ManualPage, excerpt: string): ExcerptMatch | null {
  const normalizedExcerpt = normalizeExcerptText(excerpt);

  if (!normalizedExcerpt) {
    return null;
  }

  let bestMatch: ExcerptMatch | null = null;
  const maxWindowSize = Math.min(6, Math.max(1, page.lines.length));

  for (let startIndex = 0; startIndex < page.lines.length; startIndex += 1) {
    for (let windowSize = 1; windowSize <= maxWindowSize; windowSize += 1) {
      const lines = page.lines.slice(startIndex, startIndex + windowSize);

      if (lines.length === 0) {
        continue;
      }

      const match = scoreLineWindow(lines, excerpt);

      if (!match) {
        continue;
      }

      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = match;
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  if (!bestMatch.normalizedWindow.includes(bestMatch.normalizedExcerpt) && bestMatch.coverage < 0.72) {
    return null;
  }

  return bestMatch;
}
