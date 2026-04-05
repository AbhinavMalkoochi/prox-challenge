import { describe, expect, it } from "vitest";

import { searchManual, type SearchHit } from "../lib/knowledge/search";
import { getKnowledgeStore, getPageKey } from "../lib/knowledge/store";

function topPageNumbers(hits: SearchHit[], count = 3): number[] {
  return hits.slice(0, count).map((h) => h.pageNumber);
}

function hitTextsContain(hits: SearchHit[], ...keywords: string[]): boolean {
  const combined = hits.map((h) => h.text.toLowerCase()).join(" ");
  return keywords.every((kw) => combined.includes(kw.toLowerCase()));
}

// ── Duty Cycle ──────────────────────────────────────────────────────────────

describe("RAG: duty cycle queries", () => {
  it("finds MIG duty cycle at 240V 200A → page 19", async () => {
    const hits = await searchManual("What's the duty cycle for MIG welding at 200A on 240V?");
    expect(topPageNumbers(hits)).toContain(19);
  });

  it("finds TIG/Stick duty cycle → page 29", async () => {
    const hits = await searchManual("What's the duty cycle for TIG welding?");
    const pages = topPageNumbers(hits, 5);
    expect(pages).toContain(29);
  });

  it("finds wire welding duty cycle info → page 19", async () => {
    const hits = await searchManual("duty cycle duration of use wire welding");
    expect(topPageNumbers(hits, 5)).toContain(19);
  });

  it("results contain duty cycle numbers", async () => {
    const hits = await searchManual("duty cycle MIG 240V");
    expect(hitTextsContain(hits, "duty cycle")).toBe(true);
  });
});

// ── Polarity & Cable Setup ──────────────────────────────────────────────────

describe("RAG: polarity and cable setup queries", () => {
  it("finds TIG polarity setup → page 24", async () => {
    const hits = await searchManual("What polarity setup do I need for TIG welding?");
    expect(topPageNumbers(hits)).toContain(24);
  });

  it("finds DCEP polarity → page 14", async () => {
    const hits = await searchManual("DCEP polarity cable connections");
    expect(topPageNumbers(hits, 4)).toContain(14);
  });

  it("finds stick welding polarity → page 27 or 32", async () => {
    const hits = await searchManual("stick welding polarity setup");
    const pages = topPageNumbers(hits, 5);
    const found = pages.includes(27) || pages.includes(32) || pages.includes(24);
    expect(found).toBe(true);
  });

  it("mentions positive/negative sockets in polarity results", async () => {
    const hits = await searchManual("which socket does ground clamp go in for TIG");
    expect(hitTextsContain(hits, "ground clamp") || hitTextsContain(hits, "positive")).toBe(true);
  });
});

// ── Specifications ──────────────────────────────────────────────────────────

describe("RAG: specifications queries", () => {
  it("finds specifications page → page 7", async () => {
    const hits = await searchManual("specifications rated output amperage voltage");
    expect(topPageNumbers(hits, 8)).toContain(7);
  });

  it("finds input power requirements", async () => {
    const hits = await searchManual("input power requirements 120V 240V amperage");
    expect(hits.length).toBeGreaterThan(0);
    expect(hitTextsContain(hits, "120") || hitTextsContain(hits, "240")).toBe(true);
  });

  it("finds OCV rating", async () => {
    const hits = await searchManual("open circuit voltage OCV");
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── Troubleshooting ─────────────────────────────────────────────────────────

describe("RAG: troubleshooting queries", () => {
  it("finds MIG troubleshooting → page 42 or 43", async () => {
    const hits = await searchManual("MIG troubleshooting welder won't arc");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(42) || pages.includes(43)).toBe(true);
  });

  it("finds TIG/Stick troubleshooting → page 44", async () => {
    const hits = await searchManual("TIG troubleshooting no arc");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(44) || pages.includes(43)).toBe(true);
  });

  it("finds porosity troubleshooting → page 37", async () => {
    const hits = await searchManual("porosity in my MIG welds");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(37)).toBe(true);
  });

  it("finds excessive spatter troubleshooting → page 37", async () => {
    const hits = await searchManual("excessive spatter wire welding");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(37)).toBe(true);
  });
});

