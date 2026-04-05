import { MANUALS } from "@/lib/manuals";
import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";

const VALID_MANUAL_IDS = new Set<string>(MANUALS.map((m) => m.id));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function manualTitleForId(manualId: string): string {
  return MANUALS.find((m) => m.id === manualId)?.title ?? manualId;
}

/** Parse `sourcePages` from tool input (Anthropic returns unknown). */
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
    const pageNumber = typeof o.pageNumber === "number" ? o.pageNumber : Number(o.pageNumber);
    if (!VALID_MANUAL_IDS.has(manualId)) continue;
    if (!Number.isFinite(pageNumber) || pageNumber < 1) continue;
    out.push({ manualId, pageNumber: Math.floor(pageNumber) });
  }
  return out;
}

function buildSourceFooter(sourceRefs: ArtifactSourceRef[]): string {
  if (sourceRefs.length === 0) return "";
  const items = sourceRefs.map(
    (r) =>
      `<li>${escapeHtml(manualTitleForId(r.manualId))} · page ${r.pageNumber}</li>`
  );
  return `<div class="artifact-source-footer"><div class="artifact-source-footer-label">Sources in manual</div><ul>${items.join("")}</ul></div>`;
}

type DutyCycleRating = {
  amperage: number;
  percent: number;
  weldMinutes: number;
  restMinutes: number;
};

type DutyCycleInput = {
  process: string;
  voltage: string;
  ratings: DutyCycleRating[];
  continuousAmperage?: number;
};

type PolarityConnection = {
  cable: string;
  socket: string;
  polarity: "positive" | "negative";
};

type PolarityInput = {
  process: string;
  connections: PolarityConnection[];
  notes?: string[];
};

type TroubleshootingCheck = {
  cause: string;
  solution: string;
};

type TroubleshootingInput = {
  problem: string;
  checks: TroubleshootingCheck[];
};

type SetupStep = {
  instruction: string;
  detail?: string;
  warning?: string;
};

type SetupGuideInput = {
  process: string;
  title: string;
  steps: SetupStep[];
};

type SpecRow = {
  label: string;
  value120v?: string;
  value240v?: string;
};

type SpecsInput = {
  process: string;
  specs: SpecRow[];
};

type WeldIssue = {
  name: string;
  description: string;
  causes: { cause: string; fix: string }[];
};

type WeldDiagnosisInput = {
  weldType: string;
  issues: WeldIssue[];
};

