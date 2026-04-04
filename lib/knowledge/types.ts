export type SourceKind = "text" | "diagram" | "table" | "photo" | "chart";

export type ManualManifestRecord = {
  id: string;
  title: string;
  filename: string;
  kind: string;
  priority: number;
  pageCount: number;
};

export type ManualTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ManualLine = {
  text: string;
  itemIndexes: number[];
  y: number;
  x: number;
  width: number;
  height: number;
};

export type ManualPage = {
  manualId: string;
  pageNumber: number;
  width: number;
  height: number;
  title: string;
  text: string;
  items: ManualTextItem[];
  lines: ManualLine[];
  sourceKind: SourceKind;
};

export type ManualChunk = {
  id: string;
  manualId: string;
  manualTitle: string;
  manualKind: string;
  pageNumber: number;
  title: string;
  text: string;
  normalizedText: string;
  keywordHints: string[];
  sourceKind: SourceKind;
};

export type ManualKnowledgeBase = {
  generatedAt: string;
  manifest: ManualManifestRecord[];
  pages: ManualPage[];
  chunks: ManualChunk[];
};
