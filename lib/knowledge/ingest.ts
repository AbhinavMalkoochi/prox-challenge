import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

import { FILES_DIRECTORY, GENERATED_DIRECTORY, MANUALS } from "@/lib/manuals";
import type {
  ManualChunk,
  ManualKnowledgeBase,
  ManualLine,
  ManualPage,
  ManualTextItem
} from "@/lib/knowledge/types";

GlobalWorkerOptions.workerSrc = new URL(
  "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSearchText(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function deriveSourceKind(text: string, manualKind: string): ManualPage["sourceKind"] {
  const normalized = normalizeSearchText(text);

  if (manualKind === "chart" || normalized.includes("selection chart")) {
    return "chart";
  }

  if (normalized.includes("troubleshooting") || normalized.includes("diagnosis")) {
    return "photo";
  }

  if (normalized.includes("diagram") || normalized.includes("polarity")) {
    return "diagram";
  }

  if (normalized.includes("table") || normalized.includes("duty cycle")) {
    return "table";
  }

  return "text";
}

function buildLineText(items: ManualTextItem[]): string {
  if (items.length === 0) {
    return "";
  }

  const sortedItems = [...items].sort((left, right) => left.x - right.x);
  let text = "";
  let previousRightEdge = sortedItems[0].x;

  for (const item of sortedItems) {
    const gap = item.x - previousRightEdge;
    const needsSpace = text.length > 0 && gap > Math.max(item.height * 0.2, 2);

    text += `${needsSpace ? " " : ""}${item.text}`;
    previousRightEdge = item.x + item.width;
  }

  return normalizeWhitespace(text);
}

function buildLines(items: ManualTextItem[]): ManualLine[] {
  const sortedItems = [...items].sort((left, right) => {
    const yDelta = left.y - right.y;

    if (Math.abs(yDelta) > 4) {
      return yDelta;
    }

    return left.x - right.x;
  });

  const lines: ManualLine[] = [];

  for (const item of sortedItems) {
    const currentLine = lines.at(-1);

    if (!currentLine || Math.abs(currentLine.y - item.y) > 4) {
      lines.push({
        text: item.text,
        itemIndexes: [items.indexOf(item)],
        y: item.y,
        x: item.x,
        width: item.width,
        height: item.height
      });
      continue;
    }

    currentLine.itemIndexes.push(items.indexOf(item));
    currentLine.x = Math.min(currentLine.x, item.x);
    currentLine.width = Math.max(currentLine.width, item.x + item.width - currentLine.x);
    currentLine.height = Math.max(currentLine.height, item.height);
  }

  return lines
    .map((line) => {
      const lineItems = line.itemIndexes.map((index) => items[index]);
      return {
        ...line,
        text: buildLineText(lineItems)
      };
    })
    .filter((line) => line.text.length > 0);
}

function derivePageTitle(lines: ManualLine[], pageNumber: number, title: string): string {
  const candidates = lines
    .map((line) => line.text)
    .filter((line) => line.length > 3)
    .filter((line) => !/^Page \d+/i.test(line))
    .filter((line) => !/^-- \d+ of \d+ --$/i.test(line));

  return candidates[0] ?? `${title} page ${pageNumber}`;
}

function createChunks(page: ManualPage, manualTitle: string, manualKind: string): ManualChunk[] {
  if (page.lines.length === 0) {
    const text = `${manualTitle} ${page.title} page ${page.pageNumber}`;
    return [
      {
        id: `${page.manualId}-p${page.pageNumber}-c0`,
        manualId: page.manualId,
        manualTitle,
        manualKind,
        pageNumber: page.pageNumber,
        title: page.title,
        text,
        normalizedText: normalizeSearchText(text),
        sourceKind: page.sourceKind
      }
    ];
  }

  const chunks: ManualChunk[] = [];
  const chunkSize = 8;
  const overlap = 2;

  for (let startIndex = 0; startIndex < page.lines.length; startIndex += chunkSize - overlap) {
    const selectedLines = page.lines.slice(startIndex, startIndex + chunkSize);

    if (selectedLines.length === 0) {
      continue;
    }

    const text = normalizeWhitespace(selectedLines.map((line) => line.text).join(" "));

    if (text.length === 0) {
      continue;
    }

    chunks.push({
      id: `${page.manualId}-p${page.pageNumber}-c${chunks.length}`,
      manualId: page.manualId,
      manualTitle,
      manualKind,
      pageNumber: page.pageNumber,
      title: page.title,
      text,
      normalizedText: normalizeSearchText(text),
      sourceKind: page.sourceKind
    });

    if (startIndex + chunkSize >= page.lines.length) {
      break;
    }
  }

  return chunks;
}

async function extractManual(manual: (typeof MANUALS)[number]) {
  const sourcePath = path.join(process.cwd(), FILES_DIRECTORY, manual.filename);
  const fileData = await readFile(sourcePath);
  const loadingTask = getDocument({
    data: new Uint8Array(fileData),
    useWorkerFetch: false,
    isEvalSupported: false
  });
  const document = await loadingTask.promise;

  const pages: ManualPage[] = [];
  const chunks: ManualChunk[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = textContent.items
      .filter((item) => "str" in item && typeof item.str === "string")
      .map((item) => {
        const textItem = item as PdfTextItem;

        return {
          text: normalizeWhitespace(textItem.str),
          x: textItem.transform[4],
          y: viewport.height - textItem.transform[5],
          width: textItem.width,
          height: textItem.height
        };
      })
      .filter((item) => item.text.length > 0);

    const lines = buildLines(items);
    const pageText = normalizeWhitespace(lines.map((line) => line.text).join(" "));
    const title = derivePageTitle(lines, pageNumber, manual.title);
    const sourceKind = deriveSourceKind(pageText, manual.kind);

    const pageRecord: ManualPage = {
      manualId: manual.id,
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      title,
      text: pageText,
      items,
      lines,
      sourceKind
    };

    pages.push(pageRecord);
    chunks.push(...createChunks(pageRecord, manual.title, manual.kind));
  }

  return {
    manifest: {
      id: manual.id,
      title: manual.title,
      filename: manual.filename,
      kind: manual.kind,
      priority: manual.priority,
      pageCount: document.numPages
    },
    pages,
    chunks
  };
}

export async function generateKnowledgeBase(): Promise<ManualKnowledgeBase> {
  const extracted = await Promise.all(MANUALS.map((manual) => extractManual(manual)));

  return {
    generatedAt: new Date().toISOString(),
    manifest: extracted.map((manual) => manual.manifest),
    pages: extracted.flatMap((manual) => manual.pages),
    chunks: extracted.flatMap((manual) => manual.chunks)
  };
}

export async function writeKnowledgeBase(knowledgeBase: ManualKnowledgeBase): Promise<void> {
  const outputDirectory = path.join(process.cwd(), GENERATED_DIRECTORY);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "knowledge-base.json"),
    `${JSON.stringify(knowledgeBase)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDirectory, "pages.json"),
    `${JSON.stringify(knowledgeBase.pages, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDirectory, "chunks.json"),
    `${JSON.stringify(knowledgeBase.chunks, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: knowledgeBase.generatedAt,
        manuals: knowledgeBase.manifest,
        chunkCount: knowledgeBase.chunks.length,
        pageCount: knowledgeBase.pages.length
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}
