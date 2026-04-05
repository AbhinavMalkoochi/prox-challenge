import type { AntArtifact } from "./types";

export type ArtifactParserCallbacks = {
  onText: (text: string) => void;
  onArtifact: (artifact: AntArtifact) => void;
};

/**
 * Streaming parser that extracts <antArtifact> and strips <antthinking>
 * tags from Claude's text output. All other text passes through to onText.
 * Complete artifacts are emitted via onArtifact.
 */
export class ArtifactStreamParser {
  private buffer = "";
  private mode: "text" | "thinking" | "tag" | "content" = "text";
  private tagStr = "";
  private artifactContent = "";
  private meta: Pick<AntArtifact, "identifier" | "type" | "title" | "language"> | null = null;
  private cb: ArtifactParserCallbacks;

  constructor(cb: ArtifactParserCallbacks) {
    this.cb = cb;
  }

  feed(chunk: string) {
    this.buffer += chunk;
    this.drain();
  }

  flush() {
    if (this.buffer) {
      this.cb.onText(this.buffer);
      this.buffer = "";
    }
    if (this.artifactContent) {
      this.cb.onText(this.artifactContent);
      this.artifactContent = "";
    }
    this.mode = "text";
  }

  private drain() {
    let guard = 500;
    while (this.buffer.length > 0 && --guard > 0) {
      let advanced = false;
      switch (this.mode) {
        case "text":
          advanced = this.drainText();
          break;
        case "thinking":
          advanced = this.drainThinking();
          break;
        case "tag":
          advanced = this.drainTag();
          break;
        case "content":
          advanced = this.drainContent();
          break;
      }
      if (!advanced) return;
    }
  }

  private lower() {
    return this.buffer.toLowerCase();
  }

  private drainText(): boolean {
    const low = this.lower();
    const thinkIdx = low.indexOf("<antthinking");
    const antArtIdx = low.indexOf("<antartifact");
    const bareArtIdx = low.indexOf("<artifact ");

    let artifactIdx = -1;
    if (antArtIdx >= 0 && bareArtIdx >= 0) {
      artifactIdx = Math.min(antArtIdx, bareArtIdx);
    } else if (antArtIdx >= 0) {
      artifactIdx = antArtIdx;
    } else {
      artifactIdx = bareArtIdx;
    }

    let idx = -1;
    let isThinking = false;
    if (thinkIdx >= 0 && (artifactIdx < 0 || thinkIdx < artifactIdx)) {
      idx = thinkIdx;
      isThinking = true;
    } else if (artifactIdx >= 0) {
      idx = artifactIdx;
    }

    if (idx < 0) {
      const partial = this.partialOpen();
      if (partial >= 0) {
        if (partial > 0) this.cb.onText(this.buffer.slice(0, partial));
        this.buffer = this.buffer.slice(partial);
        return false;
      }
      this.cb.onText(this.buffer);
      this.buffer = "";
      return false;
    }

    if (idx > 0) this.cb.onText(this.buffer.slice(0, idx));
    this.buffer = this.buffer.slice(idx);

    if (isThinking) {
      const tagClose = this.buffer.indexOf(">");
      if (tagClose < 0) return false;
      this.buffer = this.buffer.slice(tagClose + 1);
      this.mode = "thinking";
    } else {
      this.tagStr = "";
      this.mode = "tag";
    }
    return true;
  }

  private drainThinking(): boolean {
    const end = this.lower().indexOf("</antthinking>");
    if (end < 0) {
      const partial = this.partialClose("</antthinking>");
      if (partial >= 0) {
        this.buffer = this.buffer.slice(partial);
        return false;
      }
      this.buffer = "";
      return false;
    }
    this.buffer = this.buffer.slice(end + "</antthinking>".length);
    this.mode = "text";
    return true;
  }

  private drainTag(): boolean {
    const end = this.buffer.indexOf(">");
    if (end < 0) return false;
    this.tagStr = this.buffer.slice(0, end + 1);
    this.buffer = this.buffer.slice(end + 1);
    this.meta = this.parseAttrs(this.tagStr);
    this.artifactContent = "";
    this.mode = "content";
    return true;
  }

  private drainContent(): boolean {
    const low = this.lower();
    const closeTags = ["</antartifact>", "</artifact>", "</mermaid>"];
    let end = -1;
    let closeLen = 0;
    for (const tag of closeTags) {
      const idx = low.indexOf(tag);
      if (idx >= 0 && (end < 0 || idx < end)) {
        end = idx;
        closeLen = tag.length;
      }
    }

    if (end < 0) {
      const partial = this.partialCloseArtifact();
      if (partial >= 0) {
        this.artifactContent += this.buffer.slice(0, partial);
        this.buffer = this.buffer.slice(partial);
        return false;
      }
      this.artifactContent += this.buffer;
      this.buffer = "";
      return false;
    }

    this.artifactContent += this.buffer.slice(0, end);
    this.buffer = this.buffer.slice(end + closeLen);

    if (this.meta) {
      this.cb.onArtifact({
        identifier: this.meta.identifier,
        type: this.meta.type,
        title: this.meta.title,
        language: this.meta.language,
        content: this.artifactContent.trim(),
      });
    }

    this.meta = null;
    this.artifactContent = "";
    this.mode = "text";
    return true;
  }

  private partialCloseArtifact(): number {
    const tags = ["</antartifact>", "</artifact>", "</mermaid>"];
    const low = this.lower();
    for (const tag of tags) {
      for (let len = 2; len < tag.length && len <= low.length; len++) {
        if (low.endsWith(tag.slice(0, len))) {
          return this.buffer.length - len;
        }
      }
    }
    return -1;
  }

  private partialOpen(): number {
    const tags = ["<antthinking", "<antartifact", "<artifact "];
    const low = this.lower();
    for (const tag of tags) {
      for (let len = 2; len < tag.length && len <= low.length; len++) {
        if (low.endsWith(tag.slice(0, len))) {
          return this.buffer.length - len;
        }
      }
    }
    return -1;
  }

  private partialClose(closeTag: string): number {
    const low = this.lower();
    for (let len = 1; len < closeTag.length && len <= low.length; len++) {
      if (low.endsWith(closeTag.slice(0, len))) {
        return this.buffer.length - len;
      }
    }
    return -1;
  }

  private parseAttrs(tag: string): Pick<AntArtifact, "identifier" | "type" | "title" | "language"> {
    const get = (name: string) => {
      const m = tag.match(new RegExp(`${name}="([^"]*)"`));
      return m?.[1] ?? "";
    };
    return {
      identifier: get("identifier") || "artifact",
      type: get("type") || "text/plain",
      title: get("title") || "Artifact",
      language: get("language") || undefined,
    };
  }
}
