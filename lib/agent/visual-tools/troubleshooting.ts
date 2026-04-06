import type { AntArtifact, ArtifactSourceRef } from "@/lib/chat/types";
import { buildSourceFooter, escapeHtml, wrapHtml } from "./shared";

export type TroubleshootingNode = {
  id: string;
  question: string;
  yes?: string; // id of next node
  no?: string;  // id of next node
  solution?: string; // leaf node — shows a fix
};

export type TroubleshootingInput = {
  problem: string;
  nodes: TroubleshootingNode[];
};

/** Legacy checklist format — still accepted from the model */
export type TroubleshootingChecklistInput = {
  problem: string;
  checks: { cause: string; solution: string }[];
};

/**
 * Convert legacy flat checklist into a linear decision tree so the new
 * interactive renderer can handle it seamlessly.
 */
function checklistToNodes(
  checks: { cause: string; solution: string }[]
): TroubleshootingNode[] {
  const nodes: TroubleshootingNode[] = [];
  for (let i = 0; i < checks.length; i++) {
    const c = checks[i];
    const nodeId = `n${i}`;
    const solutionId = `s${i}`;
    const nextId = i < checks.length - 1 ? `n${i + 1}` : undefined;

    // Decision node: "Could it be <cause>?"
    nodes.push({
      id: nodeId,
      question: c.cause.endsWith("?") ? c.cause : `Is the issue: ${c.cause}?`,
      yes: solutionId,
      no: nextId,
      ...(nextId === undefined && !c.solution ? { solution: "No matching cause found. Contact support." } : {}),
    });
    // Solution leaf
    nodes.push({ id: solutionId, question: c.cause, solution: c.solution });
  }
  return nodes;
}

/** Accept both node-tree and flat-checklist input shapes. */
export function buildTroubleshootingArtifact(
  input: TroubleshootingInput | TroubleshootingChecklistInput,
  sourceRefs: ArtifactSourceRef[] = []
): AntArtifact {
  const nodes: TroubleshootingNode[] =
    "nodes" in input ? input.nodes : checklistToNodes(input.checks);

  const nodesJson = JSON.stringify(
    nodes.map((n) => ({
      id: n.id,
      q: n.question,
      y: n.yes ?? null,
      n: n.no ?? null,
      s: n.solution ?? null,
    }))
  );

  const css = `
.ts-body{padding:18px}
.ts-breadcrumb{display:flex;flex-wrap:wrap;gap:4px;padding:0 18px 8px;font-size:11px;color:#9ca3af}
.ts-crumb{cursor:pointer;color:#6b7280;transition:color .15s}
.ts-crumb:hover{color:#2563eb}
.ts-crumb.current{color:#111827;font-weight:600}
.ts-crumb+.ts-crumb::before{content:'›';margin-right:4px;color:#d1d5db}
.ts-question{font-size:14px;font-weight:600;color:#111827;margin-bottom:16px;line-height:1.5}
.ts-btns{display:flex;gap:8px}
.ts-btn{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;background:#fff;transition:all .15s}
.ts-btn:hover{border-color:#9ca3af}
.ts-btn.yes{color:#16a34a}
.ts-btn.yes:hover{background:rgba(22,163,74,.04)}
.ts-btn.no{color:#dc2626}
.ts-btn.no:hover{background:rgba(220,38,38,.04)}
.ts-solution{padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:13px;line-height:1.6;color:#15803d}
.ts-solution h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#16a34a;margin-bottom:6px;font-weight:700}
.ts-restart{margin-top:12px;padding:8px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;font-weight:600;background:#fff;color:#6b7280;transition:all .15s}
.ts-restart:hover{border-color:#9ca3af;color:#111827}
.ts-dead-end{padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;line-height:1.6}
`;

  const js = `
var nodes=${nodesJson};
var nodeMap={};nodes.forEach(function(n){nodeMap[n.id]=n});
var history=[];
var startId=nodes[0].id;

function render(){
  var cur=history.length?history[history.length-1]:startId;
  var node=nodeMap[cur];
  if(!node){document.getElementById('ts-root').innerHTML='<p>Error: node not found.</p>';return}

  // breadcrumb
  var bc='<div class="ts-breadcrumb">'+[startId].concat(history).map(function(id,idx){
    var n=nodeMap[id];if(!n)return'';
    var label=n.q.length>30?n.q.slice(0,30)+'…':n.q;
    var cls=idx===history.length?'ts-crumb current':'ts-crumb';
    return '<span class="'+cls+'" onclick="goTo('+idx+')">'+label+'</span>';
  }).join('')+'</div>';

  var body='';
  if(node.s){
    body='<div class="ts-body"><div class="ts-solution"><h3>Solution Found</h3>'+esc(node.s)+'</div><button class="ts-restart" onclick="restart()">Start Over</button></div>';
  } else if(!node.y&&!node.n){
    body='<div class="ts-body"><div class="ts-dead-end">No further steps — if the problem persists, consult the full troubleshooting table in the manual.</div><button class="ts-restart" onclick="restart()">Start Over</button></div>';
  } else {
    body='<div class="ts-body"><p class="ts-question">'+esc(node.q)+'</p><div class="ts-btns">'
      +(node.y?'<button class="ts-btn yes" onclick="go(\\''+node.y+'\\')">Yes</button>':'')
      +(node.n?'<button class="ts-btn no" onclick="go(\\''+node.n+'\\')">No</button>':'')
      +'</div></div>';
  }

  document.getElementById('ts-root').innerHTML=bc+body;
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function go(id){history.push(id);render()}
function goTo(idx){history=history.slice(0,idx);render()}
function restart(){history=[];render()}
render();
`;

  const body = `
<div class="card">
  <div class="card-header">
    <div class="sub">Interactive Troubleshooter</div>
    <h2>${escapeHtml(input.problem)}</h2>
  </div>
  <div id="ts-root"></div>
</div>${buildSourceFooter(sourceRefs)}`;

  return {
    identifier: `troubleshoot-${input.problem.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}`,
    type: "text/html",
    title: `Troubleshoot: ${input.problem}`,
    content: wrapHtml(body, css, js),
    sourceRefs: sourceRefs.length ? sourceRefs : undefined,
  };
}
