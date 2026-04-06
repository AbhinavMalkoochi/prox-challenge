# Vulcan OmniPro 220 Copilot


Grounded multimodal support agent for the Vulcan OmniPro 220 welder. The app answers setup, polarity, duty cycle, troubleshooting, and settings questions with cited text, interactive visuals, and source-linked manual pages.

## Demo

- Main option: https://prox-challenge.vercel.app/
- Repo: https://github.com/AbhinavMalkoochi/prox-challenge

If you only try one thing, use the hosted site above. 

## What I Built

- ask a natural question
- get a direct answer quickly
- see an interactive visual when text alone is not enough
- open the exact cited manual page with the relevant section highlighted

## Why This Design

The challenge emphasized four things: technical accuracy, multimodal responses, helpful tone, and knowledge extraction from mixed manual content. The design choices map directly to those goals.

- Accuracy: every answer starts with retrieval.
- Multimodality: visual tool calls are extensive
- Helpfulness: the system prompt biases toward practical, garage-side language.
- Trust: every visual and text answer ties back to specific source pages.

## How The Agent Works

### 1. User question enters the chat app

The UI is a single-screen workspace built in Next.js. It supports:

- streamed model responses
- inline rendered artifacts
- source cards under each answer
- BYOK via a locally stored Anthropic API key

If no local key is entered in the UI, the app falls back to `ANTHROPIC_API_KEY` on the server.

### 2. The server runs a grounded Claude workflow

The chat route streams events from the server and calls the agent runtime in `lib/agent/answer-question.ts`.

The system prompt forces this sequence:

1. search the manuals first
2. optionally fetch full page content for deeper context
3. answer only from retrieved evidence
4. call a visual tool whenever the question is better explained visually
5. cite the supporting pages in the final answer

### 3. The model uses retrieval tools before responding

The agent has two retrieval tools:

- `search_manual`
- `get_page_content`

 `search_manual` is fast and broad. `get_page_content` is a second pass when the top chunk is relevant but incomplete.

### 4. The model can call visual tools


- `render_duty_cycle`
- `render_polarity_setup`
- `render_troubleshooting`
- `render_setup_guide`
- `render_weld_diagnosis`
- `render_settings_advisor`

 Each artifact carries source page references so the UI can jump the reviewer back to the manual evidence.

### 5. The frontend renders artifacts and source links inline

Artifacts are rendered inside the conversation itself=

The app supports:

- React artifacts for interactive widgets
- SVG artifacts for diagrams
- Mermaid for flowcharts
- HTML artifacts for richer single-file visuals
- Markdown artifacts for structured documents

## Knowledge Extraction And Representation

The core knowledge base is built offline from the source PDFs in `files/`.

### Extraction pipeline

The ingest script uses `pdfjs-dist` to parse each page and produce:

- raw text items with coordinates
- reconstructed lines
- page-level metadata
- overlapping retrieval chunks

Each page is classified into a source kind using heuristics:

- `text`
- `table`
- `diagram`
- `chart`
- `photo`

That source type is then used during reranking so the retriever can favor the right kind of evidence for the question being asked. Duty cycle questions should lean toward tables. Polarity questions should lean toward diagrams. Troubleshooting questions often benefit from diagnosis/photo-style pages.

### Representation

The generated knowledge base stores:

- manual manifest metadata
- page records with dimensions and text geometry
- chunk records used for retrieval

At runtime, the app loads `data/manual/knowledge-base.json` directly into memory and builds:

- a `MiniSearch` lexical index
- a page map for exact manual-page lookup
- an IDF map for BM25-style scoring

### Retrieval strategy

Retrieval is hybrid.

The ranking stack combines:

- MiniSearch lexical retrieval
- BM25-style term scoring
- n-gram overlap scoring
- numeric matching for values like `120V`, `240V`, `200A`
- metadata boosts for title, process, voltage, and source type relevance

Then the results are deduplicated down to page-level hits so the agent gets a compact set of grounded sources rather than many overlapping chunks from the same page.

## Source Experience

One requirement I cared about was making citations actually useful.

Each answer includes source cards that:

- show the cited manual and page number
- render an inline preview of the referenced page
- expand in place for a larger view
- open a dedicated source page with highlight overlays
- link directly to the raw PDF page

## Deployment Notes

The app is deployed here:

- https://prox-challenge.vercel.app/


### Requirements

- Node.js 20+
- npm
- one Anthropic API key

### Run locally

```bash
git clone https://github.com/AbhinavMalkoochi/prox-challenge.git
cd prox-challenge
npm install
cp .env.example .env
# add your Anthropic key to .env
npm run dev
```

Then open `http://localhost:3000`.

### Environment

Server-side key:

```bash
ANTHROPIC_API_KEY=your_key_here
```

You can also use BYOK in the UI by opening the key button in the header and pasting an Anthropic key into the local key field.

## Regenerating The Knowledge Base

The checked-in knowledge base is already generated, so cloning and running the app does not require an ingest step.

If you want to rebuild it from the PDFs:

```bash
npm run ingest
```

That regenerates the derived files in `data/manual/`.

## Useful Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run ingest
```

## Repo Map

- `app/`: Next.js routes and API handlers
- `components/chat/`: chat UI, artifact rendering, source cards
- `components/source/`: dedicated source-page viewer
- `lib/agent/`: Claude orchestration and visual tool builders
- `lib/knowledge/`: ingestion, indexing, search, highlights, source lookup
- `files/`: original manual PDFs used for ingestion
- `public/manuals/`: statically served PDFs for the deployed app
- `data/manual/`: generated knowledge base artifacts

## Design Tradeoffs

### What I optimized for

- grounded answers over open-ended verbosity
- reliable visuals for repeated question types
- reviewable citations over black-box confidence
- fast evaluator setup over complex infrastructure

### What I did not optimize for

- multi-product generalization
- agentic browsing outside the manual corpus
- autonomous long-running workflows

## Example Questions To Try

- What polarity do I need for TIG welding?
- Duty cycle for MIG at 200A on 240V?
- I’m getting porosity in my flux-cored welds. What should I check?
- Set up MIG for 1/8" mild steel on 240V. Include settings, polarity, duty cycle, and troubleshooting.
- Compare when I should use MIG, TIG, Stick, and Flux-Cored on this machine.

## Submission Checklist

This repo now aligns with the challenge requirements in the original prompt:

- frontend included
- hosted demo included
- clear README included
- single-key local run flow included
- multimodal responses included
- grounded manual citations included
