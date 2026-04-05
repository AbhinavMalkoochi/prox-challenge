import { describe, expect, it } from "vitest";

import { getHighlightRects } from "../lib/knowledge/highlights";
import { searchManual } from "../lib/knowledge/search";
import { getSourcePage } from "../lib/knowledge/source";

describe("knowledge retrieval", () => {
  it("prioritizes the TIG polarity page for a polarity question", async () => {
    const results = await searchManual(
      "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?"
    );

    expect(results[0]).toMatchObject({
      manualId: "owner-manual",
      pageNumber: 24
    });
  });

  it("finds the duty cycle guidance page for the 240V 200A query", async () => {
    const results = await searchManual(
      "What's the duty cycle for MIG welding at 200A on 240V?"
    );

    expect(results[0]).toMatchObject({
      manualId: "owner-manual",
      pageNumber: 19
    });
  });
});

describe("source highlighting", () => {
  it("returns highlight rectangles for a known source excerpt", async () => {
    const sourcePage = await getSourcePage({
      manualId: "owner-manual",
      pageNumber: 24,
      excerpt: "Plug Ground Clamp Cable into Positive Socket."
    });

    expect(sourcePage).not.toBeNull();

    const highlights = getHighlightRects(
      sourcePage!.page,
      "Plug Ground Clamp Cable into Positive Socket."
    );

    expect(highlights.length).toBeGreaterThan(0);
  });

  it("matches excerpts even when punctuation differs", async () => {
    const sourcePage = await getSourcePage({
      manualId: "owner-manual",
      pageNumber: 24,
      excerpt: "Plug Ground Clamp Cable into Positive Socket"
    });

    expect(sourcePage).not.toBeNull();

    const highlights = getHighlightRects(
      sourcePage!.page,
      "Plug Ground Clamp Cable into Positive Socket"
    );

    expect(highlights.length).toBeGreaterThan(0);
  });

  it("does not highlight unrelated text on the cited page", async () => {
    const sourcePage = await getSourcePage({
      manualId: "owner-manual",
      pageNumber: 24,
      excerpt: "This sentence does not exist anywhere on the page."
    });

    expect(sourcePage).not.toBeNull();

    const highlights = getHighlightRects(
      sourcePage!.page,
      "This sentence does not exist anywhere on the page."
    );

    expect(highlights).toHaveLength(0);
  });
});
