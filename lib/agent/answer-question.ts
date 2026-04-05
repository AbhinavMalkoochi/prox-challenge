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

CRITICAL BEHAVIOR:
- Do NOT produce any text before calling tools. Just call the tools silently.
- After all tool calls are complete, write your full answer in a single final response.
- Never narrate what you are doing ("Let me search", "I'll look that up", etc.).

TOOL RULES:
- Always call search_manual at least once before answering. For complex questions, call it multiple times with different queries to cross-reference.
- Base your answer ONLY on tool evidence. Never invent settings, polarity guidance, duty cycle values, or troubleshooting steps.
- ALWAYS call build_artifact when the answer benefits from a visual element. Prefer visual artifacts over plain text.

ARTIFACT RULES — call build_artifact with the appropriate type:
- polarity_setup: wiring, polarity, or cable connections
- duty_cycle: duty cycle data
- troubleshooting: diagnostics, problems, symptoms
- settings: recommended setup or configuration
- wiring_diagram: connection diagrams
- page_reference: specific manual page with important visual content
- comparison_table: comparing welding processes or features
- process_selector: helping choose a welding process
- parts_reference: referencing specific parts

ANSWER STYLE:
- Keep the tone practical and garage-side — imagine the user just unboxed this welder.
- Always cite the manual page numbers you found the information on.
- If evidence is incomplete, say what is missing and ask a short follow-up question.
- Do not mention retrieval, prompts, tools, or internal system details to the user.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_manual",
    description:
      "Search the Vulcan OmniPro 220 manuals. Returns ranked text chunks with page references. Call multiple times with different queries for complex or multi-hop questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — be specific with process names, amperage, voltage, or symptoms",
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
      "Get the full text content of a specific manual page for detailed cross-referencing. Use after search_manual to read a full page when you need more context.",
    input_schema: {
      type: "object" as const,
      properties: {
        manualId: {
          type: "string",
          description:
            "Manual ID (e.g. 'owner-manual', 'quick-start-guide', 'selection-chart')",
        },
        pageNumber: { type: "number", description: "Page number (1-based)" },
      },
      required: ["manualId", "pageNumber"],
    },
  },
  {
    name: "build_artifact",
    description: `Create a visual artifact to display alongside the answer. Call this when the answer benefits from a visual element.
Available types:
- polarity_setup: Cable/socket polarity diagram (data: processLabel, positiveLabel, negativeLabel, notes[])
- duty_cycle: Duty cycle reference card (data: current, inputVoltage, dutyCycle, restWindow, notes[])
- troubleshooting: Diagnostic checklist (data: symptom, checks[])
- settings: Recommended setup card (data: summary, points[])
- wiring_diagram: Connection diagram (data: description, connections[{from,to,label}], notes[])
- page_reference: Manual page callout (data: manualId, pageNumber, description, callouts[])
- comparison_table: Side-by-side comparison (data: columns[], rows[{label,values[]}], notes[])
- process_selector: Process chooser (data: description, options[{process,bestFor,keySettings[]}])
- parts_reference: Parts list (data: description, parts[{number,name,description}])`,
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: [
            "polarity_setup",
            "duty_cycle",
            "troubleshooting",
            "settings",
            "wiring_diagram",
            "page_reference",
            "comparison_table",
            "process_selector",
            "parts_reference",
          ],
        },
        title: { type: "string", description: "Short title for the artifact" },
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
      args.onStatus?.("Searching manual...");
      const hits = await searchManual(input.query as string, {
        processFilter: input.processFilter as
          | "mig"
          | "tig"
          | "stick"
          | "flux-cored"
          | "any"
          | undefined,
        sourceKindFilter: input.sourceKindFilter as
          | "text"
          | "table"
          | "diagram"
          | "chart"
          | "photo"
          | "any"
          | undefined,
      });
      state.searchHits.push(...hits);
      if (hits.length === 0) {
        return "No results found. Try a different query or broader terms.";
      }
      return hits
        .slice(0, 6)
        .map(
          (hit, i) =>
            `[${i + 1}] ${hit.manualTitle} — page ${hit.pageNumber}\nSection: ${hit.title}\n${hit.text.slice(0, 500)}`
        )
        .join("\n\n");
    }

    case "get_page_content": {
      args.onStatus?.("Reading page...");
      const store = await getKnowledgeStore();
      const page = store.pageMap.get(
        getPageKey(input.manualId as string, input.pageNumber as number)
      );
      if (!page) return `Page ${input.pageNumber} not found in ${input.manualId}.`;
      return `Manual: ${input.manualId} — Page ${input.pageNumber}\nTitle: ${page.title}\nType: ${page.sourceKind}\n\n${page.text}`;
    }

    case "build_artifact": {
      args.onStatus?.("Building visual...");
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
    normalizeExcerptText(question)
      .split(" ")
      .filter((t) => t.length >= 2)
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
        {
          model: MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages,
          tools: TOOLS,
        },
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
          const toolName = event.content_block.name;
          const label =
            toolName === "search_manual"
              ? "Searching manual..."
              : toolName === "build_artifact"
                ? "Building visual..."
                : toolName === "get_page_content"
                  ? "Reading page..."
                  : toolName;
          args.onStatus?.(label);
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
      answer:
        "I could not find a grounded answer in the local manuals. Try asking with the welding process, input voltage, material, or symptom.",
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
