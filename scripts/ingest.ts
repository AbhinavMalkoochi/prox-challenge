import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getKnowledgeOverview } from "../lib/knowledge/overview";

async function main() {
  const overview = await getKnowledgeOverview();
  const outputDirectory = path.join(process.cwd(), "data", "manual");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "overview.json"),
    `${JSON.stringify(overview, null, 2)}\n`,
    "utf8"
  );

  process.stdout.write(
    `Wrote ${overview.manuals.length} manual definitions to data/manual/overview.json\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Manual ingestion bootstrap failed: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exitCode = 1;
});
