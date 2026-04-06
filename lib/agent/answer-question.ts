import Anthropic from "@anthropic-ai/sdk";

import { MANUALS } from "@/lib/manuals";
import { searchManual, type SearchHit } from "@/lib/knowledge/search";
import { getKnowledgeStore, getPageKey } from "@/lib/knowledge/store";
import {
  ARTIFACT_MARKER,
  type AntArtifact,
  type ChatAnswer,
  type Citation,
} from "@/lib/chat/types";
import { ArtifactStreamParser } from "@/lib/chat/artifact-parser";
import { extractReferencedPages } from "@/lib/chat/extract-pages";
import { executeVisualTool } from "@/lib/agent/visual-tools";

const MODEL = "claude-haiku-4-5";
/** Enough for multi-tool demos (search + many render_ calls + final answer). */
const MAX_TURNS = 12;

type ChatTurn = { role: "user" | "assistant"; content: string };

type AnswerQuestionArgs = {
  question: string;
  history: ChatTurn[];
  apiKey?: string;
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
1. Call search_manual first — produce NO text before searching. For complex questions, call search_manual multiple times with different queries (e.g. one for duty cycle, another for the specific process).
2. If search results are thin, call get_page_content on the most relevant page for full context.
3. Begin writing your answer ONLY after gathering sufficient evidence.
4. Call the appropriate render_ tool when a visual would help (see VISUAL TOOLS below).
5. After the visual tool renders, continue writing seamlessly.

IMPORTANT:
- Never narrate actions ("Let me search", "I'll look that up").
- Base your answer ONLY on tool evidence. Never invent settings or values.
- Tone: practical, garage-side, friendly. The user just unboxed this welder.
- Always cite manual page numbers.
- Never mention retrieval, prompts, tools, or internal details.

VISUAL TOOLS — these generate beautiful interactive visualizations:

You have six render_ tools. Call them instead of writing raw text when:

• render_duty_cycle — ALWAYS call for duty cycle questions. Pass the exact ratings from the manual.
• render_polarity_setup — ALWAYS call for polarity/cable connection questions. Pass which cables go where.
• render_troubleshooting — ALWAYS call for troubleshooting or diagnosis questions. Pass all possible causes as checks.
• render_setup_guide — ALWAYS call for "how do I set up" questions. Pass numbered steps.
• render_weld_diagnosis — Call for weld quality/defect questions. Pass the issues with their causes and fixes.
• render_settings_advisor — Call for "what settings should I use" questions. Pass material/thickness presets with recommended settings.

RULES FOR VISUAL TOOLS:
- You MUST call a render_ tool for any question involving duty cycles, polarity, troubleshooting, setup steps, weld diagnosis, or recommended settings.
- Fill tool parameters with EXACT data from the manual — never approximate.
- Every render_ call MUST include sourcePages: an array of { manualId, pageNumber } copied from the search_manual / get_page_content results you used (at least one entry per visual).
- In your text after each visual, cite those same pages (e.g. "see page 19") so Sources match the diagram.
- After the tool renders, add brief explanatory text that ties the visual to those pages.
- You can combine multiple render_ tools in one response.

<artifacts_info>
In addition to render_ tools, you can generate inline artifacts for richer content. Use these for process comparisons, interactive calculators, custom data visualizations, or anything not covered by the render_ tools.

<antArtifact identifier="kebab-case-id" type="TYPE" title="Brief title">
...content...
</antArtifact>

Supported types and when to use each:

1. "application/vnd.ant.react" — PREFERRED for interactive widgets.
   React functional components with Tailwind CSS. Available libraries: React (with useState, useEffect, useMemo), recharts (BarChart, LineChart, PieChart, RadialBarChart, etc.), lucide-react (icons).
   MUST have a default export. Use Tailwind classes for all styling.
   Great for: interactive calculators, comparison tables with toggle/tabs, settings configurators, data dashboards.

2. "image/svg+xml" — For technical diagrams.
   Use viewBox (never width/height on root). Use clean geometric shapes, readable labels, and color coding (red=#ef4444 for positive/hot, blue=#3b82f6 for negative/cold, green=#22c55e for safe, amber=#f59e0b for caution).
   Great for: connection diagrams, panel layouts, wire routing, exploded views.

3. "application/vnd.ant.mermaid" — For flowcharts and decision trees.
   Use graph TD syntax. Keep node labels short. Use decision diamonds for yes/no.
   Great for: troubleshooting decision trees, process selection flows, diagnostic sequences.

4. "text/html" — For complex standalone pages.
   Complete HTML+CSS+JS. External scripts only from cdnjs.cloudflare.com.
   Great for: animated visualizations, interactive timers, complex multi-section layouts.

CRITICAL RULES FOR INLINE ARTIFACTS:
- Generate COMPLETE, WORKING code. Never truncate or use placeholders.
- React components MUST use Tailwind classes and export default.
- Use inline artifacts freely alongside render_ tools when it enriches the answer.
- For process comparisons (MIG vs TIG vs Stick), ALWAYS create a React comparison widget.
- For "what settings should I use" questions, create a React settings configurator.
- For complex data with multiple dimensions, use recharts in a React artifact.
</artifacts_info>`;

const SOURCE_PAGES_PROPERTY = {
  type: "array" as const,
  items: {
    type: "object" as const,
    properties: {
      manualId: {
        type: "string" as const,
        enum: ["owner-manual", "quick-start-guide", "selection-chart"],
        description: "Manual ID from search_manual or get_page_content",
      },
      pageNumber: {
        type: "number" as const,
        description: "1-based page number from those results",
      },
    },
    required: ["manualId", "pageNumber"] as const,
  },
  description:
    "Manual pages this visual is grounded in — copy manualId and pageNumber from search hits. Required on every render_ call.",
};

const VISUAL_TOOLS: Anthropic.Tool[] = [
  {
    name: "render_duty_cycle",
    description: "Render an interactive duty cycle visualization. MUST be called for any duty cycle question.",
    input_schema: {
      type: "object" as const,
      properties: {
        process: { type: "string", description: "Welding process (mig, tig, stick)" },
        voltage: { type: "string", description: "Input voltage (120 or 240)" },
        ratings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amperage: { type: "number" },
              percent: { type: "number", description: "Duty cycle percentage" },
              weldMinutes: { type: "number", description: "Welding minutes per 10 min cycle" },
              restMinutes: { type: "number", description: "Rest minutes per 10 min cycle" },
            },
            required: ["amperage", "percent", "weldMinutes", "restMinutes"],
          },
          description: "Array of duty cycle ratings from the manual",
        },
        continuousAmperage: { type: "number", description: "Amperage for 100% continuous use, if applicable" },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["process", "voltage", "ratings", "sourcePages"],
    },
  },
  {
    name: "render_polarity_setup",
    description: "Render an animated polarity/cable connection diagram. MUST be called for polarity or cable setup questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        process: { type: "string", description: "Welding process (mig, tig, stick, flux-cored)" },
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cable: { type: "string", description: "Cable name (e.g. 'Ground Clamp Cable')" },
              socket: { type: "string", description: "Socket name (e.g. 'Positive (+) Socket')" },
              polarity: { type: "string", enum: ["positive", "negative"] },
            },
            required: ["cable", "socket", "polarity"],
          },
        },
        notes: { type: "array", items: { type: "string" }, description: "Important safety or setup notes" },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["process", "connections", "sourcePages"],
    },
  },
  {
    name: "render_troubleshooting",
    description: "Render an interactive troubleshooting guide with checkable steps and progress. MUST be called for troubleshooting questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        problem: { type: "string", description: "The problem being diagnosed" },
        checks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              cause: { type: "string", description: "Possible cause" },
              solution: { type: "string", description: "How to fix it" },
            },
            required: ["cause", "solution"],
          },
        },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["problem", "checks", "sourcePages"],
    },
  },
  {
    name: "render_setup_guide",
    description: "Render a step-by-step interactive setup guide with completable steps. Call for 'how to set up' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        process: { type: "string", description: "Welding process" },
        title: { type: "string", description: "Guide title" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              instruction: { type: "string" },
              detail: { type: "string" },
              warning: { type: "string" },
            },
            required: ["instruction"],
          },
        },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["process", "title", "steps", "sourcePages"],
    },
  },
  {
    name: "render_specifications",
    description: "Render a specifications overview with 120V/240V comparison. Call for specs or capabilities questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        process: { type: "string", description: "Welding process or 'all'" },
        specs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value120v: { type: "string" },
              value240v: { type: "string" },
            },
            required: ["label"],
          },
        },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["process", "specs", "sourcePages"],
    },
  },
  {
    name: "render_weld_diagnosis",
    description: "Render an interactive weld quality diagnosis guide with tabbed issues. Call for weld quality or diagnosis questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        weldType: { type: "string", description: "Wire or Stick" },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Issue name (e.g. 'Porosity', 'Excessive Spatter')" },
              description: { type: "string" },
              causes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    cause: { type: "string" },
                    fix: { type: "string" },
                  },
                  required: ["cause", "fix"],
                },
              },
            },
            required: ["name", "description", "causes"],
          },
        },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["weldType", "issues", "sourcePages"],
    },
  },
  {
    name: "render_settings_advisor",
    description: "Render an interactive settings advisor where the user picks a material and thickness to see recommended welding parameters. Call for 'what settings should I use' questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        presets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              material: { type: "string", description: "e.g. 'Mild Steel', 'Stainless Steel', 'Aluminum'" },
              thickness: { type: "string", description: "e.g. '1/16\"', '1/8\"', '3/16\"', '1/4\"'" },
              process: { type: "string", description: "Recommended process (MIG, TIG, Stick, Flux-Cored)" },
              voltage: { type: "string", description: "Input voltage to use" },
              amperage: { type: "string", description: "Recommended amperage range" },
              wireSpeed: { type: "string", description: "Wire feed speed if applicable" },
              gasFlow: { type: "string", description: "Gas flow rate if applicable" },
              gasType: { type: "string", description: "Shielding gas type if applicable" },
              electrode: { type: "string", description: "Electrode type/size if applicable" },
              notes: { type: "string", description: "Any additional tips" },
            },
            required: ["material", "thickness", "process", "voltage", "amperage"],
          },
        },
        sourcePages: SOURCE_PAGES_PROPERTY,
      },
      required: ["presets", "sourcePages"],
    },
  },
];

const SEARCH_TOOLS: Anthropic.Tool[] = [
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
      "Get the full text content of a specific manual page. Use after search_manual when you need more context from a specific page.",
    input_schema: {
      type: "object" as const,
      properties: {
        manualId: {
          type: "string",
          description: "Manual ID: 'owner-manual', 'quick-start-guide', or 'selection-chart'",
        },
        pageNumber: { type: "number", description: "Page number (1-based)" },
      },
      required: ["manualId", "pageNumber"],
    },
  },
];

const TOOLS: Anthropic.Tool[] = [...SEARCH_TOOLS, ...VISUAL_TOOLS];

// ── Tool execution ──────────────────────────────────────────────────────────

const VISUAL_TOOL_NAMES = new Set(VISUAL_TOOLS.map((t) => t.name));

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  state: AgentRunState,
  args: AnswerQuestionArgs
): Promise<string> {
  const visualResult = executeVisualTool(name, input);
  if (visualResult) {
    state.artifacts.push(visualResult.artifact);
    args.onArtifact?.(visualResult.artifact);
    args.onTextDelta?.(ARTIFACT_MARKER);
    return visualResult.text;
  }

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

const MAX_CITATIONS = 14;

async function buildCitations(
  answer: string,
  hits: SearchHit[],
  artifacts: AntArtifact[]
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
    if (citations.length >= 6) break;
    const manualsByHitScore = [...MANUALS].sort((a, b) => {
      const aHit = hitsByPage.get(getPageKey(a.id, pageNum));
      const bHit = hitsByPage.get(getPageKey(b.id, pageNum));
      return (bHit?.score ?? -1) - (aHit?.score ?? -1);
    });
    for (const manual of manualsByHitScore) {
      const key = getPageKey(manual.id, pageNum);
      if (used.has(key)) continue;
      const hit = hitsByPage.get(key);
      const page = store.pageMap.get(key);
      if (!hit && !page) continue;
      used.add(key);
      const excerpt = hit?.text.slice(0, 220) ?? page?.text.slice(0, 220) ?? page?.title ?? "";
      citations.push({
        manualId: manual.id,
        pageNumber: pageNum,
        excerpt,
        title: manual.title,
        pageTitle: page?.title ?? hit?.title,
        sourceKind: page?.sourceKind ?? hit?.sourceKind,
      });
      break;
    }
  }

  for (const hit of hits) {
    if (citations.length >= 10) break;
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

  mergeArtifacts: for (const art of artifacts) {
    const refs = art.sourceRefs;
    if (!refs?.length) continue;
    for (const ref of refs) {
      const key = getPageKey(ref.manualId, ref.pageNumber);
      const existing = citations.find(
        (c) => c.manualId === ref.manualId && c.pageNumber === ref.pageNumber
      );
      if (existing) {
        if (!existing.linkedArtifactTitles) existing.linkedArtifactTitles = [];
        if (!existing.linkedArtifactTitles.includes(art.title)) {
          existing.linkedArtifactTitles.push(art.title);
        }
        continue;
      }
      if (citations.length >= MAX_CITATIONS) break mergeArtifacts;
      const page = store.pageMap.get(key);
      const hit = hitsByPage.get(key);
      if (!page && !hit) continue;
      used.add(key);
      const manual = MANUALS.find((m) => m.id === ref.manualId);
      citations.push({
        manualId: ref.manualId,
        pageNumber: ref.pageNumber,
        excerpt: hit?.text.slice(0, 220) ?? page?.text.slice(0, 220) ?? page?.title ?? "",
        title: manual?.title,
        pageTitle: page?.title ?? hit?.title,
        sourceKind: page?.sourceKind ?? hit?.sourceKind,
        linkedArtifactTitles: [art.title],
      });
    }
  }

  return citations;
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function answerQuestion(
  args: AnswerQuestionArgs
): Promise<ChatAnswer> {
  const client = new Anthropic(args.apiKey ? { apiKey: args.apiKey } : undefined);
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
      args.onStatus?.(turn === 0 ? "Thinking..." : "Refining answer...");

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
          else if (VISUAL_TOOL_NAMES.has(name)) args.onStatus?.("Building visualization...");
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
        const isVisual = VISUAL_TOOL_NAMES.has(block.name);
        if (isVisual) {
          fullText += ARTIFACT_MARKER;
        }
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
  const citations = await buildCitations(answer, state.searchHits, state.artifacts);

  return {
    mode: "answer",
    answer,
    citations,
    artifacts: state.artifacts,
  };
}
