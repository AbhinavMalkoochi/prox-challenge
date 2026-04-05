export type Citation = {
  manualId: string;
  pageNumber: number;
  excerpt: string;
  title?: string;
  pageTitle?: string;
  sourceKind?: string;
};

export type AntArtifact = {
  identifier: string;
  type: string;
  title: string;
  language?: string;
  content: string;
};

export type ChatAnswer = {
  mode: "clarify" | "answer";
  answer: string;
  citations: Citation[];
  artifacts: AntArtifact[];
};

export type ChatRequest = {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ChatStreamEvent =
  | { type: "status"; status: string }
  | { type: "text-delta"; delta: string }
  | { type: "artifact"; artifact: AntArtifact }
  | { type: "final"; response: ChatAnswer }
  | { type: "error"; error: string }
  | { type: "done" };
