"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileText, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

import type { Citation } from "@/lib/chat/types";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ── Shared PDF cache ─────────────────────────────────────────────────────────

const pdfCache = new Map<string, Promise<PDFDocumentProxy>>();

function loadPdf(url: string): Promise<PDFDocumentProxy> {
  let entry = pdfCache.get(url);
  if (!entry) {
    entry = getDocument(url).promise;
    pdfCache.set(url, entry);
  }
  return entry;
}

// ── Page thumbnail ───────────────────────────────────────────────────────────

function PageThumbnail({
  manualId,
  pageNumber,
  width = 160,
}: {
  manualId: string;
  pageNumber: number;
  width?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const pdf = await loadPdf(`/api/manuals/${manualId}/pdf`);
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setLoaded(true);
      } catch {
        /* PDF load failed — keep placeholder */
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [manualId, pageNumber, width]);

  return (
    <div className="page-thumb-wrap">
      <canvas
        ref={canvasRef}
        className={`page-thumb-canvas ${loaded ? "loaded" : ""}`}
      />
      {!loaded && (
        <div className="page-thumb-placeholder">
          <FileText size={24} strokeWidth={1.5} />
          <span>p.{pageNumber}</span>
        </div>
      )}
    </div>
  );
}

// ── Expanded page view ───────────────────────────────────────────────────────

function ExpandedPage({
  manualId,
  pageNumber,
}: {
  manualId: string;
  pageNumber: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const pdf = await loadPdf(`/api/manuals/${manualId}/pdf`);
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch {
        /* failed */
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [manualId, pageNumber]);

  return (
    <div className="expanded-page-frame">
      <canvas ref={canvasRef} className="expanded-page-canvas" />
    </div>
  );
}

// ── Source kind badge ─────────────────────────────────────────────────────────

function SourceKindBadge({ kind }: { kind?: string }) {
  const labels: Record<string, string> = {
    diagram: "Diagram",
    table: "Table",
    chart: "Chart",
    photo: "Photo",
    text: "Text",
  };
  const label = labels[kind ?? "text"] ?? "Text";
  return <span className={`source-kind-badge ${kind ?? "text"}`}>{label}</span>;
}

// ── Single source card ───────────────────────────────────────────────────────

function SourceCard({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`source-card ${expanded ? "expanded" : ""}`}>
      <button
        className="source-card-header"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <PageThumbnail
          manualId={citation.manualId}
          pageNumber={citation.pageNumber}
        />
        <div className="source-card-meta">
          <div className="source-card-title-row">
            <span className="source-card-page">Page {citation.pageNumber}</span>
            <SourceKindBadge kind={citation.sourceKind} />
          </div>
          <span className="source-card-manual">{citation.title}</span>
          {citation.pageTitle && (
            <span className="source-card-section">{citation.pageTitle}</span>
          )}
          <p className="source-card-excerpt">{citation.excerpt}</p>
        </div>
        <span className="source-card-chevron">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="source-card-expanded">
          <ExpandedPage
            manualId={citation.manualId}
            pageNumber={citation.pageNumber}
          />
          <div className="source-card-actions">
            <Link
              className="source-card-link"
              href={`/source/${citation.manualId}/${citation.pageNumber}?quote=${encodeURIComponent(citation.excerpt)}`}
              target="_blank"
            >
              <ExternalLink size={14} />
              View with highlights
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public export ────────────────────────────────────────────────────────────

export function SourceCards({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="source-cards-section">
      <div className="source-cards-header">
        <FileText size={14} strokeWidth={2} />
        <span>Sources from the manual</span>
      </div>
      <div className="source-cards-list">
        {citations.map((c, i) => (
          <SourceCard
            key={`${c.manualId}-${c.pageNumber}-${i}`}
            citation={c}
          />
        ))}
      </div>
    </div>
  );
}
