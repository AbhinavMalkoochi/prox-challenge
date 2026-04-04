import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceViewer } from "@/components/source/source-viewer";
import { getHighlightRects } from "@/lib/knowledge/highlights";
import { getSourcePage } from "@/lib/knowledge/source";

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
  const pdfUrl = `/api/manuals/${sourcePage.manualId}/pdf`;

  return (
    <main className="source-page-shell">
      <header className="source-page-header">
        <div>
          <p className="eyebrow">Exact source view</p>
          <h1>
            {sourcePage.manualTitle} • page {sourcePage.pageNumber}
          </h1>
          <p className="source-page-copy">
            This is the exact page the agent cited. Matching text is highlighted
            when the response includes a quote anchor.
          </p>
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
        <article className="panel">
          <div className="panel-header">
            <h2>Source anchor</h2>
            <p>{sourcePage.page.title}</p>
          </div>
          <div className="quote-panel">
            {sourcePage.excerpt ? (
              <blockquote>{sourcePage.excerpt}</blockquote>
            ) : (
              <p>
                No text excerpt was provided for this citation, so the viewer is
                focused on the exact page instead.
              </p>
            )}
          </div>
        </article>

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