const SHARED_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1e293b;line-height:1.6;padding:20px;background:#fff}
.card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.card-header{padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
.card-header h2{font-size:15px;font-weight:700;letter-spacing:-0.01em}
.card-header .subtitle{font-size:12px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:0.04em;font-weight:600}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:0.03em}
.badge-blue{background:rgba(37,99,235,.1);color:#2563eb}
.badge-green{background:rgba(22,163,74,.1);color:#16a34a}
.badge-amber{background:rgba(217,119,6,.1);color:#d97706}
.badge-red{background:rgba(220,38,38,.1);color:#dc2626}
.badge-purple{background:rgba(124,58,237,.1);color:#7c3aed}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes fillBar{from{width:0}to{width:var(--fill)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
.animate-in{animation:fadeUp .4s ease-out both}
.artifact-source-footer{margin-top:0;border-top:1px solid #e2e8f0;padding:12px 20px;background:#f8fafc;font-size:12px;color:#475569}
.artifact-source-footer-label{font-weight:700;color:#334155;margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em;font-size:10px}
.artifact-source-footer ul{margin:0;padding-left:1.2em}
.artifact-source-footer li{margin:2px 0}
`;

function wrapHtml(body: string, extraCss = "", extraJs = ""): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHARED_STYLES}${extraCss}</style></head><body>${body}${extraJs ? `<script>${extraJs}<\/script>` : ""}</body></html>`;
}

export function buildDutyCycleArtifact(
  input: DutyCycleInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const rows = input.ratings.map((r, i) => `
    <div class="cycle-row animate-in" style="animation-delay:${i * 0.1}s">
      <div class="cycle-header">
        <span class="amp-label">${r.amperage}A</span>
        <span class="badge ${r.percent === 100 ? "badge-green" : r.percent >= 40 ? "badge-blue" : "badge-amber"}">${r.percent}% duty</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill weld-fill" style="--fill:${r.percent}%;animation:fillBar .8s ease-out ${i * 0.15}s both">
          <span class="bar-label">${r.weldMinutes} min weld</span>
        </div>
        ${r.percent < 100 ? `<div class="bar-fill rest-fill" style="--fill:${100 - r.percent}%;animation:fillBar .8s ease-out ${i * 0.15 + 0.3}s both">
          <span class="bar-label">${r.restMinutes} min rest</span>
        </div>` : ""}
      </div>
      <div class="cycle-detail">${r.percent === 100 ? "Continuous welding — no rest needed" : `${r.weldMinutes} min on / ${r.restMinutes} min off per 10 min cycle`}</div>
    </div>`).join("");

  const continuous = input.continuousAmperage
    ? `<div class="continuous-note animate-in" style="animation-delay:${input.ratings.length * 0.1}s">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
        <span><strong>${input.continuousAmperage}A</strong> — safe for continuous (100%) use</span>
       </div>`
    : "";

  const css = `
.cycle-row{padding:14px 20px;border-bottom:1px solid #f1f5f9}
.cycle-row:last-child{border-bottom:none}
.cycle-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.amp-label{font-size:18px;font-weight:700;color:#0f172a}
.bar-track{display:flex;height:32px;border-radius:8px;overflow:hidden;background:#f1f5f9;gap:1px}
.bar-fill{display:flex;align-items:center;justify-content:center;height:100%;width:var(--fill);min-width:fit-content;padding:0 10px}
.weld-fill{background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff}
.rest-fill{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff}
.bar-label{font-size:11px;font-weight:600;white-space:nowrap}
.cycle-detail{font-size:12px;color:#64748b;margin-top:6px}
.continuous-note{display:flex;align-items:center;gap:8px;padding:12px 20px;background:#f0fdf4;color:#15803d;font-size:13px;border-top:1px solid #dcfce7}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="subtitle">${input.process.toUpperCase()} • ${input.voltage}V Input</div>
    <h2>Duty Cycle Ratings</h2>
  </div>
  ${rows}
  ${continuous}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `duty-cycle-${input.process}-${input.voltage}`,
    type: "text/html",
    title: `${input.process.toUpperCase()} Duty Cycle — ${input.voltage}V`,
    content: wrapHtml(body, css),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}

export function buildPolarityArtifact(
  input: PolarityInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const socketColors: Record<string, { bg: string; border: string; label: string }> = {
    positive: { bg: "#fee2e2", border: "#ef4444", label: "+" },
    negative: { bg: "#dbeafe", border: "#3b82f6", label: "−" },
  };

  const connections = input.connections.map((c, i) => {
    const color = socketColors[c.polarity];
    return `
    <div class="conn-row animate-in" style="animation-delay:${i * 0.15}s">
      <div class="conn-cable">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color.border}" stroke-width="2"><path d="M12 2v10m-4-6h8"/><circle cx="12" cy="18" r="4"/></svg>
        <span>${c.cable}</span>
      </div>
      <div class="conn-arrow">
        <svg width="40" height="20" viewBox="0 0 40 20"><defs><marker id="ah${i}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${color.border}"/></marker></defs><line x1="0" y1="10" x2="32" y2="10" stroke="${color.border}" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#ah${i})"><animate attributeName="stroke-dashoffset" from="14" to="0" dur="1s" repeatCount="indefinite"/></line></svg>
      </div>
      <div class="conn-socket" style="background:${color.bg};border-color:${color.border}">
        <span class="socket-polarity" style="color:${color.border}">${color.label}</span>
        <span class="socket-name">${c.socket}</span>
      </div>
    </div>`;
  }).join("");

  const notes = (input.notes ?? []).map((n, i) => `
    <div class="polarity-note animate-in" style="animation-delay:${(input.connections.length + i) * 0.1}s">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
      <span>${n}</span>
    </div>`).join("");

  const css = `
.conn-row{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #f1f5f9}
.conn-row:last-of-type{border-bottom:none}
.conn-cable{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;flex:1;min-width:0}
.conn-arrow{flex-shrink:0;display:flex;align-items:center}
.conn-socket{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;border:2px solid;font-size:13px;font-weight:600;min-width:140px}
.socket-polarity{font-size:20px;font-weight:800;line-height:1}
.socket-name{white-space:nowrap}
.polarity-note{display:flex;align-items:flex-start;gap:8px;padding:10px 20px;font-size:12px;color:#92400e;background:#fffbeb;border-top:1px solid #fef3c7}
.polarity-note svg{flex-shrink:0;margin-top:1px}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="subtitle">${input.process.toUpperCase()} Process</div>
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

export function buildTroubleshootingArtifact(
  input: TroubleshootingInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const checks = input.checks.map((c, i) => `
    <div class="ts-step animate-in" style="animation-delay:${i * 0.08}s" data-idx="${i}">
      <button class="ts-step-header" onclick="toggleStep(${i})">
        <div class="ts-step-num">${i + 1}</div>
        <div class="ts-step-text">
          <div class="ts-cause">${c.cause}</div>
          <div class="ts-solution">${c.solution}</div>
        </div>
        <svg class="ts-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="ts-step-body">
        <div class="ts-body-inner">
          <div class="ts-check-row">
            <button class="ts-check-btn" onclick="checkStep(${i},this)">
              <svg class="check-empty" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
              <svg class="check-done" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" fill="#dcfce7"/><path d="M9 12l2 2 4-4"/></svg>
            </button>
            <span>I've checked this — ${c.solution.toLowerCase().startsWith("check") || c.solution.toLowerCase().startsWith("verify") || c.solution.toLowerCase().startsWith("ensure") ? "done" : "fixed it"}</span>
          </div>
        </div>
      </div>
    </div>`).join("");

  const css = `
.ts-header-bar{padding:16px 20px;display:flex;align-items:flex-start;gap:12px;border-bottom:1px solid #e2e8f0;background:#fef2f2}
.ts-problem-icon{width:36px;height:36px;border-radius:10px;background:#fee2e2;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ts-problem-label{font-size:11px;color:#dc2626;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.ts-problem-title{font-size:15px;font-weight:700;color:#991b1b;margin-top:2px}
.ts-step{border-bottom:1px solid #f1f5f9}
.ts-step:last-child{border-bottom:none}
.ts-step-header{display:flex;align-items:flex-start;gap:12px;padding:14px 20px;width:100%;background:none;border:none;cursor:pointer;text-align:left;color:inherit;font:inherit;transition:background .15s}
.ts-step-header:hover{background:#f8fafc}
.ts-step-num{width:28px;height:28px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#64748b;flex-shrink:0;transition:all .2s}
.ts-step.active .ts-step-num{background:#2563eb;color:#fff}
.ts-step.resolved .ts-step-num{background:#16a34a;color:#fff}
.ts-cause{font-size:13px;font-weight:600;color:#0f172a}
.ts-solution{font-size:12px;color:#64748b;margin-top:2px}
.ts-chevron{flex-shrink:0;color:#94a3b8;transition:transform .2s;margin-top:4px}
.ts-step.active .ts-chevron{transform:rotate(180deg)}
.ts-step-body{max-height:0;overflow:hidden;transition:max-height .25s ease-out}
.ts-step.active .ts-step-body{max-height:100px}
.ts-body-inner{padding:0 20px 14px 60px}
.ts-check-row{display:flex;align-items:center;gap:8px;font-size:13px;color:#475569}
.ts-check-btn{background:none;border:none;cursor:pointer;padding:0;display:flex}
.check-done{display:none}
.ts-step.resolved .check-done{display:block}
.ts-step.resolved .check-empty{display:none}
.ts-step.resolved .ts-cause{text-decoration:line-through;color:#94a3b8}
.ts-progress{padding:12px 20px;background:#f0fdf4;border-top:1px solid #dcfce7;display:flex;align-items:center;gap:10px}
.ts-progress-bar{flex:1;height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden}
.ts-progress-fill{height:100%;background:#16a34a;border-radius:3px;transition:width .3s ease-out;width:0}
.ts-progress-label{font-size:12px;font-weight:600;color:#16a34a;white-space:nowrap}
`;

  const js = `
function toggleStep(i){
  document.querySelectorAll('.ts-step').forEach(function(s,idx){
    if(idx===i)s.classList.toggle('active');
    else s.classList.remove('active');
  });
}
function checkStep(i,btn){
  var step=btn.closest('.ts-step');
  step.classList.add('resolved');
  step.classList.remove('active');
  updateProgress();
}
function updateProgress(){
  var total=document.querySelectorAll('.ts-step').length;
  var done=document.querySelectorAll('.ts-step.resolved').length;
  var pct=Math.round(done/total*100);
  var fill=document.querySelector('.ts-progress-fill');
  var label=document.querySelector('.ts-progress-label');
  if(fill)fill.style.width=pct+'%';
  if(label)label.textContent=done+'/'+total+' checked';
}
updateProgress();
`;

  const body = `
<div class="card">
  <div class="ts-header-bar">
    <div class="ts-problem-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
    </div>
    <div>
      <div class="ts-problem-label">Troubleshooting</div>
      <div class="ts-problem-title">${input.problem}</div>
    </div>
  </div>
  ${checks}
  <div class="ts-progress">
    <div class="ts-progress-bar"><div class="ts-progress-fill"></div></div>
    <span class="ts-progress-label">0/${input.checks.length} checked</span>
  </div>
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `troubleshoot-${input.problem.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`,
    type: "text/html",
    title: `Troubleshooting: ${input.problem}`,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}

export function buildSetupGuideArtifact(
  input: SetupGuideInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const steps = input.steps.map((s, i) => `
    <div class="sg-step animate-in" style="animation-delay:${i * 0.08}s" data-idx="${i}">
      <div class="sg-step-left">
        <div class="sg-step-num">${i + 1}</div>
        ${i < input.steps.length - 1 ? '<div class="sg-step-line"></div>' : ""}
      </div>
      <div class="sg-step-content">
        <div class="sg-instruction">${s.instruction}</div>
        ${s.detail ? `<div class="sg-detail">${s.detail}</div>` : ""}
        ${s.warning ? `<div class="sg-warning"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01"/><circle cx="12" cy="12" r="10"/></svg>${s.warning}</div>` : ""}
        <button class="sg-done-btn" onclick="completeStep(${i},this)">
          <svg class="sg-check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          Mark done
        </button>
      </div>
    </div>`).join("");

  const css = `
.sg-step{display:flex;gap:16px}
.sg-step-left{display:flex;flex-direction:column;align-items:center;flex-shrink:0}
.sg-step-num{width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#64748b;transition:all .3s}
.sg-step.done .sg-step-num{background:#16a34a;border-color:#16a34a;color:#fff}
.sg-step-line{width:2px;flex:1;background:#e2e8f0;min-height:20px;transition:background .3s}
.sg-step.done .sg-step-line{background:#16a34a}
.sg-step-content{flex:1;padding-bottom:24px}
.sg-instruction{font-size:14px;font-weight:600;color:#0f172a}
.sg-detail{font-size:13px;color:#64748b;margin-top:4px;line-height:1.5}
.sg-warning{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:#d97706;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:8px 12px;margin-top:8px}
.sg-warning svg{flex-shrink:0;margin-top:1px}
.sg-done-btn{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;transition:all .2s}
.sg-done-btn:hover{border-color:#16a34a;color:#16a34a;background:#f0fdf4}
.sg-step.done .sg-done-btn{background:#16a34a;color:#fff;border-color:#16a34a;pointer-events:none}
.sg-step.done .sg-instruction{color:#16a34a}
.sg-progress-row{display:flex;align-items:center;gap:12px;padding:14px 20px;border-top:1px solid #e2e8f0;background:#f8fafc}
.sg-progress-dots{display:flex;gap:4px}
.sg-dot{width:10px;height:10px;border-radius:50%;background:#e2e8f0;transition:background .3s}
.sg-dot.filled{background:#16a34a}
.sg-progress-text{font-size:12px;font-weight:600;color:#64748b}
`;

  const js = `
function completeStep(i,btn){
  var step=btn.closest('.sg-step');
  step.classList.add('done');
  updateDots();
}
function updateDots(){
  var total=document.querySelectorAll('.sg-step').length;
  var done=document.querySelectorAll('.sg-step.done').length;
  document.querySelectorAll('.sg-dot').forEach(function(d,i){d.classList.toggle('filled',i<done)});
  var t=document.querySelector('.sg-progress-text');
  if(t)t.textContent=done===total?'Setup complete!':done+' of '+total+' steps done';
}
updateDots();
`;

  const dots = input.steps.map(() => `<div class="sg-dot"></div>`).join("");

  const body = `
<div class="card">
  <div class="card-header">
    <div class="subtitle">${input.process.toUpperCase()} Process</div>
    <h2>${input.title}</h2>
  </div>
  <div style="padding:20px">
    ${steps}
  </div>
  <div class="sg-progress-row">
    <div class="sg-progress-dots">${dots}</div>
    <span class="sg-progress-text">0 of ${input.steps.length} steps done</span>
  </div>
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `setup-${input.process}`,
    type: "text/html",
    title: input.title,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}

export function buildSpecsArtifact(
  input: SpecsInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const hasCompare = input.specs.some(s => s.value120v && s.value240v);

  const rows = input.specs.map((s, i) => {
    if (hasCompare && s.value120v && s.value240v) {
      return `
      <div class="spec-row animate-in" style="animation-delay:${i * 0.06}s">
        <div class="spec-label">${s.label}</div>
        <div class="spec-values">
          <div class="spec-val"><span class="volt-badge badge-blue">120V</span>${s.value120v}</div>
          <div class="spec-val"><span class="volt-badge badge-amber">240V</span>${s.value240v}</div>
        </div>
      </div>`;
    }
    return `
    <div class="spec-row animate-in" style="animation-delay:${i * 0.06}s">
      <div class="spec-label">${s.label}</div>
      <div class="spec-single">${s.value120v ?? s.value240v ?? ""}</div>
    </div>`;
  }).join("");

  const css = `
.spec-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 20px;border-bottom:1px solid #f1f5f9}
.spec-row:last-child{border-bottom:none}
.spec-label{font-size:13px;font-weight:600;color:#475569;flex-shrink:0;min-width:140px}
.spec-values{display:flex;gap:16px;flex:1;justify-content:flex-end}
.spec-val{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:#0f172a}
.spec-single{font-size:13px;font-weight:500;color:#0f172a;text-align:right}
.volt-badge{font-size:10px;padding:2px 6px}
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="subtitle">${input.process.toUpperCase()}</div>
    <h2>Specifications</h2>
  </div>
  ${rows}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `specs-${input.process}`,
    type: "text/html",
    title: `${input.process.toUpperCase()} Specifications`,
    content: wrapHtml(body, css),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}

export function buildWeldDiagnosisArtifact(
  input: WeldDiagnosisInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const tabs = input.issues.map((issue, i) => `
    <button class="wd-tab ${i === 0 ? "active" : ""}" onclick="showIssue(${i})">${issue.name}</button>
  `).join("");

  const panels = input.issues.map((issue, i) => {
    const causes = issue.causes.map((c, j) => `
      <div class="wd-cause-row animate-in" style="animation-delay:${j * 0.06}s">
        <div class="wd-cause-num">${j + 1}</div>
        <div class="wd-cause-content">
          <div class="wd-cause-text">${c.cause}</div>
          <div class="wd-fix-text">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
            ${c.fix}
          </div>
        </div>
      </div>`).join("");

    return `
    <div class="wd-panel ${i === 0 ? "active" : ""}" data-panel="${i}">
      <div class="wd-desc">${issue.description}</div>
      ${causes}
    </div>`;
  }).join("");

  const css = `
.wd-tabs{display:flex;gap:4px;padding:12px 20px;border-bottom:1px solid #e2e8f0;overflow-x:auto}
.wd-tab{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;white-space:nowrap;transition:all .15s}
.wd-tab:hover{border-color:#94a3b8}
.wd-tab.active{background:#1e293b;border-color:#1e293b;color:#fff}
.wd-panel{display:none}
.wd-panel.active{display:block}
.wd-desc{padding:14px 20px;font-size:13px;color:#64748b;background:#f8fafc;border-bottom:1px solid #f1f5f9}
.wd-cause-row{display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid #f1f5f9}
.wd-cause-row:last-child{border-bottom:none}
.wd-cause-num{width:24px;height:24px;border-radius:50%;background:#fee2e2;color:#dc2626;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wd-cause-content{flex:1;min-width:0}
.wd-cause-text{font-size:13px;font-weight:600;color:#0f172a}
.wd-fix-text{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:#16a34a;margin-top:4px}
.wd-fix-text svg{flex-shrink:0;margin-top:2px}
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
    <div class="subtitle">${input.weldType} Weld</div>
    <h2>Weld Quality Diagnosis</h2>
  </div>
  <div class="wd-tabs">${tabs}</div>
  ${panels}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `diagnosis-${input.weldType}`,
    type: "text/html",
    title: `${input.weldType} Weld Diagnosis`,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}

export type VisualToolResult = {
  text: string;
  artifact: AntArtifact;
};

export function executeVisualTool(
  name: string,
  input: Record<string, unknown>
): VisualToolResult | null {
  const sourceRefs = parseSourcePagesFromToolInput(input);
  switch (name) {
    case "render_duty_cycle":
      return {
        text: "Duty cycle visualization rendered.",
        artifact: buildDutyCycleArtifact(input as unknown as DutyCycleInput, sourceRefs),
      };
    case "render_polarity_setup":
      return {
        text: "Polarity diagram rendered.",
        artifact: buildPolarityArtifact(input as unknown as PolarityInput, sourceRefs),
      };
    case "render_troubleshooting":
      return {
        text: "Interactive troubleshooting guide rendered.",
        artifact: buildTroubleshootingArtifact(
          input as unknown as TroubleshootingInput,
          sourceRefs
        ),
      };
    case "render_setup_guide":
      return {
        text: "Step-by-step setup guide rendered.",
        artifact: buildSetupGuideArtifact(input as unknown as SetupGuideInput, sourceRefs),
      };
    case "render_specifications":
      return {
        text: "Specifications overview rendered.",
        artifact: buildSpecsArtifact(input as unknown as SpecsInput, sourceRefs),
      };
    case "render_weld_diagnosis":
      return {
        text: "Weld diagnosis guide rendered.",
        artifact: buildWeldDiagnosisArtifact(
          input as unknown as WeldDiagnosisInput,
          sourceRefs
        ),
      };
    default:
      return null;
  }
}