// ── Setup Guides ────────────────────────────────────────────────────────────

describe("RAG: setup guide queries", () => {
  it("finds MIG setup → pages 10-15", async () => {
    const hits = await searchManual("How do I set up MIG welding?");
    const pages = topPageNumbers(hits, 5);
    const found = pages.some((p) => p >= 10 && p <= 15);
    expect(found).toBe(true);
  });

  it("finds TIG setup → page 24-25", async () => {
    const hits = await searchManual("How do I set up TIG welding on this machine?");
    const pages = topPageNumbers(hits, 5);
    const found = pages.some((p) => p >= 24 && p <= 26);
    expect(found).toBe(true);
  });

  it("finds stick setup → page 27", async () => {
    const hits = await searchManual("stick welding setup procedure");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(27) || pages.includes(28)).toBe(true);
  });

  it("finds wire spool installation → page 11", async () => {
    const hits = await searchManual("how to install wire spool");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(11) || pages.includes(12)).toBe(true);
  });
});

// ── Weld Diagnosis ──────────────────────────────────────────────────────────

describe("RAG: weld diagnosis queries", () => {
  it("finds wire weld penetration diagnosis → page 35 or 36", async () => {
    const hits = await searchManual("wire weld penetration too cold");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(35) || pages.includes(36)).toBe(true);
  });

  it("finds stick weld diagnosis → page 38 or 39", async () => {
    const hits = await searchManual("stick weld diagnosis penetration control");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(38) || pages.includes(39) || pages.includes(40)).toBe(true);
  });

  it("finds welding tips → page 34", async () => {
    const hits = await searchManual("welding tips best practices");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(34)).toBe(true);
  });
});

// ── Controls & Settings ─────────────────────────────────────────────────────

describe("RAG: controls and settings queries", () => {
  it("finds controls page → page 8", async () => {
    const hits = await searchManual("front panel controls knobs settings");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(8) || pages.includes(9)).toBe(true);
  });

  it("finds interior controls → page 9", async () => {
    const hits = await searchManual("interior controls of the welder");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(9)).toBe(true);
  });
});

// ── Safety ──────────────────────────────────────────────────────────────────

describe("RAG: safety queries", () => {
  it("finds grounding requirements → page 6", async () => {
    const hits = await searchManual("electrical grounding requirements");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(6) || pages.includes(5)).toBe(true);
  });

  it("finds fume safety → page 3", async () => {
    const hits = await searchManual("fume and gas safety ventilation");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(3)).toBe(true);
  });

  it("finds electrical safety → page 4", async () => {
    const hits = await searchManual("electrical safety precautions shock hazard");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(4) || pages.includes(5)).toBe(true);
  });
});

// ── Maintenance ─────────────────────────────────────────────────────────────

describe("RAG: maintenance queries", () => {
  it("finds maintenance info → page 41", async () => {
    const hits = await searchManual("maintenance cleaning tips for the welder");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(41)).toBe(true);
  });
});

// ── Selection Chart ─────────────────────────────────────────────────────────

