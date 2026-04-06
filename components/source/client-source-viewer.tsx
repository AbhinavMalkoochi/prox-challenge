"use client";

import dynamic from "next/dynamic";
import type { HighlightRect } from "@/lib/knowledge/highlights";

const SourceViewer = dynamic(
  () => import("@/components/source/source-viewer").then((m) => m.SourceViewer),
  { ssr: false }
);

type Props = {
  pdfUrl: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  highlights: HighlightRect[];
};

export function ClientSourceViewer(props: Props) {
  return <SourceViewer {...props} />;
}
