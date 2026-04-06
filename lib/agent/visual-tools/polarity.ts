import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, escapeHtml, wrapHtml } from "./shared";

export type PolarityConnection = {
  cable: string;
  socket: string;
  polarity: "positive" | "negative";
};

export type PolarityInput = {
  process: string;
  connections: PolarityConnection[];
  notes?: string[];
};

const POLARITY_COLORS = {
  positive: { bg: "#fef2f2", border: "#ef4444", label: "+" },
  negative: { bg: "#eff6ff", border: "#3b82f6", label: "−" },
} as const;

export function buildPolarityArtifact(
  input: PolarityInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const connections = input.connections
    .map((c, i) => {
      const color = POLARITY_COLORS[c.polarity];
      return `
    <div class="pol-row fade-in" style="animation-delay:${i * 0.1}s">
      <div class="pol-cable">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color.border}" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v7m0 6v7"/></svg>
        <span>${escapeHtml(c.cable)}</span>
      </div>
      <div class="pol-arrow">
        <svg width="36" height="12" viewBox="0 0 36 12">
          <defs><marker id="a${i}" markerWidth="6" markerHeight="5" refX="6" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="${color.border}"/></marker></defs>
          <line x1="0" y1="6" x2="28" y2="6" stroke="${color.border}" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#a${i})">
            <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite"/>
          </line>
        </svg>
      </div>
      <div class="pol-socket" style="border-color:${color.border};background:${color.bg}">
        <span class="pol-sign" style="color:${color.border}">${color.label}</span>
        <span>${escapeHtml(c.socket)}</span>
      </div>
    </div>`;
    })
    .join("");

  const notes = (input.notes ?? [])
    .map(
      (n, i) => `
    <div class="pol-note fade-in" style="animation-delay:${(input.connections.length + i) * 0.08}s">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      <span>${escapeHtml(n)}</span>
    </div>`
    )
    .join("");

  const css = `
.pol-row{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid #f3f4f6}
.pol-row:last-of-type{border-bottom:none}
.pol-cable{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;flex:1;min-width:0;color:#111827}
.pol-arrow{flex-shrink:0}
.pol-socket{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1.5px solid;font-size:12px;font-weight:600;min-width:120px;color:#111827}
.pol-sign{font-size:18px;font-weight:800;line-height:1}
.pol-note{display:flex;align-items:flex-start;gap:6px;padding:8px 18px;font-size:11px;color:#92400e;background:#fffbeb;border-top:1px solid #fef3c7}
.pol-note svg{flex-shrink:0;margin-top:1px}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">${input.process.toUpperCase()} Process</div>
    <h2>Polarity & Cable Setup</h2>
  </div>
  ${connections}
  ${notes}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `polarity-${input.process}`,
    type: "text/html",
    title: `${input.process.toUpperCase()} Polarity Setup`,
    content: wrapHtml(body, css),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
