import { describe, expect, it } from "vitest";

import { extractReferencedPages } from "../lib/chat/extract-pages";

describe("extractReferencedPages", () => {
  it("extracts single page reference", () => {
    expect(extractReferencedPages("See page 24 for details")).toEqual([24]);
  });

  it("extracts multiple comma-separated pages", () => {
    expect(extractReferencedPages("pages 37, 40, 43")).toEqual([37, 40, 43]);
  });

  it("extracts pages with ampersand", () => {
    expect(extractReferencedPages("pages 10 & 12")).toEqual([10, 12]);
  });

  it("extracts parenthesized page ref", () => {
    expect(extractReferencedPages("Check the polarity diagram (page 24)")).toEqual([24]);
  });

  it("handles p. abbreviation", () => {
    expect(extractReferencedPages("See p. 19")).toEqual([19]);
  });

  it("handles pp. abbreviation", () => {
    expect(extractReferencedPages("See pp. 19, 20")).toEqual([19, 20]);
  });

  it("handles pg. abbreviation", () => {
    expect(extractReferencedPages("Refer to pg. 5")).toEqual([5]);
  });

  it("handles en-dash range", () => {
    const result = extractReferencedPages("pages 10–15");
    expect(result).toEqual([10, 11, 12, 13, 14, 15]);
  });

  it("handles em-dash range", () => {
    const result = extractReferencedPages("pages 3—6");
    expect(result).toEqual([3, 4, 5, 6]);
  });

  it("handles hyphen range", () => {
    const result = extractReferencedPages("pages 20-22");
    expect(result).toEqual([20, 21, 22]);
  });

  it("deduplicates page numbers", () => {
    const result = extractReferencedPages("page 24 and also page 24 again");
    expect(result).toEqual([24]);
  });

  it("returns empty for no page references", () => {
    expect(extractReferencedPages("No page refs here.")).toEqual([]);
  });

  it("handles mixed refs in same text", () => {
    const result = extractReferencedPages(
      "See pages 37, 40 for details. Also check (page 19) and p. 24."
    );
    expect(result).toContain(37);
    expect(result).toContain(40);
    expect(result).toContain(19);
    expect(result).toContain(24);
  });

  it("limits range expansion to 20 pages", () => {
    const result = extractReferencedPages("pages 1-100");
    expect(result).toEqual([1, 100]);
  });

  it("handles Page (capitalized)", () => {
    expect(extractReferencedPages("See Page 42")).toEqual([42]);
  });

  it("handles PAGES (uppercase)", () => {
    expect(extractReferencedPages("PAGES 5, 6, 7")).toEqual([5, 6, 7]);
  });
});
