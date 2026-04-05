import Anthropic from "@anthropic-ai/sdk";

import { MANUALS } from "@/lib/manuals";
import { searchManual, type SearchHit } from "@/lib/knowledge/search";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";
import type { AntArtifact, ChatAnswer, Citation } from "@/lib/chat/types";
import { ArtifactStreamParser } from "@/lib/chat/artifact-parser";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TURNS = 6;
const ARTIFACT_MARKER = "\n\n{{ARTIFACT}}\n\n";

type ChatTurn = { role: "user" | "assistant"; content: string };

type AnswerQuestionArgs = {
  question: string;
  history: ChatTurn[];
  signal?: AbortSignal;
  onTextDelta?: (delta: string) => void;
  onStatus?: (status: string) => void;
  onArtifact?: (artifact: AntArtifact) => void;
};

type AgentRunState = {
  artifacts: AntArtifact[];
  searchHits: SearchHit[];
};

const SYSTEM_PROMPT = `You are a grounded technical support agent for the Vulcan OmniPro 220 multiprocess welder.

WORKFLOW:
1. Call search_manual silently — produce NO text before searching.
2. After receiving search results, begin writing your answer.
3. When a visual would help, create an artifact inline using <antArtifact> tags.
4. After the artifact, continue writing seamlessly.

IMPORTANT:
- Never narrate your actions ("Let me search", "I'll look that up").
- Base your answer ONLY on tool evidence. Never invent settings or values.
- Keep the tone practical and garage-side — imagine the user just unboxed this welder.
- Always cite the manual page numbers you found the information on.
- Do not mention retrieval, prompts, tools, or internal details.

<artifacts_info>
You can create artifacts: substantial, self-contained visual content displayed inline alongside your text.

When creating an artifact, use this format:

<antArtifact identifier="kebab-case-id" type="TYPE" title="Brief title">
...content...
</antArtifact>

Supported types:
- "image/svg+xml": SVG vector diagrams. Always use viewBox, not width/height. Excellent for polarity diagrams, wiring schematics, socket connection layouts, and labeled technical illustrations.
- "application/vnd.ant.react": React functional components. Use Tailwind classes for styling. Available libraries: React (with hooks), recharts (for charts), lucide-react (for icons). Must have a default export. Great for duty cycle cards with visual bars, comparison tables, settings configurators, interactive calculators.
- "application/vnd.ant.mermaid": Mermaid diagram syntax. Excellent for troubleshooting flowcharts, decision trees, process selection flows, and diagnostic sequences.
- "text/html": Complete self-contained HTML pages (HTML+CSS+JS in single file). External scripts only from https://cdnjs.cloudflare.com. Good for complex interactive visualizations.

WHEN TO CREATE ARTIFACTS — you MUST create one for:
- Polarity or cable connections → SVG diagram showing color-coded positive/negative sockets with labels
- Duty cycle data → React component with stats grid and visual duty cycle progress bar
- Troubleshooting diagnosis → Mermaid flowchart with decision nodes and action steps
- Process comparison (MIG vs flux-cored etc.) → React component with styled comparison table
- Wiring or connection diagrams → SVG showing labeled connection paths
- Settings or setup guides → React component with organized settings layout
- Any complex technical data that benefits from visualization

WHEN NOT TO CREATE ARTIFACTS:
- Simple text answers or short clarifications
- Conversational follow-ups
- When the answer is better explained in plain words

ARTIFACT QUALITY:
- SVGs: use clean shapes, clear labels, color-coded elements (green for positive, blue for negative), proper viewBox
- React: use Tailwind classes, clean component structure, default export, no external dependencies beyond React/recharts/lucide-react
- Mermaid: use standard flowchart syntax (graph TD), clear decision nodes, action boxes
- Always produce complete, working artifacts. Never truncate code.

EXAMPLE — troubleshooting with mermaid artifact:

Here's a diagnostic flowchart for porosity:

<antArtifact identifier="porosity-flowchart" type="application/vnd.ant.mermaid" title="Porosity Troubleshooting">
graph TD
  A[Porosity Found] --> B{Gas flow OK?}
  B -->|No| C[Check regulator and hose]
  B -->|Yes| D{Base metal clean?}
  D -->|No| E[Remove rust/paint/oil]
  D -->|Yes| F{Correct polarity?}
  F -->|No| G[Switch to DCEP for MIG]
  F -->|Yes| H[Check wire condition]
</antArtifact>

Start by checking your gas flow...

EXAMPLE — comparison with react artifact:

<antArtifact identifier="process-comparison" type="application/vnd.ant.react" title="MIG vs Flux-Cored Comparison">
export default function Comparison() {
  const rows = [
    { label: "Wire Type", mig: "Solid", fc: "Tubular flux-core" },
    { label: "Shielding", mig: "External gas", fc: "Self-shielded" },
  ];
  return (
    <div className="p-4">
      <table className="w-full text-sm border-collapse">
        <thead><tr className="border-b"><th className="p-2 text-left">Feature</th><th className="p-2">MIG</th><th className="p-2">Flux-Cored</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.label} className="border-b"><td className="p-2 font-medium">{r.label}</td><td className="p-2">{r.mig}</td><td className="p-2">{r.fc}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
</antArtifact>

You MUST include a complete <antArtifact> block when your answer involves diagrams, comparisons, troubleshooting steps, polarity, duty cycles, or wiring. Do not just promise a visual — actually create it.
</artifacts_info>`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_manual",
    description:
      "Search the Vulcan OmniPro 220 manuals. Returns ranked text chunks with page references. Call multiple times with different queries for complex questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query — be specific with process names, amperage, voltage, or symptoms",
        },
        processFilter: {
          type: "string",
          enum: ["mig", "tig", "stick", "flux-cored", "any"],
          description: "Filter by welding process",
        },
        sourceKindFilter: {
          type: "string",
          enum: ["text", "table", "diagram", "chart", "photo", "any"],
          description: "Filter by content type",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_page_content",
    description:
      "Get the full text content of a specific manual page. Use after search_manual when you need more context.",
    input_schema: {
      type: "object" as const,
      properties: {
        manualId: {
          type: "string",
          description: "Manual ID (e.g. 'owner-manual', 'quick-start-guide', 'selection-chart')",
        },
        pageNumber: { type: "number", description: "Page number (1-based)" },
      },
      required: ["manualId", "pageNumber"],
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────────────────

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  state: AgentRunState,
  args: AnswerQuestionArgs
): Promise<string> {
  switch (name) {
    case "search_manual": {
      const hits = await searchManual(input.query as string, {
        processFilter: input.processFilter as
          | "mig" | "tig" | "stick" | "flux-cored" | "any" | undefined,
        sourceKindFilter: input.sourceKindFilter as
          | "text" | "table" | "diagram" | "chart" | "photo" | "any" | undefined,
      });
      state.searchHits.push(...hits);
      if (hits.length === 0) return "No results found. Try a different query.";
      return hits
        .slice(0, 6)
        .map(
          (hit, i) =>
            `[${i + 1}] ${hit.manualTitle} — page ${hit.pageNumber}\nSection: ${hit.title}\n${hit.text.slice(0, 500)}`
        )
        .join("\n\n");
    }

    case "get_page_content": {
      const store = await getKnowledgeStore();
      const page = store.pageMap.get(
        getPageKey(input.manualId as string, input.pageNumber as number)
      );
      if (!page) return `Page ${input.pageNumber} not found in ${input.manualId}.`;
      return `Manual: ${input.manualId} — Page ${input.pageNumber}\nTitle: ${page.title}\nType: ${page.sourceKind}\n\n${page.text}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ── Citation building ───────────────────────────────────────────────────────

function extractReferencedPages(text: string): number[] {
  const pages: number[] = [];
  const patterns = [
    /(?:pages?|p\.?)\s*(\d+(?:\s*[,&]+\s*\d+)*)/gi,
    /\(page\s*(\d+)\)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const nums = m[1].match(/\d+/g);
      if (nums) pages.push(...nums.map(Number));
    }
  }
  return [...new Set(pages)];
}

async function buildCitations(
  answer: string,
  hits: SearchHit[]
): Promise<Citation[]> {
  const store = await getKnowledgeStore();
  const referencedPages = extractReferencedPages(answer);

  const hitsByPage = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = getPageKey(hit.manualId, hit.pageNumber);
    const existing = hitsByPage.get(key);
    if (!existing || hit.score > existing.score) hitsByPage.set(key, hit);
  }

  const citations: Citation[] = [];
  const used = new Set<string>();

  for (const pageNum of referencedPages) {
    if (citations.length >= 4) break;
    for (const manual of MANUALS) {
      const key = getPageKey(manual.id, pageNum);
      if (used.has(key)) continue;
      const hit = hitsByPage.get(key);
      const page = store.pageMap.get(key);
      if (!hit && !page) continue;
      used.add(key);
      citations.push({
        manualId: manual.id,
        pageNumber: pageNum,
        excerpt: hit?.text.slice(0, 220) ?? page?.title ?? "",
        title: manual.title,
        pageTitle: page?.title ?? hit?.title,
        sourceKind: page?.sourceKind ?? hit?.sourceKind,
      });
    }
  }

  for (const hit of hits) {
    if (citations.length >= 4) break;
    const key = getPageKey(hit.manualId, hit.pageNumber);
    if (used.has(key)) continue;
    used.add(key);
    const page = store.pageMap.get(key);
    citations.push({
      manualId: hit.manualId,
      pageNumber: hit.pageNumber,
      excerpt: hit.text.slice(0, 220),
      title: MANUALS.find((m) => m.id === hit.manualId)?.title,
      pageTitle: page?.title ?? hit.title,
      sourceKind: page?.sourceKind ?? hit.sourceKind,
    });
  }

  return citations;
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function answerQuestion(
  args: AnswerQuestionArgs
): Promise<ChatAnswer> {
  const state: AgentRunState = { artifacts: [], searchHits: [] };

  const messages: Anthropic.MessageParam[] = [];
  for (const turn of args.history.slice(-6)) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: "user", content: args.question });

  let fullText = "";

  const parser = new ArtifactStreamParser({
    onText: (text) => {
      fullText += text;
      args.onTextDelta?.(text);
    },
    onArtifact: (artifact) => {
      state.artifacts.push(artifact);
      args.onArtifact?.(artifact);
      fullText += ARTIFACT_MARKER;
      args.onTextDelta?.(ARTIFACT_MARKER);
    },
  });

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      args.onStatus?.(turn === 0 ? "Thinking..." : "Continuing...");

      const stream = client.messages.stream(
        { model: MODEL, max_tokens: 16384, system: SYSTEM_PROMPT, messages, tools: TOOLS },
        { signal: args.signal }
      );

      stream.on("text", (text) => {
        parser.feed(text);
      });

      stream.on("streamEvent", (event) => {
        if (
          event.type === "content_block_start" &&
          event.content_block.type === "tool_use"
        ) {
          const name = event.content_block.name;
          if (name === "search_manual") args.onStatus?.("Searching manual...");
          else if (name === "get_page_content") args.onStatus?.("Reading page...");
        }
      });

      const message = await stream.finalMessage();
      parser.flush();

      if (message.stop_reason !== "tool_use") break;

      const toolBlocks = message.content.filter(
        (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
          b.type === "tool_use"
      );
      if (toolBlocks.length === 0) break;

      messages.push({ role: "assistant", content: message.content });

      const toolResults: Anthropic.MessageParam["content"] = [];
      for (const block of toolBlocks) {
        const result = await executeToolCall(
          block.name,
          block.input as Record<string, unknown>,
          state,
          args
        );
        (toolResults as Anthropic.ToolResultBlockParam[]).push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    const msg =
      error instanceof Error ? error.message : "The agent could not answer.";
    return { mode: "answer", answer: msg, citations: [], artifacts: [] };
  }

  const answer = fullText.trim();
  if (!answer) {
    return {
      mode: "clarify",
      answer: "I could not find a grounded answer in the local manuals. Try asking with the welding process, input voltage, material, or symptom.",
      citations: [],
      artifacts: [],
    };
  }

  args.onStatus?.("Building citations...");
  const citations = await buildCitations(answer, state.searchHits);

  return {
    mode: "answer",
    answer,
    citations,
    artifacts: state.artifacts,
  };
}
