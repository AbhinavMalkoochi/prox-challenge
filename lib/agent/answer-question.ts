import Anthropic from "@anthropic-ai/sdk";

import { MANUALS } from "@/lib/manuals";
import { searchManual, type SearchHit } from "@/lib/knowledge/search";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";
import {
  findBestExcerptMatch,
  normalizeExcerptText,
} from "@/lib/knowledge/excerpt-match";
import type { Artifact, ChatAnswer, Citation } from "@/lib/chat/types";

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
  onArtifact?: (artifact: Artifact) => void;
};

type AgentRunState = {
  artifacts: Artifact[];
  searchHits: SearchHit[];
};

const SYSTEM_PROMPT = `You are a grounded technical support agent for the Vulcan OmniPro 220 multiprocess welder.

WORKFLOW:
1. First, call search_manual silently — produce NO text before searching.
2. After receiving search results, begin writing your answer.
3. When a visual diagram would help the reader (polarity connections, duty cycles, troubleshooting steps, comparisons), call build_artifact at that natural point in your text. The diagram will render inline right where you place it.
4. After the artifact tool call, continue writing seamlessly — do not repeat information already shown in the diagram.

IMPORTANT:
- Never narrate your actions ("Let me search", "I'll look that up").
- Base your answer ONLY on tool evidence. Never invent settings or values.
- ALWAYS call build_artifact when the answer involves polarity/wiring, duty cycles, troubleshooting checklists, or process comparisons — these MUST be visual.
- Keep the tone practical and garage-side — imagine the user just unboxed this welder.
- Always cite the manual page numbers.
- Do not mention retrieval, prompts, tools, or internal details.`;

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
  {
    name: "build_artifact",
    description: `Create an inline visual diagram. The diagram renders at the current position in your text. Call this DURING your answer text, not before it.
Types:
- polarity_setup: Socket connection diagram (data: processLabel, positiveLabel, negativeLabel, notes[])
- duty_cycle: Duty cycle card with visual bar (data: current, inputVoltage, dutyCycle, restWindow, notes[])
- troubleshooting: Numbered diagnostic checklist (data: symptom, checks[])
- wiring_diagram: SVG connection diagram (data: description, connections[{from,to,label}], notes[])
- comparison_table: Side-by-side table (data: columns[], rows[{label,values[]}], notes[])`,
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["polarity_setup", "duty_cycle", "troubleshooting", "wiring_diagram", "comparison_table"],
        },
        title: { type: "string", description: "Short title for the diagram" },
        data: {
          type: "object",
          description: "Artifact-specific data fields — see type descriptions",
        },
      },
      required: ["type", "title", "data"],
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

    case "build_artifact": {
      const data = (input.data as Record<string, unknown>) ?? {};
      const artifact = {
        type: input.type as string,
        title: input.title as string,
        ...data,
      } as Artifact;
      state.artifacts.push(artifact);
      args.onArtifact?.(artifact);
      return `Artifact created: ${input.type} — "${input.title}"`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// ── Citation building ───────────────────────────────────────────────────────

function chooseExcerptSentence(question: string, excerpt: string): string {
  const sentences = excerpt
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return excerpt.slice(0, 240);

  const questionTokens = new Set(
    normalizeExcerptText(question).split(" ").filter((t) => t.length >= 2)
  );

  let best = sentences[0];
  let bestScore = -1;
  for (const sentence of sentences) {
    const tokens = new Set(
      normalizeExcerptText(sentence).split(" ").filter(Boolean)
    );
    let score = 0;
    for (const t of questionTokens) if (tokens.has(t)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  return best.length > 240 ? `${best.slice(0, 237)}...` : best;
}

async function buildCitations(
  question: string,
  hits: SearchHit[]
): Promise<Citation[]> {
  const store = await getKnowledgeStore();
  const pageHits = new Map<string, SearchHit>();

  for (const hit of hits) {
    const key = getPageKey(hit.manualId, hit.pageNumber);
    const current = pageHits.get(key);
    if (!current || hit.score > current.score) pageHits.set(key, hit);
    if (pageHits.size >= 3) break;
  }

  return [...pageHits.values()].map((hit) => {
    const page = store.pageMap.get(getPageKey(hit.manualId, hit.pageNumber));
    const match = page ? findBestExcerptMatch(page, hit.text) : null;
    const excerptSource = match?.excerptText ?? hit.text;
    const title = MANUALS.find((m) => m.id === hit.manualId)?.title;

    return {
      manualId: hit.manualId,
      pageNumber: hit.pageNumber,
      excerpt: chooseExcerptSentence(question, excerptSource),
      title,
    };
  });
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

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      args.onStatus?.(turn === 0 ? "Thinking..." : "Continuing...");

      const stream = client.messages.stream(
        { model: MODEL, max_tokens: 4096, system: SYSTEM_PROMPT, messages, tools: TOOLS },
        { signal: args.signal }
      );

      stream.on("text", (text) => {
        fullText += text;
        args.onTextDelta?.(text);
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

        if (block.name === "build_artifact") {
          fullText += ARTIFACT_MARKER;
          args.onTextDelta?.(ARTIFACT_MARKER);
        }
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
  const citations = await buildCitations(args.question, state.searchHits);
  const augmentedCitations = citations.map((c) => ({
    ...c,
    title: c.title ?? MANUALS.find((m) => m.id === c.manualId)?.title,
  }));

  return {
    mode: "answer",
    answer,
    citations: augmentedCitations,
    artifacts: state.artifacts,
  };
}
