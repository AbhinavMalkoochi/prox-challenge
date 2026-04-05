"use client";

import Link from "next/link";
import type { Artifact } from "@/lib/chat/types";

function listKey(prefix: string, value: string, index: number) {
  return `${prefix}-${index}-${value.slice(0, 20)}`;
}

function PolarityArtifactView({
  positiveLabel,
  negativeLabel,
  notes,
  processLabel,
  title,
}: Extract<Artifact, { type: "polarity_setup" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Polarity setup</p>
        <h3>{title}</h3>
        <p>{processLabel}</p>
      </div>
      <div className="polarity-diagram">
        <div className="socket positive">
          <span>Positive (+)</span>
          <strong>{positiveLabel}</strong>
        </div>
        <div className="socket negative">
          <span>Negative (−)</span>
          <strong>{negativeLabel}</strong>
        </div>
      </div>
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

function DutyCycleArtifactView({
  current,
  dutyCycle,
  inputVoltage,
  notes,
  restWindow,
  title,
}: Extract<Artifact, { type: "duty_cycle" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Duty cycle</p>
        <h3>{title}</h3>
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
        <div className="stat-card">
          <span>Duty cycle</span>
          <strong>{dutyCycle}</strong>
        </div>
      </div>
      <p className="artifact-summary">{restWindow}</p>
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

function TroubleshootingArtifactView({
  checks,
  symptom,
  title,
}: Extract<Artifact, { type: "troubleshooting" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Troubleshooting</p>
        <h3>{title}</h3>
        <p>{symptom}</p>
      </div>
      <ol className="artifact-steps">
        {checks.map((check, i) => (
          <li key={listKey("tc", check, i)}>{check}</li>
        ))}
      </ol>
    </div>
  );
}

function SettingsArtifactView({
  points,
  summary,
  title,
}: Extract<Artifact, { type: "settings" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Setup guide</p>
        <h3>{title}</h3>
        <p>{summary}</p>
      </div>
      <ul className="artifact-points">
        {points.map((point, i) => (
          <li key={listKey("sp", point, i)}>{point}</li>
        ))}
      </ul>
    </div>
  );
}

function WiringDiagramArtifactView({
  title,
  description,
  connections,
  notes,
}: Extract<Artifact, { type: "wiring_diagram" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Wiring diagram</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="connections-list">
        {connections.map((conn, i) => (
          <div className="connection-row" key={listKey("wd", conn.from, i)}>
            <strong>{conn.from}</strong>
            <span className="connection-arrow">→</span>
            <strong>{conn.to}</strong>
            <span className="connection-label">{conn.label}</span>
          </div>
        ))}
      </div>
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

function PageReferenceArtifactView({
  title,
  manualId,
  pageNumber,
  description,
  callouts,
}: Extract<Artifact, { type: "page_reference" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Manual reference</p>
        <h3>{title}</h3>
        <p>{description}</p>
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
      <Link
        className="page-ref-link"
        href={`/source/${manualId}/${pageNumber}`}
        target="_blank"
      >
        View page {pageNumber} →
      </Link>
    </div>
  );
}

function ComparisonTableArtifactView({
  title,
  columns,
  rows,
  notes,
}: Extract<Artifact, { type: "comparison_table" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Comparison</p>
        <h3>{title}</h3>
      </div>
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
            <tr key={listKey("cr", row.label, i)}>
              <td>
                <strong>{row.label}</strong>
              </td>
              {row.values.map((val, j) => (
                <td key={`${row.label}-${j}`}>{val}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

function ProcessSelectorArtifactView({
  title,
  description,
  options,
}: Extract<Artifact, { type: "process_selector" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Process selector</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="process-options">
        {options.map((opt, i) => (
          <div className="process-option" key={listKey("ps", opt.process, i)}>
            <h4>{opt.process}</h4>
            <p>{opt.bestFor}</p>
            {opt.keySettings.length > 0 && (
              <div className="process-option-settings">
                {opt.keySettings.map((setting, j) => (
                  <span key={`${opt.process}-${j}`}>{setting}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PartsReferenceArtifactView({
  title,
  description,
  parts,
}: Extract<Artifact, { type: "parts_reference" }>) {
  return (
    <div className="artifact-card">
      <div className="artifact-header">
        <p className="eyebrow">Parts reference</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="parts-list">
        {parts.map((part, i) => (
          <div className="part-row" key={listKey("pr", part.number, i)}>
            <span className="part-number">{part.number}</span>
            <span className="part-name">{part.name}</span>
            <span className="part-desc">{part.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <p>
            When the answer benefits from a diagram, duty-cycle card, or
            troubleshooting flow, it will appear here.
          </p>
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
