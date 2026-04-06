import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, escapeHtml, wrapHtml } from "./shared";

export type WeldIssue = {
  name: string;
  description: string;
  causes: { cause: string; fix: string }[];
};

export type WeldDiagnosisInput = {
  weldType: string;
  issues: WeldIssue[];
};

export function buildWeldDiagnosisArtifact(
  input: WeldDiagnosisInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const tabs = input.issues
    .map(
      (issue, i) =>
        `<button class="wd-tab${i === 0 ? " active" : ""}" onclick="showIssue(${i})">${escapeHtml(issue.name)}</button>`
    )
    .join("");

  const panels = input.issues
    .map((issue, i) => {
      const causesHtml = issue.causes
        .map(
          (c, ci) => `
        <div class="wd-cause fade-in" style="animation-delay:${ci * 0.05}s">
          <div class="wd-cause-header">
            <span class="wd-cause-label">Possible Cause</span>
            <span class="wd-cause-text">${escapeHtml(c.cause)}</span>
          </div>
          <div class="wd-fix">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${escapeHtml(c.fix)}</span>
          </div>
        </div>`
        )
        .join("");

      return `
    <div class="wd-panel${i === 0 ? " active" : ""}" data-i="${i}">
      <p class="wd-desc">${escapeHtml(issue.description)}</p>
      ${causesHtml}
    </div>`;
    })
    .join("");

  const css = `
.wd-tabs{display:flex;gap:2px;padding:4px 18px;border-bottom:1px solid #e5e7eb;overflow-x:auto}
.wd-tab{padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;color:#6b7280;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
.wd-tab:hover{color:#111827}
.wd-tab.active{color:#2563eb;border-bottom-color:#2563eb}
.wd-panel{display:none;padding:18px}
.wd-panel.active{display:block}
.wd-desc{font-size:13px;color:#6b7280;margin-bottom:14px;line-height:1.5}
.wd-cause{border:1px solid #f3f4f6;border-radius:8px;margin-bottom:8px;overflow:hidden}
.wd-cause-header{padding:10px 14px;background:#f9fafb}
.wd-cause-label{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;font-weight:700;display:block}
.wd-cause-text{font-size:13px;font-weight:600;color:#111827;margin-top:1px;display:block}
.wd-fix{display:flex;align-items:flex-start;gap:6px;padding:10px 14px;font-size:12px;color:#15803d;line-height:1.5}
.wd-fix svg{flex-shrink:0;margin-top:2px}
`;

  const js = `
function showIssue(i){
  document.querySelectorAll('.wd-tab').forEach(function(t,idx){t.classList.toggle('active',idx===i)});
  document.querySelectorAll('.wd-panel').forEach(function(p,idx){p.classList.toggle('active',idx===i)});
}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">${escapeHtml(input.weldType)} Welding</div>
    <h2>Weld Defect Diagnosis</h2>
  </div>
  <div class="wd-tabs">${tabs}</div>
  ${panels}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `diagnosis-${input.weldType.toLowerCase().replace(/\s+/g, "-")}`,
    type: "text/html",
    title: `${input.weldType} Weld Diagnosis`,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