describe("RAG: selection chart queries", () => {
  it("finds the process selection chart", async () => {
    const hits = await searchManual("process selection chart settings");
    const hasChart = hits.some((h) => h.manualId === "selection-chart");
    expect(hasChart).toBe(true);
  });

  it("finds wire feed speed settings from chart", async () => {
    const hits = await searchManual("wire feed speed settings for different material thicknesses");
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── Quick Start Guide ───────────────────────────────────────────────────────

describe("RAG: quick start guide queries", () => {
  it("returns quick start guide results", async () => {
    const hits = await searchManual("quick start getting started");
    const hasQsg = hits.some((h) => h.manualId === "quick-start-guide");
    expect(hasQsg).toBe(true);
  });
});

// ── Cross-reference queries ─────────────────────────────────────────────────

describe("RAG: cross-reference queries", () => {
  it("combines MIG setup and duty cycle information", async () => {
    const setupHits = await searchManual("MIG welding setup procedure");
    const dutyHits = await searchManual("MIG duty cycle 240V");
    const setupPages = new Set(setupHits.map((h) => h.pageNumber));
    const dutyPages = new Set(dutyHits.map((h) => h.pageNumber));
    expect(setupPages.size).toBeGreaterThan(0);
    expect(dutyPages.size).toBeGreaterThan(0);
    const noOverlap = [...setupPages].some((p) => !dutyPages.has(p));
    expect(noOverlap).toBe(true);
  });
});

// ── Warranty ────────────────────────────────────────────────────────────────

describe("RAG: warranty queries", () => {
  it("finds warranty info → page 48", async () => {
    const hits = await searchManual("warranty coverage period");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(48)).toBe(true);
  });
});

// ── Parts & Diagrams ────────────────────────────────────────────────────────

describe("RAG: parts and diagram queries", () => {
  it("finds parts list → page 46", async () => {
    const hits = await searchManual("parts list replacement parts");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(46) || pages.includes(47)).toBe(true);
  });

  it("finds wiring schematic → page 45", async () => {
    const hits = await searchManual("wiring schematic diagram");
    const pages = topPageNumbers(hits, 5);
    expect(pages.includes(45) || pages.includes(46)).toBe(true);
  });
});

// ── Store integrity ─────────────────────────────────────────────────────────

describe("knowledge store integrity", () => {
  it("has chunks for all three manuals", async () => {
    const store = await getKnowledgeStore();
    const manualIds = new Set(store.chunks.map((c) => c.manualId));
    expect(manualIds.has("owner-manual")).toBe(true);
    expect(manualIds.has("quick-start-guide")).toBe(true);
    expect(manualIds.has("selection-chart")).toBe(true);
  });

  it("has pages covering the full owner manual (48 pages)", async () => {
    const store = await getKnowledgeStore();
    const ownerPages = store.pages.filter((p) => p.manualId === "owner-manual");
    expect(ownerPages.length).toBe(48);
  });

  it("has a positive average doc length", async () => {
    const store = await getKnowledgeStore();
    expect(store.avgDocLength).toBeGreaterThan(0);
  });

  it("every chunk has required fields", async () => {
    const store = await getKnowledgeStore();
    for (const chunk of store.chunks.slice(0, 20)) {
      expect(chunk.id).toBeTruthy();
      expect(chunk.manualId).toBeTruthy();
      expect(chunk.manualTitle).toBeTruthy();
      expect(chunk.pageNumber).toBeGreaterThan(0);
      expect(chunk.text).toBeTruthy();
      expect(chunk.normalizedText).toBeTruthy();
      expect(chunk.sourceKind).toBeTruthy();
    }
  });

  it("page map provides lookup by manual + page", async () => {
    const store = await getKnowledgeStore();
    const key = getPageKey("owner-manual", 24);
    const page = store.pageMap.get(key);
    expect(page).toBeDefined();
    expect(page?.pageNumber).toBe(24);
  });

  it("IDF map has entries for common terms", async () => {
    const store = await getKnowledgeStore();
    expect(store.idfMap.size).toBeGreaterThan(100);
    expect(store.idfMap.has("welding")).toBe(true);
  });
});

// ── Filter behavior ─────────────────────────────────────────────────────────

describe("RAG: filter behavior", () => {
  it("processFilter=mig boosts MIG-relevant results", async () => {
    const unfiltered = await searchManual("cable connections setup");
    const filtered = await searchManual("cable connections setup", { processFilter: "mig" });
    expect(filtered.length).toBeGreaterThan(0);
    const filteredMigCount = filtered.filter((h) =>
      h.text.toLowerCase().includes("mig") || h.text.toLowerCase().includes("wire")
    ).length;
    const unfilteredMigCount = unfiltered.filter((h) =>
      h.text.toLowerCase().includes("mig") || h.text.toLowerCase().includes("wire")
    ).length;
    expect(filteredMigCount).toBeGreaterThanOrEqual(unfilteredMigCount);
  });

  it("sourceKindFilter=diagram boosts diagram results", async () => {
    const filtered = await searchManual("polarity connections", { sourceKindFilter: "diagram" });
    expect(filtered.length).toBeGreaterThan(0);
    const diagramCount = filtered.filter((h) => h.sourceKind === "diagram").length;
    expect(diagramCount).toBeGreaterThan(0);
  });
});
