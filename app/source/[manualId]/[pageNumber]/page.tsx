import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SourceViewer } from "@/components/source/source-viewer";
import { getHighlightRects } from "@/lib/knowledge/highlights";
import { getSourcePage } from "@/lib/knowledge/source";
import { getManualPdfUrl } from "@/lib/manuals";

export const metadata: Metadata = {
  title: "Source View",
  description: "Exact cited manual page for a grounded response."
};

type SourcePageProps = {
  params: Promise<{
    manualId: string;
    pageNumber: string;
  }>;
  searchParams: Promise<{
    quote?: string;
  }>;
};

export default async function SourcePage(props: SourcePageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const pageNumber = Number(params.pageNumber);

  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    notFound();
  }

  const sourcePage = await getSourcePage({
    manualId: params.manualId,
    pageNumber,
    excerpt: searchParams.quote
  });

  if (!sourcePage) {
    notFound();
  }

  const highlights = getHighlightRects(sourcePage.page, sourcePage.excerpt);
  const pdfUrl = getManualPdfUrl(sourcePage.manualId);

  return (
    <main className="source-page-shell">
      <header className="source-page-header">
        <div>
          <h1>{sourcePage.manualTitle} • page {sourcePage.pageNumber}</h1>
        </div>
        <div className="source-page-actions">
          <Link className="secondary-link" href="/">
            Back to app
          </Link>
          <a
            className="source-button"
            href={`${pdfUrl}#page=${sourcePage.pageNumber}`}
            rel="noreferrer"
            target="_blank"
          >
            Open raw PDF
          </a>
        </div>
      </header>

      <section className="source-page-layout">
        {sourcePage.excerpt ? (
          <article className="quote-panel">
            <blockquote>{sourcePage.excerpt}</blockquote>
          </article>
        ) : null}

        <article className="panel source-panel">
          <SourceViewer
            highlights={highlights}
            pageHeight={sourcePage.page.height}
            pageNumber={sourcePage.pageNumber}
            pageWidth={sourcePage.page.width}
            pdfUrl={pdfUrl}
          />
        </article>
      </section>
    </main>
  );
}
