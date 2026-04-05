import type { ChatStreamEvent } from "@/lib/chat/types";

export function parseStreamChunk(buffer: string): {
  events: ChatStreamEvent[];
  remainder: string;
} {
  const events: ChatStreamEvent[] = [];
  let remainder = buffer;
  let boundaryIndex = remainder.indexOf("\n\n");

  while (boundaryIndex >= 0) {
    const rawEvent = remainder.slice(0, boundaryIndex).trim();
    remainder = remainder.slice(boundaryIndex + 2);

    if (rawEvent) {
      const payload = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (payload) {
        events.push(JSON.parse(payload) as ChatStreamEvent);
      }
    }

    boundaryIndex = remainder.indexOf("\n\n");
  }

  return { events, remainder };
}
