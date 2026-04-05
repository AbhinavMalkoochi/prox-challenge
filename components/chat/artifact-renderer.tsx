"use client";

import { useEffect, useRef, useState } from "react";
import type { AntArtifact } from "@/lib/chat/types";

// ── Iframe: shared auto-resizing renderer ───────────────────────────────────

function IframeRenderer({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (
        e.data?.type === "artifact-resize" &&
        e.source === ref.current?.contentWindow
      ) {
        const h = Number(e.data.height);
        if (!Number.isFinite(h) || h <= 0) return;
        setHeight(Math.min(Math.max(h + 16, 100), 900));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const resizeScript = `<script>
    function _report(){var h=document.body.scrollHeight;if(h>0)window.parent.postMessage({type:"artifact-resize",height:h},"*")}
    new ResizeObserver(_report).observe(document.body);
    window.addEventListener("load",_report);
    setTimeout(_report,500);
  <\/script>`;

  return (
    <iframe
      ref={ref}
      className="artifact-iframe"
      srcDoc={html + resizeScript}
      title={title}
      sandbox="allow-scripts"
      style={{ height }}
    />
  );
}

// ── SVG: sandboxed iframe ────────────────────────────────────────────────────

function SvgRenderer({ content, title }: { content: string; title: string }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:8px;display:flex;justify-content:center;background:transparent}svg{max-width:100%;height:auto}</style></head><body>${content}</body></html>`;
  return <IframeRenderer html={html} title={title} />;
}

// ── Mermaid renderer ─────────────────────────────────────────────────────────

function MermaidRenderer({ content, title }: { content: string; title: string }) {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js"></script>
<style>
  body{margin:0;padding:16px;background:transparent;font-family:system-ui,-apple-system,sans-serif}
  .mermaid{display:flex;justify-content:center}
</style>
</head><body>
<pre class="mermaid">${escaped}</pre>
<script>mermaid.initialize({startOnLoad:true,theme:"default",flowchart:{curve:"basis"}})</script>
</body></html>`;

  return <IframeRenderer html={html} title={title} />;
}

// ── React renderer ──────────────────────────────────────────────────────────

function ReactRenderer({ content, title }: { content: string; title: string }) {
  const safeContent = content.replace(/<\/script>/gi, "<\\/script>");
  const code = JSON.stringify(safeContent);

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"><\/script>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.15.3/Recharts.min.js"><\/script>
<script src="https://unpkg.com/lucide-react@0.468.0/dist/umd/lucide-react.min.js"><\/script>
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif}</style>
</head><body>
<div id="root"></div>
<script>
try{
  var exports={};var module={exports:exports};
  var code=${code};
  code=code.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]react['"]/g,
    'var {$1}=React');
  code=code.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]recharts['"]/g,
    'var {$1}=window.Recharts||{}');
  code=code.replace(/import\\s+\\{([^}]+)\\}\\s+from\\s+['"]lucide-react['"]/g,
    'var {$1}=window.lucideReact||{}');
  code=code.replace(/import\\s+React\\b[^;]*/g,'');
  code=code.replace(/export\\s+default\\s+/g,'exports.default=');
  var transformed=Babel.transform(code,{presets:['react'],plugins:[]}).code;
  new Function('React','exports','module',transformed)(React,exports,module);
  var C=exports.default||Object.values(exports).find(function(v){return typeof v==='function'});
  if(C)ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(C));
  else document.getElementById('root').innerHTML='<p style="padding:16px;color:#6b7280">No component exported</p>';
}catch(e){
  var msg=String(e.message||'Unknown error').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  document.getElementById('root').innerHTML='<pre style="color:#dc2626;padding:16px;font-size:13px;white-space:pre-wrap">'+msg+'</pre>';
}
<\/script>
</body></html>`;

  return <IframeRenderer html={html} title={title} />;
}

// ── HTML renderer ───────────────────────────────────────────────────────────

function HtmlRenderer({ content, title }: { content: string; title: string }) {
  return <IframeRenderer html={content} title={title} />;
}

// ── Code renderer ───────────────────────────────────────────────────────────

function CodeRenderer({ content }: { content: string }) {
  return (
    <pre className="artifact-code">
      <code>{content}</code>
    </pre>
  );
}

// ── Type label ──────────────────────────────────────────────────────────────

function typeLabel(type: string): string {
  switch (type) {
    case "image/svg+xml":
      return "Diagram";
    case "application/vnd.ant.mermaid":
      return "Flowchart";
    case "application/vnd.ant.react":
      return "Interactive";
    case "text/html":
      return "Visual";
    case "application/vnd.ant.code":
      return "Code";
    case "text/markdown":
      return "Document";
    default:
      return "Artifact";
  }
}

// ── Main export ─────────────────────────────────────────────────────────────

export function ArtifactRenderer({ artifact }: { artifact: AntArtifact }) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">{typeLabel(artifact.type)}</p>
        <h3>{artifact.title}</h3>
      </div>
      <div className="artifact-body">
        <ArtifactContent artifact={artifact} />
      </div>
    </div>
  );
}

function MarkdownRenderer({ content, title }: { content: string; title: string }) {
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"><\/script>
<style>body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;line-height:1.7;font-size:14px}
h1,h2,h3{margin:0.5em 0 0.3em;color:#0f172a}
code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px}
pre{background:#f1f5f9;padding:12px;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}
th{background:#f8fafc;font-weight:600}
blockquote{border-left:3px solid #3b82f6;margin:8px 0;padding:4px 16px;color:#475569;background:#f8fafc}
ul,ol{padding-left:1.5em}
li{margin:4px 0}
</style></head><body>
<div id="md"></div>
<script>document.getElementById('md').innerHTML=marked.parse(${JSON.stringify(content)})<\/script>
</body></html>`;

  return <IframeRenderer html={html} title={title} />;
}

function ArtifactContent({ artifact }: { artifact: AntArtifact }) {
  switch (artifact.type) {
    case "image/svg+xml":
      return <SvgRenderer content={artifact.content} title={artifact.title} />;
    case "application/vnd.ant.mermaid":
      return <MermaidRenderer content={artifact.content} title={artifact.title} />;
    case "application/vnd.ant.react":
      return <ReactRenderer content={artifact.content} title={artifact.title} />;
    case "text/html":
      return <HtmlRenderer content={artifact.content} title={artifact.title} />;
    case "text/markdown":
      return <MarkdownRenderer content={artifact.content} title={artifact.title} />;
    default:
      return <CodeRenderer content={artifact.content} />;
  }
}
