"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { parseStreamChunk } from "@/lib/chat/stream";
import type {
  Artifact,
  ChatAnswer,
  ChatStreamEvent,
  Citation,
} from "@/lib/chat/types";

type MessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  artifact: Artifact | null;
};

const SUGGESTIONS = [
  "What polarity do I need for TIG welding?",
  "Duty cycle for MIG at 200A on 240V?",
  "I'm getting porosity in my welds",
  "Compare MIG vs flux-cored",
];

function CitationLinks({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="citation-list">
      {citations.map((citation, index) => (
        <Link
          className="citation-link"
          href={`/source/${citation.manualId}/${citation.pageNumber}?quote=${encodeURIComponent(citation.excerpt)}`}
          key={`${citation.manualId}-${citation.pageNumber}-${index}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          p.{citation.pageNumber} — {citation.title ?? citation.manualId}
        </Link>
      ))}
    </div>
  );
}

function updateMessage(
  messages: MessageRecord[],
  id: string,
  updater: (message: MessageRecord) => MessageRecord
): MessageRecord[] {
  return messages.map((m) => (m.id === id ? updater(m) : m));
}

export function ChatWorkspace() {
  const [draft, setDraft] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  async function askQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isPending) return;

    const userMsg: MessageRecord = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      citations: [],
      artifact: null,
    };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: MessageRecord = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      artifact: null,
    };

    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, assistantPlaceholder]);
    setDraft("");
    setIsPending(true);
    setStatus("Connecting");
    scrollToBottom();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: nextMessages
            .filter((m) => m.id !== "intro")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const payload = (await response.json()) as
          | ChatAnswer
          | { error: string };
        if (!response.ok || "error" in payload) {
          throw new Error(
            "error" in payload ? payload.error : "Request failed."
          );
        }
        setMessages((cur) =>
          updateMessage(cur, assistantId, (m) => ({
            ...m,
            content: payload.answer,
            citations: payload.citations,
            artifact: payload.mode === "answer" ? payload.artifact : null,
          }))
        );
        return;
      }

      if (!response.body) throw new Error("Empty response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const parsed = parseStreamChunk(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          if (event.type === "status") {
            setStatus(event.status);
            continue;
          }
          if (event.type === "text-delta") {
            setStatus(null);
            setMessages((cur) =>
              updateMessage(cur, assistantId, (m) => ({
                ...m,
                content: `${m.content}${event.delta}`,
              }))
            );
            scrollToBottom();
            continue;
          }
          if (event.type === "final") {
            setMessages((cur) =>
              updateMessage(cur, assistantId, (m) => ({
                ...m,
                content: event.response.answer,
                citations: event.response.citations,
                artifact:
                  event.response.mode === "answer"
                    ? event.response.artifact
                    : null,
              }))
            );
            continue;
          }
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "done") setStatus(null);
        }

        if (done) break;
      }
    } catch (error) {
      setStatus(null);
      setMessages((cur) =>
        updateMessage(cur, assistantId, (m) => ({
          ...m,
          content:
            error instanceof Error
              ? error.message
              : "The agent could not answer that question.",
          citations: [],
          artifact: null,
        }))
      );
    } finally {
      setIsPending(false);
      setStatus(null);
      scrollToBottom();
    }
  }

  return (
    <>
      <header className="app-header">
        <h1>Vulcan OmniPro 220</h1>
        <span className="badge">Copilot</span>
      </header>

      <section className="chat-app-shell">
        <div className="thread-panel" ref={threadRef}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>What can I help you with?</h2>
              <p>
                Ask about polarity setup, duty cycles, troubleshooting,
                recommended settings, or anything in the owner&apos;s manual.
              </p>
              <div className="suggestion-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    className="suggestion-chip"
                    key={s}
                    onClick={() => void askQuestion(s)}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((msg) => (
                <div
                  className={`message-card ${msg.role}`}
                  key={msg.id}
                >
                  <span className="message-label">
                    {msg.role === "user" ? "You" : "Copilot"}
                  </span>
                  <p className="message-content">
                    {msg.content ||
                      (msg.role === "assistant" && isPending ? " " : "")}
                  </p>
                  {msg.role === "assistant" && (
                    <ArtifactPanel
                      artifact={msg.artifact}
                      showEmptyState={false}
                    />
                  )}
                  <CitationLinks citations={msg.citations} />
                </div>
              ))}
            </div>
          )}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void askQuestion(draft);
          }}
        >
          <div className="composer-bar">
            <input
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void askQuestion(draft);
                }
              }}
              placeholder="Ask about the Vulcan OmniPro 220..."
              type="text"
              value={draft}
            />
            <button
              className="send-button"
              disabled={isPending || !draft.trim()}
              type="submit"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
          <div className="composer-status">{status ?? "\u00a0"}</div>
        </form>
      </section>
    </>
  );
}
