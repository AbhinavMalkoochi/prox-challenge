import { answerQuestion } from "@/lib/agent/answer-question";
import type { ChatRequest, ChatStreamEvent } from "@/lib/chat/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function createEventChunk(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not configured. Copy .env.example to .env and add your key.",
      },
      { status: 500 }
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
          signal: request.signal,
          onStatus: async (status) => {
            send({ type: "status", status });
          },
          onTextDelta: async (delta) => {
            send({ type: "text-delta", delta });
          },
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
