export type ManualDefinition = {
  id: "owner-manual" | "quick-start-guide" | "selection-chart";
  title: string;
  filename: string;
  kind: "manual" | "guide" | "chart";
  priority: number;
};

export const MANUALS: ManualDefinition[] = [
  {
    id: "owner-manual",
    title: "Owner's Manual & Safety Instructions",
    filename: "owner-manual.pdf",
    kind: "manual",
    priority: 1
  },
  {
    id: "quick-start-guide",
    title: "Quick Start Guide",
    filename: "quick-start-guide.pdf",
    kind: "guide",
    priority: 2
  },
  {
    id: "selection-chart",
    title: "Process Selection Chart",
    filename: "selection-chart.pdf",
    kind: "chart",
    priority: 3
  }
];

export const FILES_DIRECTORY = "files";
export const GENERATED_DIRECTORY = "data/manual";
