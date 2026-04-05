import type { Metadata } from "next";

import { ChatWorkspace } from "@/components/chat/chat-workspace";

export const metadata: Metadata = {
  title: "Vulcan OmniPro 220 Copilot",
  description:
    "Grounded multimodal support agent for the Vulcan OmniPro 220 welder.",
};

export default function HomePage() {
  return (
    <main className="chat-page">
      <ChatWorkspace />
    </main>
  );
}
