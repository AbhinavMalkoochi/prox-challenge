import { generateKnowledgeBase, writeKnowledgeBase } from "../lib/knowledge/ingest";

async function main() {
  const knowledgeBase = await generateKnowledgeBase();
  await writeKnowledgeBase(knowledgeBase);

  process.stdout.write(
    `Wrote ${knowledgeBase.pages.length} pages and ${knowledgeBase.chunks.length} chunks to data/manual\n`
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
