import { MANUALS } from "@/lib/manuals";
import type { ArtifactSourceRef } from "@/lib/chat/types";

const VALID_MANUAL_IDS = new Set<string>(MANUALS.map((m) => m.id));

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function manualTitleForId(manualId: string): string {
  return MANUALS.find((m) => m.id === manualId)?.title ?? manualId;
}

export function parseSourcePagesFromToolInput(
  input: Record<string, unknown>
): ArtifactSourceRef[] {
  const raw = input.sourcePages;
  if (!Array.isArray(raw)) return [];
  const out: ArtifactSourceRef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { manualId?: unknown; pageNumber?: unknown };
    const manualId = typeof o.manualId === "string" ? o.manualId : "";
    const pageNumber =
      typeof o.pageNumber === "number" ? o.pageNumber : Number(o.pageNumber);
    if (!VALID_MANUAL_IDS.has(manualId)) continue;
    if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;
    out.push({ manualId, pageNumber: Math.floor(pageNumber) });
  }
  return out;
}

export function buildSourceFooter(sourceRefs: ArtifactSourceRef[]): string {
  if (sourceRefs.length === 0) return "";
  const items = sourceRefs.map(
    (r) =>
      `<li>${escapeHtml(manualTitleForId(r.manualId))} · page ${r.pageNumber}</li>`
  );
  return `<div class="src-footer"><span class="src-label">Sources</span><ul>${items.join("")}</ul></div>`;
}

/**
 * Minimalist design system matching the chat UI.
 * Uses the same CSS variables: --text (#111827), --border (#e5e7eb), etc.
 */
export const BASE_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111827;line-height:1.6;padding:16px;background:#fff}
.card{border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}
.card-header{padding:14px 18px;border-bottom:1px solid #e5e7eb}
.card-header h2{font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#111827}
.card-header .sub{font-size:11px;color:#6b7280;margin-top:1px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600}
.tag{display:inline-flex;align-items:center;font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;letter-spacing:0.02em}
.tag-blue{background:rgba(37,99,235,.08);color:#2563eb}
.tag-green{background:rgba(22,163,74,.08);color:#16a34a}
.tag-amber{background:rgba(217,119,6,.08);color:#d97706}
.tag-red{background:rgba(220,38,38,.08);color:#dc2626}
button{font:inherit;cursor:pointer}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeIn .3s ease-out both}
.src-footer{border-top:1px solid #e5e7eb;padding:10px 18px;font-size:11px;color:#6b7280}
.src-label{font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.04em;font-size:10px;display:block;margin-bottom:4px}
.src-footer ul{margin:0;padding-left:1.2em}
.src-footer li{margin:1px 0}
`;

export function wrapHtml(body: string, extraCss = "", extraJs = ""): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLES}${extraCss}</style></head><body>${body}${extraJs ? `<script>${extraJs}<\/script>` : ""}</body></html>`;
}
