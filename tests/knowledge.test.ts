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

  it("returns results for troubleshooting porosity queries", async () => {
    const results = await searchManual(
      "I'm getting porosity in my flux-cored welds. What should I check?"
    );
    expect(results.length).toBeGreaterThan(0);
    const hasRelevantPage = results.some(
      (r) => r.text.toLowerCase().includes("porosity") || r.title.toLowerCase().includes("troubleshoot")
    );
    expect(hasRelevantPage).toBe(true);
  });

  it("finds wire feed mechanism pages for wire feed questions", async () => {
    const results = await searchManual("How do I adjust the wire feed tension?");
    expect(results.length).toBeGreaterThan(0);
    const hasWireFeed = results.some(
      (r) => r.text.toLowerCase().includes("wire") && r.text.toLowerCase().includes("feed")
    );
    expect(hasWireFeed).toBe(true);
  });

  it("finds safety and grounding information", async () => {
    const results = await searchManual("What are the electrical grounding requirements?");
    expect(results.length).toBeGreaterThan(0);
    const hasGrounding = results.some(
      (r) => r.text.toLowerCase().includes("ground") || r.text.toLowerCase().includes("earth")
    );
    expect(hasGrounding).toBe(true);
  });

  it("returns relevant results for stick welding electrode polarity", async () => {
    const results = await searchManual("What polarity do I need for stick welding?");
    expect(results.length).toBeGreaterThan(0);
    const hasPolarity = results.some(
      (r) =>
        (r.text.toLowerCase().includes("stick") || r.text.toLowerCase().includes("smaw")) &&
        (r.text.toLowerCase().includes("polarity") || r.text.toLowerCase().includes("dcep") || r.text.toLowerCase().includes("positive"))
    );
    expect(hasPolarity).toBe(true);
  });

  it("handles MIG vs flux-cored comparison queries", async () => {
    const results = await searchManual("Compare MIG and flux-cored welding on this machine");
    expect(results.length).toBeGreaterThan(0);
    const hasMig = results.some((r) => r.text.toLowerCase().includes("mig"));
    const hasFlux = results.some(
      (r) => r.text.toLowerCase().includes("flux") || r.text.toLowerCase().includes("fcaw")
    );
    expect(hasMig || hasFlux).toBe(true);
  });

  it("finds the input power specifications", async () => {
    const results = await searchManual("What input power does this welder need? 120V or 240V?");
    expect(results.length).toBeGreaterThan(0);
    const hasPowerInfo = results.some(
      (r) => r.text.includes("120") || r.text.includes("240")
    );
    expect(hasPowerInfo).toBe(true);
  });

  it("returns results for weld quality diagnosis", async () => {
    const results = await searchManual("How do I diagnose bad weld quality? Spatter and burn through");
    expect(results.length).toBeGreaterThan(0);
  });

  it("boosts table results when sourceKindFilter is table", async () => {
    const unfiltered = await searchManual("duty cycle amperage");
    const filtered = await searchManual("duty cycle amperage", {
      sourceKindFilter: "table",
    });
    expect(filtered.length).toBeGreaterThan(0);
    const filteredTableCount = filtered.filter((r) => r.sourceKind === "table").length;
    const unfilteredTableCount = unfiltered.filter((r) => r.sourceKind === "table").length;
    expect(filteredTableCount).toBeGreaterThanOrEqual(unfilteredTableCount);
  });

  it("deduplicates results by page", async () => {
    const results = await searchManual("welding settings and configuration");
    const pages = results.map((r) => `${r.manualId}:${r.pageNumber}`);
    const uniquePages = new Set(pages);
    expect(uniquePages.size).toBe(pages.length);
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
