export type Citation = {
  manualId: string;
  pageNumber: number;
  excerpt: string;
  title?: string;
};

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

export type WiringDiagramArtifact = {
  type: "wiring_diagram";
  title: string;
  description: string;
  connections: Array<{ from: string; to: string; label: string }>;
  notes: string[];
};

export type ComparisonTableArtifact = {
  type: "comparison_table";
  title: string;
  columns: string[];
  rows: Array<{ label: string; values: string[] }>;
  notes: string[];
};

export type Artifact =
  | PolarityArtifact
  | DutyCycleArtifact
  | TroubleshootingArtifact
  | WiringDiagramArtifact
  | ComparisonTableArtifact;

export type ChatAnswer = {
  mode: "clarify" | "answer";
  answer: string;
  citations: Citation[];
  artifacts: Artifact[];
};

export type ChatRequest = {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ChatStreamEvent =
  | { type: "status"; status: string }
  | { type: "text-delta"; delta: string }
  | { type: "artifact"; artifact: Artifact }
  | { type: "final"; response: ChatAnswer }
  | { type: "error"; error: string }
  | { type: "done" };
