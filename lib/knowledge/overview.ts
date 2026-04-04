import { stat } from "node:fs/promises";
import path from "node:path";

import { FILES_DIRECTORY, GENERATED_DIRECTORY, MANUALS } from "@/lib/manuals";

export type ManualOverview = {
  id: string;
  title: string;
  kind: string;
  filename: string;
  sizeLabel: string;
};

export type KnowledgeOverview = {
  manuals: ManualOverview[];
  generatedAssetsReady: boolean;
};

function formatFileSize(sizeInBytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = sizeInBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export async function getKnowledgeOverview(): Promise<KnowledgeOverview> {
  const manuals = await Promise.all(
    MANUALS.map(async (manual) => {
      const manualPath = path.join(process.cwd(), FILES_DIRECTORY, manual.filename);
      const metadata = await stat(manualPath);

      return {
        id: manual.id,
        title: manual.title,
        kind: manual.kind,
        filename: manual.filename,
        sizeLabel: formatFileSize(metadata.size)
      } satisfies ManualOverview;
    })
  );

  let generatedAssetsReady = false;

  try {
    await stat(path.join(process.cwd(), GENERATED_DIRECTORY));
    generatedAssetsReady = true;
  } catch {
    generatedAssetsReady = false;
  }

  return { manuals, generatedAssetsReady };
}
