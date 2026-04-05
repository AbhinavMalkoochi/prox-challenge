export type Citation = {
  manualId: string;
  pageNumber: number;
  excerpt: string;
  title?: string;
};

export type ArtifactIntent =
  | "none"
  | "polarity_setup"
  | "duty_cycle"
  | "troubleshooting"
  | "settings"
  | "wiring_diagram"
  | "page_reference"
  | "comparison_table"
  | "process_selector"
  | "parts_reference";

export type PolarityArtifact = {
  type: "polarity_setup";
  title: string;
  processLabel: string;
  positiveLabel: string;
  negativeLabel: string;
  notes: string[];
};

export type DutyCycleArtifact = {
  type: "duty_cycle";
  title: string;
  current: string;
  inputVoltage: string;
  dutyCycle: string;
  restWindow: string;
  notes: string[];
};

export type TroubleshootingArtifact = {
  type: "troubleshooting";
  title: string;
  symptom: string;
  checks: string[];
};

export type SettingsArtifact = {
  type: "settings";
  title: string;
  summary: string;
  points: string[];
};

export type WiringDiagramArtifact = {
  type: "wiring_diagram";
  title: string;
  description: string;
  connections: Array<{
    from: string;
    to: string;
    label: string;
  }>;
  notes: string[];
};

export type PageReferenceArtifact = {
  type: "page_reference";
  title: string;
  manualId: string;
  pageNumber: number;
  description: string;
  callouts: string[];
};

export type ComparisonTableArtifact = {
  type: "comparison_table";
  title: string;
  columns: string[];
  rows: Array<{
    label: string;
    values: string[];
  }>;
  notes: string[];
};

export type ProcessSelectorArtifact = {
  type: "process_selector";
  title: string;
  description: string;
  options: Array<{
    process: string;
    bestFor: string;
    keySettings: string[];
  }>;
};

export type PartsReferenceArtifact = {
  type: "parts_reference";
  title: string;
  description: string;
  parts: Array<{
    number: string;
    name: string;
    description: string;
  }>;
};

export type Artifact =
  | PolarityArtifact
  | DutyCycleArtifact
  | TroubleshootingArtifact
  | SettingsArtifact
  | WiringDiagramArtifact
  | PageReferenceArtifact
  | ComparisonTableArtifact
  | ProcessSelectorArtifact
  | PartsReferenceArtifact;

export type ChatAnswer = {
  mode: "clarify" | "answer";
  answer: string;
  citations: Citation[];
  artifacts: Artifact[];
};

export type ChatRequest = {
  question: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export type ChatStreamEvent =
  | { type: "status"; status: string }
  | { type: "text-delta"; delta: string }
  | { type: "artifact"; artifact: Artifact }
  | { type: "final"; response: ChatAnswer }
  | { type: "error"; error: string }
  | { type: "done" };
