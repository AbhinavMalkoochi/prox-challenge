import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, escapeHtml, wrapHtml } from "./shared";

export type SettingsPreset = {
  material: string;
  thickness: string;
  process: string;
  voltage: string;
  amperage: string;
  wireSpeed?: string;
  gasFlow?: string;
  gasType?: string;
  electrode?: string;
  notes?: string;
};

export type SettingsAdvisorInput = {
  presets: SettingsPreset[];
};

export function buildSettingsAdvisorArtifact(
  input: SettingsAdvisorInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const presetsJson = JSON.stringify(
    input.presets.map((p) => ({
      mat: p.material,
      thk: p.thickness,
      proc: p.process,
      volt: p.voltage,
      amp: p.amperage,
      ws: p.wireSpeed ?? null,
      gf: p.gasFlow ?? null,
      gt: p.gasType ?? null,
      elec: p.electrode ?? null,
      note: p.notes ?? null,
    }))
  );

  const css = `
.sa-body{padding:18px}
.sa-selectors{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.sa-select{position:relative;flex:1;min-width:120px}
.sa-select label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;margin-bottom:4px}
.sa-select select{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;color:#111827;background:#fff;appearance:none;cursor:pointer;transition:border-color .15s;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.sa-select select:focus{outline:none;border-color:#2563eb}
.sa-result{display:none}
.sa-result.visible{display:block}
.sa-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sa-setting{padding:10px 14px;border:1px solid #f3f4f6;border-radius:8px;background:#f9fafb}
.sa-setting-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af}
.sa-setting-val{font-size:16px;font-weight:700;color:#111827;margin-top:2px}
.sa-note{margin-top:12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1e40af;line-height:1.5}
.sa-empty{text-align:center;padding:32px 18px;color:#9ca3af;font-size:13px}
`;

  const js = `
var presets=${presetsJson};
var matSet=new Set(),thkSet=new Set();
presets.forEach(function(p){matSet.add(p.mat);thkSet.add(p.mat+'|'+p.thk)});

var matEl=document.getElementById('sa-mat');
var thkEl=document.getElementById('sa-thk');

Array.from(matSet).sort().forEach(function(m){
  var o=document.createElement('option');o.value=m;o.textContent=m;matEl.appendChild(o);
});

function updateThk(){
  var mat=matEl.value;
  thkEl.innerHTML='<option value="">Select…</option>';
  var thks=new Set();
  presets.forEach(function(p){if(p.mat===mat)thks.add(p.thk)});
  Array.from(thks).forEach(function(t){
    var o=document.createElement('option');o.value=t;o.textContent=t;thkEl.appendChild(o);
  });
  thkEl.disabled=!mat;
  render();
}

function render(){
  var mat=matEl.value;
  var thk=thkEl.value;
  var box=document.getElementById('sa-result');
  if(!mat||!thk){box.className='sa-result';return}
  var match=presets.filter(function(p){return p.mat===mat&&p.thk===thk});
  if(!match.length){box.innerHTML='<div class="sa-empty">No preset for this combination.</div>';box.className='sa-result visible';return}
  var p=match[0];
  var html='<div class="sa-grid">';
  html+='<div class="sa-setting"><div class="sa-setting-label">Process</div><div class="sa-setting-val">'+esc(p.proc)+'</div></div>';
  html+='<div class="sa-setting"><div class="sa-setting-label">Voltage</div><div class="sa-setting-val">'+esc(p.volt)+'</div></div>';
  html+='<div class="sa-setting"><div class="sa-setting-label">Amperage</div><div class="sa-setting-val">'+esc(p.amp)+'</div></div>';
  if(p.ws)html+='<div class="sa-setting"><div class="sa-setting-label">Wire Speed</div><div class="sa-setting-val">'+esc(p.ws)+'</div></div>';
  if(p.gf)html+='<div class="sa-setting"><div class="sa-setting-label">Gas Flow</div><div class="sa-setting-val">'+esc(p.gf)+'</div></div>';
  if(p.gt)html+='<div class="sa-setting"><div class="sa-setting-label">Gas Type</div><div class="sa-setting-val">'+esc(p.gt)+'</div></div>';
  if(p.elec)html+='<div class="sa-setting"><div class="sa-setting-label">Electrode</div><div class="sa-setting-val">'+esc(p.elec)+'</div></div>';
  html+='</div>';
  if(p.note)html+='<div class="sa-note">'+esc(p.note)+'</div>';
  box.innerHTML=html;
  box.className='sa-result visible fade-in';
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
matEl.addEventListener('change',updateThk);
thkEl.addEventListener('change',render);
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">Recommended Settings</div>
    <h2>Welding Settings Advisor</h2>
  </div>
  <div class="sa-body">
    <div class="sa-selectors">
      <div class="sa-select">
        <label>Material</label>
        <select id="sa-mat"><option value="">Select…</option></select>
      </div>
      <div class="sa-select">
        <label>Thickness</label>
        <select id="sa-thk" disabled><option value="">Select…</option></select>
      </div>
    </div>
    <div class="sa-result" id="sa-result">
      <div class="sa-empty">Choose a material and thickness above.</div>
    </div>
  </div>
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: "settings-advisor",
    type: "text/html",
    title: "Welding Settings Advisor",
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
