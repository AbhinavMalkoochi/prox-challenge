"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { HighlightRect } from "@/lib/knowledge/highlights";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type SourceViewerProps = {
  pdfUrl: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  highlights: HighlightRect[];
};

export function SourceViewer({
  pdfUrl,
  pageNumber,
  pageWidth,
  pageHeight,
  highlights
}: SourceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      const loadingTask = getDocument(pdfUrl);
      const document = await loadingTask.promise;
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.4 });

      if (cancelled) {
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      setScale(viewport.width / pageWidth);

      await page.render({
        canvas,
        canvasContext: context,
        viewport
      }).promise;
    }

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [pageNumber, pageWidth, pdfUrl]);

  return (
    <div className="source-viewer-frame" style={{ width: pageWidth * scale }}>
      <canvas ref={canvasRef} />
      <div className="source-highlight-layer">
        {highlights.map((highlight) => (
          <div
            className="source-highlight"
            key={`${highlight.x}-${highlight.y}-${highlight.width}-${highlight.height}`}
            style={{
              left: highlight.x * scale,
              top: highlight.y * scale,
              width: highlight.width * scale,
              height: highlight.height * scale
            }}
          />
        ))}
      </div>
    </div>
  );
}
