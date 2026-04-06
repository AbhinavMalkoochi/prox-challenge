import { answerQuestion } from "@/lib/agent/answer-question";
import type { ChatRequest, ChatStreamEvent } from "@/lib/chat/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function createEventChunk(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-api-key") ?? undefined;
  const apiKey = clientKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "No API key provided. Enter your Anthropic API key to get started." },
      { status: 401 }
    );
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "Question is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(createEventChunk(event)));
      };

      try {
        const response = await answerQuestion({
          question,
          history: body.history ?? [],
          apiKey,
          signal: request.signal,
          onStatus: (status) => send({ type: "status", status }),
          onTextDelta: (delta) => send({ type: "text-delta", delta }),
          onArtifact: (artifact) => send({ type: "artifact", artifact }),
        });

        send({ type: "final", response });
        send({ type: "done" });
      } catch (error) {
        send({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "The agent could not answer the question.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
