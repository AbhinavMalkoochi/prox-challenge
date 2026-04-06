import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, wrapHtml } from "./shared";

export type DutyCycleRating = {
  amperage: number;
  percent: number;
  weldMinutes: number;
  restMinutes: number;
};

export type DutyCycleInput = {
  process: string;
  voltage: string;
  ratings: DutyCycleRating[];
  continuousAmperage?: number;
};

export function buildDutyCycleArtifact(
  input: DutyCycleInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const cards = input.ratings
    .map(
      (r, i) => `
    <button class="dc-card fade-in${i === 0 ? " selected" : ""}" style="animation-delay:${i * 0.06}s" onclick="pick(${i})">
      <span class="dc-amp">${r.amperage}A</span>
      <span class="tag ${r.percent === 100 ? "tag-green" : r.percent >= 40 ? "tag-blue" : "tag-amber"}">${r.percent}%</span>
    </button>`
    )
    .join("");

  const panels = input.ratings
    .map(
      (r, i) => `
    <div class="dc-detail${i === 0 ? " active" : ""}" data-i="${i}">
      <div class="dc-bar-row">
        <div class="dc-bar-track">
          <div class="dc-bar-fill" style="width:${r.percent}%"></div>
        </div>
        <span class="dc-pct">${r.percent}%</span>
      </div>
      <div class="dc-timing">
        <div class="dc-time-block">
          <span class="dc-time-val">${r.weldMinutes}</span>
          <span class="dc-time-unit">min weld</span>
        </div>
        <span class="dc-time-sep">/</span>
        <div class="dc-time-block">
          <span class="dc-time-val">${r.restMinutes}</span>
          <span class="dc-time-unit">min rest</span>
        </div>
        <span class="dc-time-context">per 10 min cycle</span>
      </div>
      <p class="dc-tip">${r.percent === 100 ? "Continuous welding — no cool-down needed at this amperage." : r.percent >= 40 ? `Comfortable for most jobs. You get ${r.weldMinutes} minutes of arc time before a ${r.restMinutes}-minute break.` : `Short duty window — plan shorter beads and expect frequent cool-down pauses at ${r.amperage}A.`}</p>
    </div>`
    )
    .join("");

  const continuous = input.continuousAmperage
    ? `<div class="dc-cont fade-in" style="animation-delay:${input.ratings.length * 0.06}s">
        <span class="dc-cont-dot"></span>
        <span><strong>${input.continuousAmperage}A</strong> is safe for continuous use</span>
       </div>`
    : "";

  const css = `
.dc-cards{display:flex;gap:6px;padding:14px 18px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.dc-card{display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;transition:all .15s}
.dc-card:hover{border-color:#9ca3af}
.dc-card.selected{border-color:#2563eb;background:rgba(37,99,235,.04)}
.dc-amp{font-size:15px;font-weight:700;color:#111827}
.dc-detail{display:none;padding:18px}
.dc-detail.active{display:block}
.dc-bar-row{display:flex;align-items:center;gap:10px}
.dc-bar-track{flex:1;height:8px;border-radius:4px;background:#f3f4f6;overflow:hidden}
.dc-bar-fill{height:100%;border-radius:4px;background:#2563eb;transition:width .4s ease-out}
.dc-pct{font-size:13px;font-weight:600;color:#2563eb;min-width:36px;text-align:right}
.dc-timing{display:flex;align-items:baseline;gap:6px;margin-top:14px;padding:12px 14px;background:#f9fafb;border-radius:8px;border:1px solid #f3f4f6}
.dc-time-block{display:flex;align-items:baseline;gap:4px}
.dc-time-val{font-size:20px;font-weight:700;color:#111827}
.dc-time-unit{font-size:12px;color:#6b7280;font-weight:500}
.dc-time-sep{color:#d1d5db;font-size:16px}
.dc-time-context{font-size:11px;color:#9ca3af;margin-left:auto}
.dc-tip{margin-top:12px;font-size:12px;color:#6b7280;line-height:1.5}
.dc-cont{display:flex;align-items:center;gap:8px;padding:10px 18px;font-size:12px;color:#16a34a;border-top:1px solid #f3f4f6}
.dc-cont-dot{width:6px;height:6px;border-radius:50%;background:#16a34a}
`;

  const js = `
function pick(i){
  document.querySelectorAll('.dc-card').forEach(function(c,idx){c.classList.toggle('selected',idx===i)});
  document.querySelectorAll('.dc-detail').forEach(function(d,idx){d.classList.toggle('active',idx===i)});
}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">${input.process.toUpperCase()} · ${input.voltage}V Input</div>
    <h2>Duty Cycle Ratings</h2>
  </div>
  <div class="dc-cards">${cards}</div>
  ${panels}
  ${continuous}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `duty-cycle-${input.process}-${input.voltage}`,
    type: "text/html",
    title: `${input.process.toUpperCase()} Duty Cycle — ${input.voltage}V`,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
