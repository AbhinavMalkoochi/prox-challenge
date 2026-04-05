"use client";

import Link from "next/link";
import type { Artifact } from "@/lib/chat/types";

function listKey(prefix: string, value: string, index: number) {
  return `${prefix}-${index}-${value.slice(0, 20)}`;
}

function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

// ── Polarity Setup (SVG diagram) ────────────────────────────────────────────

function PolarityArtifactView(props: Extract<Artifact, { type: "polarity_setup" }>) {
  const positiveLabel = props.positiveLabel ?? "Positive";
  const negativeLabel = props.negativeLabel ?? "Negative";
  const processLabel = props.processLabel ?? "";
  const notes = safeArray(props.notes);

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Polarity setup</p>
        <h3>{props.title ?? "Polarity Diagram"}</h3>
        {processLabel && <p>{processLabel}</p>}
      </div>

      <svg
        viewBox="0 0 460 200"
        className="polarity-svg"
        role="img"
        aria-label={`Polarity diagram: ${positiveLabel} connects to Positive socket, ${negativeLabel} connects to Negative socket`}
      >
        <rect x="20" y="10" width="420" height="180" rx="12" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1.5" />
        <text x="230" y="36" textAnchor="middle" fontSize="12" fontWeight="600" fill="#6b7280" letterSpacing="0.08em">
          VULCAN OMNIPRO 220
        </text>

        {/* Positive socket */}
        <circle cx="150" cy="105" r="38" fill="#dcfce7" stroke="#16a34a" strokeWidth="2.5" />
        <text x="150" y="100" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#16a34a">+</text>
        <text x="150" y="118" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="500">POSITIVE</text>

        {/* Positive label */}
        <rect x="90" y="155" width="120" height="26" rx="13" fill="#16a34a" />
        <text x="150" y="172" textAnchor="middle" fontSize="11" fontWeight="600" fill="white">
          {positiveLabel.length > 16 ? positiveLabel.slice(0, 14) + "..." : positiveLabel}
        </text>

        {/* Negative socket */}
        <circle cx="310" cy="105" r="38" fill="#dbeafe" stroke="#2563eb" strokeWidth="2.5" />
        <text x="310" y="100" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#2563eb">−</text>
        <text x="310" y="118" textAnchor="middle" fontSize="9" fill="#1d4ed8" fontWeight="500">NEGATIVE</text>

        {/* Negative label */}
        <rect x="250" y="155" width="120" height="26" rx="13" fill="#2563eb" />
        <text x="310" y="172" textAnchor="middle" fontSize="11" fontWeight="600" fill="white">
          {negativeLabel.length > 16 ? negativeLabel.slice(0, 14) + "..." : negativeLabel}
        </text>

        {/* Connection arrows */}
        <line x1="150" y1="143" x2="150" y2="155" stroke="#16a34a" strokeWidth="2" markerEnd="url(#arrowGreen)" />
        <line x1="310" y1="143" x2="310" y2="155" stroke="#2563eb" strokeWidth="2" markerEnd="url(#arrowBlue)" />

        <defs>
          <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#16a34a" />
          </marker>
          <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#2563eb" />
          </marker>
        </defs>
      </svg>

      {notes.length > 0 && (
        <ul className="artifact-points">
          {notes.map((note, i) => (
            <li key={listKey("pn", note, i)}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Duty Cycle ──────────────────────────────────────────────────────────────

function DutyCycleArtifactView(props: Extract<Artifact, { type: "duty_cycle" }>) {
  const current = props.current ?? "—";
  const inputVoltage = props.inputVoltage ?? "—";
  const dutyCycle = props.dutyCycle ?? "—";
  const restWindow = props.restWindow ?? "";
  const notes = safeArray(props.notes);

  const dutyPercent = parseInt(dutyCycle, 10);
  const hasValidPercent = !isNaN(dutyPercent) && dutyPercent >= 0 && dutyPercent <= 100;

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Duty cycle</p>
        <h3>{props.title ?? "Duty Cycle"}</h3>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Current</span>
          <strong>{current}</strong>
        </div>
        <div className="stat-card">
          <span>Input</span>
          <strong>{inputVoltage}</strong>
        </div>
        <div className="stat-card accent">
          <span>Duty cycle</span>
          <strong>{dutyCycle}</strong>
        </div>
      </div>

      {hasValidPercent && (
        <div className="duty-bar-wrap">
          <div className="duty-bar">
            <div className="duty-bar-fill" style={{ width: `${dutyPercent}%` }} />
          </div>
          <div className="duty-bar-labels">
            <span>Weld ({dutyPercent}%)</span>
            <span>Rest ({100 - dutyPercent}%)</span>
          </div>
        </div>
      )}

      {restWindow && <p className="artifact-summary">{restWindow}</p>}
      {notes.length > 0 && (
        <ul className="artifact-points">
          {notes.map((note, i) => (
            <li key={listKey("dn", note, i)}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Troubleshooting ─────────────────────────────────────────────────────────

function TroubleshootingArtifactView(props: Extract<Artifact, { type: "troubleshooting" }>) {
  const symptom = props.symptom ?? "";
  const checks = safeArray(props.checks);

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Troubleshooting</p>
        <h3>{props.title ?? "Diagnostic Checklist"}</h3>
        {symptom && <p className="symptom-badge">{symptom}</p>}
      </div>
      {checks.length > 0 && (
        <div className="check-list">
          {checks.map((check, i) => (
            <div className="check-item" key={listKey("tc", check, i)}>
              <span className="check-number">{i + 1}</span>
              <span>{check}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────

function SettingsArtifactView(props: Extract<Artifact, { type: "settings" }>) {
  const summary = props.summary ?? "";
  const points = safeArray(props.points);

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Setup guide</p>
        <h3>{props.title ?? "Recommended Settings"}</h3>
        {summary && <p>{summary}</p>}
      </div>
      {points.length > 0 && (
        <ul className="artifact-points">
          {points.map((point, i) => (
            <li key={listKey("sp", point, i)}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Wiring Diagram (SVG) ───────────────────────────────────────────────────

function WiringDiagramArtifactView(props: Extract<Artifact, { type: "wiring_diagram" }>) {
  const description = props.description ?? "";
  const connections = Array.isArray(props.connections) ? props.connections : [];
  const notes = safeArray(props.notes);

  const nodeSet = new Set<string>();
  for (const c of connections) {
    if (c?.from) nodeSet.add(String(c.from));
    if (c?.to) nodeSet.add(String(c.to));
  }
  const nodes = [...nodeSet];
  const nodeHeight = 44;
  const svgHeight = Math.max(120, nodes.length * (nodeHeight + 16) + 40);

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Wiring diagram</p>
        <h3>{props.title ?? "Connection Diagram"}</h3>
        {description && <p>{description}</p>}
      </div>

      {nodes.length > 0 && (
        <svg viewBox={`0 0 460 ${svgHeight}`} className="wiring-svg" role="img" aria-label="Wiring diagram">
          {nodes.map((node, i) => {
            const y = 20 + i * (nodeHeight + 16);
            return (
              <g key={node}>
                <rect x="20" y={y} width="180" height={nodeHeight} rx="8" fill="#f0f9ff" stroke="#93c5fd" strokeWidth="1.5" />
                <text x="110" y={y + nodeHeight / 2 + 5} textAnchor="middle" fontSize="12" fontWeight="500" fill="#1e40af">
                  {node.length > 24 ? node.slice(0, 22) + "..." : node}
                </text>
              </g>
            );
          })}
          {connections.map((conn, i) => {
            if (!conn?.from || !conn?.to) return null;
            const fromIdx = nodes.indexOf(String(conn.from));
            const toIdx = nodes.indexOf(String(conn.to));
            if (fromIdx < 0 || toIdx < 0) return null;
            const fromY = 20 + fromIdx * (nodeHeight + 16) + nodeHeight / 2;
            const toY = 20 + toIdx * (nodeHeight + 16) + nodeHeight / 2;
            return (
              <g key={`conn-${i}`}>
                <path
                  d={`M200,${fromY} C280,${fromY} 280,${toY} 360,${toY}`}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  markerEnd="url(#arrowPurple)"
                />
                {conn.label && (
                  <text x="280" y={(fromY + toY) / 2 - 6} textAnchor="middle" fontSize="10" fill="#6366f1" fontWeight="500">
                    {String(conn.label)}
                  </text>
                )}
              </g>
            );
          })}
          <defs>
            <marker id="arrowPurple" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
            </marker>
          </defs>
        </svg>
      )}

      {notes.length > 0 && (
        <ul className="artifact-points">
          {notes.map((note, i) => (
            <li key={listKey("wn", note, i)}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page Reference ──────────────────────────────────────────────────────────

function PageReferenceArtifactView(props: Extract<Artifact, { type: "page_reference" }>) {
  const description = props.description ?? "";
  const callouts = safeArray(props.callouts);
  const manualId = props.manualId ?? "owner-manual";
  const pageNumber = props.pageNumber ?? 1;

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Manual reference</p>
        <h3>{props.title ?? "Page Reference"}</h3>
        {description && <p>{description}</p>}
      </div>
      {callouts.length > 0 && (
        <div className="page-ref-callouts">
          {callouts.map((callout, i) => (
            <div className="page-ref-callout" key={listKey("pc", callout, i)}>
              {callout}
            </div>
          ))}
        </div>
      )}
      <Link className="page-ref-link" href={`/source/${manualId}/${pageNumber}`} target="_blank">
        View page {pageNumber} →
      </Link>
    </div>
  );
}

// ── Comparison Table ────────────────────────────────────────────────────────

function ComparisonTableArtifactView(props: Extract<Artifact, { type: "comparison_table" }>) {
  const columns = safeArray(props.columns);
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const notes = safeArray(props.notes);

  if (columns.length === 0 && rows.length === 0) return null;

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Comparison</p>
        <h3>{props.title ?? "Comparison Table"}</h3>
      </div>
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th />
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={listKey("cr", row?.label ?? String(i), i)}>
                <td><strong>{row?.label ?? ""}</strong></td>
                {safeArray(row?.values).map((val, j) => (
                  <td key={`${row?.label}-${j}`}>{val}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes.length > 0 && (
        <ul className="artifact-points">
          {notes.map((note, i) => (
            <li key={listKey("cn", note, i)}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Process Selector ────────────────────────────────────────────────────────

function ProcessSelectorArtifactView(props: Extract<Artifact, { type: "process_selector" }>) {
  const description = props.description ?? "";
  const options = Array.isArray(props.options) ? props.options : [];

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Process selector</p>
        <h3>{props.title ?? "Process Guide"}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="process-options">
        {options.map((opt, i) => (
          <div className="process-option" key={listKey("ps", opt?.process ?? String(i), i)}>
            <h4>{opt?.process ?? "Unknown"}</h4>
            {opt?.bestFor && <p>{opt.bestFor}</p>}
            {safeArray(opt?.keySettings).length > 0 && (
              <div className="process-option-settings">
                {safeArray(opt.keySettings).map((setting, j) => (
                  <span key={`${opt?.process}-${j}`}>{setting}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Parts Reference ─────────────────────────────────────────────────────────

function PartsReferenceArtifactView(props: Extract<Artifact, { type: "parts_reference" }>) {
  const description = props.description ?? "";
  const parts = Array.isArray(props.parts) ? props.parts : [];

  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Parts reference</p>
        <h3>{props.title ?? "Parts List"}</h3>
        {description && <p>{description}</p>}
      </div>
      {parts.length > 0 && (
        <div className="parts-list">
          {parts.map((part, i) => (
            <div className="part-row" key={listKey("pr", part?.number ?? String(i), i)}>
              <span className="part-number">{part?.number ?? "—"}</span>
              <span className="part-name">{part?.name ?? "—"}</span>
              <span className="part-desc">{part?.description ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

export function ArtifactPanel({
  artifact,
  showEmptyState = true,
}: {
  artifact: Artifact | null;
  showEmptyState?: boolean;
}) {
  if (!artifact) {
    if (!showEmptyState) return null;
    return (
      <div className="artifact-card">
        <div className="artifact-header">
          <p className="eyebrow">Artifact</p>
          <h3>No visual artifact yet</h3>
          <p>When the answer benefits from a diagram, duty-cycle card, or troubleshooting flow, it will appear here.</p>
        </div>
      </div>
    );
  }

  switch (artifact.type) {
    case "polarity_setup":
      return <PolarityArtifactView {...artifact} />;
    case "duty_cycle":
      return <DutyCycleArtifactView {...artifact} />;
    case "troubleshooting":
      return <TroubleshootingArtifactView {...artifact} />;
    case "settings":
      return <SettingsArtifactView {...artifact} />;
    case "wiring_diagram":
      return <WiringDiagramArtifactView {...artifact} />;
    case "page_reference":
      return <PageReferenceArtifactView {...artifact} />;
    case "comparison_table":
      return <ComparisonTableArtifactView {...artifact} />;
    case "process_selector":
      return <ProcessSelectorArtifactView {...artifact} />;
    case "parts_reference":
      return <PartsReferenceArtifactView {...artifact} />;
    default:
      return null;
  }
}
