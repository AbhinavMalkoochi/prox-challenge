"use client";

import { useEffect, useRef, useState } from "react";
import type { AntArtifact } from "@/lib/chat/types";

// ── SVG: render directly, no iframe ──────────────────────────────────────────

function SvgRenderer({ content }: { content: string }) {
  return (
    <div
      className="artifact-svg-container"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}

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
        setHeight(Math.min(Math.max(e.data.height + 16, 100), 900));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const resizeScript = `<script>
    function _report(){window.parent.postMessage({type:"artifact-resize",height:document.body.scrollHeight},"*")}
    new ResizeObserver(_report).observe(document.body);
    window.addEventListener("load",_report);
    setTimeout(_report,500);
  </script>`;

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
  const code = JSON.stringify(content);

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
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
  document.getElementById('root').innerHTML='<pre style="color:#dc2626;padding:16px;font-size:13px;white-space:pre-wrap">'+e.message+'</pre>';
}
</script>
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

function ArtifactContent({ artifact }: { artifact: AntArtifact }) {
  switch (artifact.type) {
    case "image/svg+xml":
      return <SvgRenderer content={artifact.content} />;
    case "application/vnd.ant.mermaid":
      return <MermaidRenderer content={artifact.content} title={artifact.title} />;
    case "application/vnd.ant.react":
      return <ReactRenderer content={artifact.content} title={artifact.title} />;
    case "text/html":
      return <HtmlRenderer content={artifact.content} title={artifact.title} />;
    default:
      return <CodeRenderer content={artifact.content} />;
  }
}
