import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, escapeHtml, wrapHtml } from "./shared";

export type SetupStep = {
  instruction: string;
  detail?: string;
  warning?: string;
};

export type SetupGuideInput = {
  process: string;
  title: string;
  steps: SetupStep[];
};

export function buildSetupGuideArtifact(
  input: SetupGuideInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const total = input.steps.length;

  const stepsHtml = input.steps
    .map((s, i) => {
      const warn = s.warning
        ? `<div class="sg-warn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>${escapeHtml(s.warning)}</div>`
        : "";
      const detail = s.detail
        ? `<p class="sg-detail">${escapeHtml(s.detail)}</p>`
        : "";
      return `
    <div class="sg-step fade-in" data-i="${i}" style="animation-delay:${i * 0.05}s" onclick="toggleStep(${i})">
      <div class="sg-check" id="chk${i}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="sg-body">
        <span class="sg-num">Step ${i + 1}</span>
        <p class="sg-instr">${escapeHtml(s.instruction)}</p>
        ${detail}${warn}
      </div>
    </div>`;
    })
    .join("");

  const css = `
.sg-progress{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid #e5e7eb}
.sg-progress-dots{display:flex;gap:4px}
.sg-dot{width:8px;height:8px;border-radius:50%;background:#e5e7eb;transition:background .2s}
.sg-dot.done{background:#16a34a}
.sg-status{font-size:11px;color:#6b7280;font-weight:600}
.sg-step{display:flex;gap:12px;padding:12px 18px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s}
.sg-step:last-child{border-bottom:none}
.sg-step:hover{background:#f9fafb}
.sg-step.completed{opacity:.55}
.sg-step.completed .sg-instr{text-decoration:line-through}
.sg-check{width:22px;height:22px;border-radius:6px;border:1.5px solid #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .2s;color:transparent}
.sg-step.completed .sg-check{background:#16a34a;border-color:#16a34a;color:#fff}
.sg-num{font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.sg-instr{font-size:13px;font-weight:600;color:#111827;margin-top:2px;transition:all .15s}
.sg-detail{font-size:12px;color:#6b7280;margin-top:3px;line-height:1.5}
.sg-warn{display:flex;align-items:flex-start;gap:5px;margin-top:5px;font-size:11px;color:#d97706;line-height:1.4}
.sg-warn svg{flex-shrink:0;margin-top:1px}
`;

  const js = `
var done=new Set();
var total=${total};
function toggleStep(i){
  if(done.has(i)){done.delete(i)}else{done.add(i)}
  update();
}
function update(){
  for(var i=0;i<total;i++){
    var el=document.querySelectorAll('.sg-step')[i];
    if(done.has(i)){el.classList.add('completed')}else{el.classList.remove('completed')}
  }
  document.querySelectorAll('.sg-dot').forEach(function(d,idx){
    d.classList.toggle('done',done.has(idx));
  });
  document.getElementById('sg-count').textContent=done.size+' of '+total+' steps done';
}
`;

  const dots = input.steps.map((_, i) => `<span class="sg-dot" data-i="${i}"></span>`).join("");

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">${escapeHtml(input.process.toUpperCase())} Process</div>
    <h2>${escapeHtml(input.title)}</h2>
  </div>
  <div class="sg-progress">
    <div class="sg-progress-dots">${dots}</div>
    <span class="sg-status" id="sg-count">0 of ${total} steps done</span>
  </div>
  ${stepsHtml}
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `setup-${input.process}`,
    type: "text/html",
    title: input.title,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
