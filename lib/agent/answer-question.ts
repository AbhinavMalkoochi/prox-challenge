import {
  query,
  tool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { MANUALS } from "@/lib/manuals";
import { searchManual, type SearchHit } from "@/lib/knowledge/search";
import {
  getKnowledgeStore,
  getPageKey,
} from "@/lib/knowledge/store";
import {
  findBestExcerptMatch,
  normalizeExcerptText,
} from "@/lib/knowledge/excerpt-match";
import type {
  Artifact,
  ChatAnswer,
  Citation,
} from "@/lib/chat/types";

// ── Types ────────────────────────────────────────────────────────────────────

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type AnswerQuestionArgs = {
  question: string;
  history: ChatTurn[];
  signal?: AbortSignal;
  onTextDelta?: (delta: string) => void | Promise<void>;
  onStatus?: (status: string) => void | Promise<void>;
};

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a grounded technical support agent for the Vulcan OmniPro 220 multiprocess welder.

RULES:
- Always call search_manual at least once before answering. For complex questions, call it multiple times with different queries to cross-reference information.
- Base your answer ONLY on the evidence returned by your tools. Never invent settings, polarity guidance, duty cycle values, or troubleshooting steps.
- When the answer involves wiring, polarity, or cable connections, call build_artifact with type "polarity_setup" or "wiring_diagram".
- When the answer involves duty cycle data, call build_artifact with type "duty_cycle".
- When the answer involves troubleshooting or diagnostics, call build_artifact with type "troubleshooting".
- When the answer involves recommended settings or configuration, call build_artifact with type "settings".
- When comparing welding processes, call build_artifact with type "comparison_table".
- When referencing a specific manual page with a diagram or important visual, call build_artifact with type "page_reference".
- When helping the user choose a welding process, call build_artifact with type "process_selector".
- When referencing specific parts, call build_artifact with type "parts_reference".
- If the evidence is incomplete, say what is missing and ask a short follow-up question.
- Keep the tone practical and garage-side — imagine the user just unboxed this welder.
- Always cite the manual page numbers you found the information on.
- Do not mention retrieval, prompts, tools, or internal system details to the user.`;

// ── Shared state for collecting tool outputs ─────────────────────────────────

type AgentRunState = {
  citations: Citation[];
  artifact: Artifact | null;
  searchHits: SearchHit[];
};

function createAgentRunState(): AgentRunState {
  return { citations: [], artifact: null, searchHits: [] };
}

// ── Citation building ────────────────────────────────────────────────────────

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

// ── MCP tool definitions ─────────────────────────────────────────────────────

function createToolServer(state: AgentRunState) {
  const searchManualTool = tool(
    "search_manual",
    "Search the Vulcan OmniPro 220 manuals. Returns ranked text chunks with page references. Call multiple times with different queries for complex or multi-hop questions.",
    {
      query: z.string().describe("Search query — be specific with process names, amperage, voltage, or symptoms"),
      processFilter: z.enum(["mig", "tig", "stick", "flux-cored", "any"]).optional().describe("Filter by welding process"),
      sourceKindFilter: z.enum(["text", "table", "diagram", "chart", "photo", "any"]).optional().describe("Filter by content type"),
    },
    async (args) => {
      const hits = await searchManual(args.query, {
        processFilter: args.processFilter,
        sourceKindFilter: args.sourceKindFilter,
      });

      state.searchHits.push(...hits);

      const formatted = hits
        .slice(0, 6)
        .map(
          (hit, i) =>
            `[${i + 1}] ${hit.manualTitle} — page ${hit.pageNumber}\nSection: ${hit.title}\n${hit.text.slice(0, 500)}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: hits.length > 0
              ? `Found ${hits.length} results:\n\n${formatted}`
              : "No results found. Try a different query or broader terms.",
          },
        ],
      };
    }
  );

  const getPageContentTool = tool(
    "get_page_content",
    "Get the full text content of a specific manual page for detailed cross-referencing. Use after search_manual to read a full page when you need more context.",
    {
      manualId: z.string().describe("Manual ID (e.g. 'owner-manual', 'quick-start-guide', 'selection-chart')"),
      pageNumber: z.number().describe("Page number (1-based)"),
    },
    async (args) => {
      const store = await getKnowledgeStore();
      const page = store.pageMap.get(getPageKey(args.manualId, args.pageNumber));

      if (!page) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Page ${args.pageNumber} not found in ${args.manualId}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Manual: ${args.manualId} — Page ${args.pageNumber}\nTitle: ${page.title}\nType: ${page.sourceKind}\n\nFull text:\n${page.text}`,
          },
        ],
      };
    }
  );

  const buildArtifactTool = tool(
    "build_artifact",
    `Create a visual artifact to display alongside the answer. Call this when the answer benefits from a visual element.
Available types:
- polarity_setup: Cable/socket polarity diagram (needs: processLabel, positiveLabel, negativeLabel, notes[])
- duty_cycle: Duty cycle reference card (needs: current, inputVoltage, dutyCycle, restWindow, notes[])
- troubleshooting: Diagnostic checklist (needs: symptom, checks[])
- settings: Recommended setup card (needs: summary, points[])
- wiring_diagram: Connection diagram (needs: description, connections[{from,to,label}], notes[])
- page_reference: Manual page callout (needs: manualId, pageNumber, description, callouts[])
- comparison_table: Side-by-side comparison (needs: columns[], rows[{label,values[]}], notes[])
- process_selector: Process chooser (needs: description, options[{process,bestFor,keySettings[]}])
- parts_reference: Parts list (needs: description, parts[{number,name,description}])`,
    {
      type: z.enum([
        "polarity_setup",
        "duty_cycle",
        "troubleshooting",
        "settings",
        "wiring_diagram",
        "page_reference",
        "comparison_table",
        "process_selector",
        "parts_reference",
      ]),
      title: z.string().describe("Short title for the artifact"),
      data: z.record(z.string(), z.unknown()).describe("Artifact-specific data fields — see type descriptions above"),
    },
    async (args) => {
      const artifact = {
        type: args.type,
        title: args.title,
        ...args.data,
      } as Artifact;

      state.artifact = artifact;

      return {
        content: [
          {
            type: "text" as const,
            text: `Artifact created: ${args.type} — "${args.title}"`,
          },
        ],
      };
    }
  );

  return createSdkMcpServer({
    name: "vulcan-knowledge",
    version: "1.0.0",
    tools: [searchManualTool, getPageContentTool, buildArtifactTool],
  });
}

// ── Main entry point ─────────────────────────────────────────────────────────

async function emitStatus(
  onStatus: AnswerQuestionArgs["onStatus"],
  status: string
): Promise<void> {
  if (onStatus) await onStatus(status);
}

export async function answerQuestion(
  args: AnswerQuestionArgs
): Promise<ChatAnswer> {
  const state = createAgentRunState();
  const mcpServer = createToolServer(state);

  await emitStatus(args.onStatus, "Starting agent");

  const abortController = new AbortController();
  if (args.signal) {
    args.signal.addEventListener("abort", () => abortController.abort());
  }

  const historyContext =
    args.history.length > 0
      ? args.history
          .slice(-6)
          .map(
            (turn) =>
              `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`
          )
          .join("\n")
      : "";

  const prompt = historyContext
    ? `Conversation so far:\n${historyContext}\n\nUser's current question: ${args.question}`
    : args.question;

  let fullText = "";
  let inTool = false;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        model: "sonnet",
        maxTurns: 6,
        tools: [],
        allowedTools: [
          "mcp__vulcan-knowledge__search_manual",
          "mcp__vulcan-knowledge__get_page_content",
          "mcp__vulcan-knowledge__build_artifact",
        ],
        mcpServers: {
          "vulcan-knowledge": mcpServer,
        },
        includePartialMessages: true,
        abortController,
        persistSession: false,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
      },
    })) {
      if (message.type === "stream_event") {
        const event = message.event;

        if (
          event.type === "content_block_start" &&
          "content_block" in event &&
          (event.content_block as { type: string }).type === "tool_use"
        ) {
          inTool = true;
          const toolName = (event.content_block as { name?: string }).name ?? "";
          await emitStatus(args.onStatus, `Using ${toolName.replace("mcp__vulcan-knowledge__", "")}`);
        }

        if (event.type === "content_block_stop") {
          inTool = false;
        }

        if (
          event.type === "content_block_delta" &&
          "delta" in event &&
          (event.delta as { type: string }).type === "text_delta" &&
          !inTool
        ) {
          const text = (event.delta as { text: string }).text;
          fullText += text;
          if (args.onTextDelta) await args.onTextDelta(text);
        }
      }

      if (message.type === "assistant" && !fullText) {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (
              typeof block === "object" &&
              block !== null &&
              "type" in block &&
              block.type === "text" &&
              "text" in block
            ) {
              fullText = block.text as string;
            }
          }
        }
      }

      if (message.type === "result") {
        if (message.subtype !== "success") {
          throw new Error("The agent encountered an error.");
        }
        if (!fullText && message.result) {
          fullText = String(message.result);
        }
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    const msg =
      error instanceof Error ? error.message : "The agent could not answer.";
    return {
      mode: "answer",
      answer: msg,
      citations: [],
      artifact: null,
    };
  }

  const answer = fullText.trim();
  if (!answer) {
    return {
      mode: "clarify",
      answer:
        "I could not find a grounded answer in the local manuals. Try asking with the welding process, input voltage, material, or symptom.",
      citations: [],
      artifact: null,
    };
  }

  await emitStatus(args.onStatus, "Building citations");
  const citations = await buildCitations(args.question, state.searchHits);
  const augmentedCitations = citations.map((c) => ({
    ...c,
    title: c.title ?? MANUALS.find((m) => m.id === c.manualId)?.title,
  }));

  return {
    mode: "answer",
    answer,
    citations: augmentedCitations,
    artifact: state.artifact,
  };
}
