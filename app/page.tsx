import Image from "next/image";

import { getKnowledgeOverview } from "@/lib/knowledge/overview";

const launchChecklist = [
  "Typed artifact workspace with grounded source citations",
  "Exact `View source` links into the supporting manual page",
  "Structured manual extraction for tables, settings, and troubleshooting",
  "Claude Agent SDK orchestration with a visual verification lane"
];

export default async function HomePage() {
  const overview = await getKnowledgeOverview();

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Founding Engineer Challenge</p>
          <h1>Vulcan OmniPro Copilot</h1>
          <p className="lede">
            A multimodal garage-side copilot for the Vulcan OmniPro 220, built
            with an artifact-style interface, grounded retrieval, and exact
            source-page drill downs.
          </p>
          <div className="hero-actions">
            <span className="status-pill">
              Manuals detected: {overview.manuals.length}
            </span>
            <span className="status-pill muted">
              Generated assets: {overview.generatedAssetsReady ? "ready" : "pending"}
            </span>
          </div>
        </div>

        <div className="hero-product">
          <div className="product-card">
            <Image
              src="/product.webp"
              alt="Vulcan OmniPro 220 front view"
              width={560}
              height={420}
              priority
            />
          </div>
          <div className="product-card accent">
            <Image
              src="/product-inside.webp"
              alt="Vulcan OmniPro 220 internal panel"
              width={560}
              height={420}
            />
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Build Direction</h2>
            <p>First checkpoint: the repo is now a real app foundation.</p>
          </div>
          <ul className="checklist">
            {launchChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Manual Corpus</h2>
            <p>The shipped app will read these local assets and expose them as cited evidence.</p>
          </div>
          <div className="manual-list">
            {overview.manuals.map((manual) => (
              <div className="manual-card" key={manual.id}>
                <div>
                  <p className="manual-kind">{manual.kind}</p>
                  <h3>{manual.title}</h3>
                  <p className="manual-file">{manual.filename}</p>
                </div>
                <span className="manual-size">{manual.sizeLabel}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel full-width">
          <div className="panel-header">
            <h2>`View source` experience</h2>
            <p>
              Every grounded answer will carry an explicit source reference that
              can open the exact manual page and the supporting sentence or
              diagram anchor.
            </p>
          </div>
          <div className="source-preview">
            <div className="source-chip">owner-manual • page 24 • polarity-setup</div>
            <button className="source-button" type="button">
              View source
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
