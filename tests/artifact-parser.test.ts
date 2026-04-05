import { describe, expect, it, vi } from "vitest";

import { ArtifactStreamParser } from "../lib/chat/artifact-parser";

function collect() {
  const texts: string[] = [];
  const artifacts: { identifier: string; type: string; title: string; content: string }[] = [];
  const parser = new ArtifactStreamParser({
    onText: (t) => texts.push(t),
    onArtifact: (a) => artifacts.push(a),
  });
  return { parser, texts, artifacts };
}

describe("ArtifactStreamParser", () => {
  it("passes plain text through onText", () => {
    const { parser, texts, artifacts } = collect();
    parser.feed("Hello world");
    parser.flush();
    expect(texts.join("")).toBe("Hello world");
    expect(artifacts).toHaveLength(0);
  });

  it("extracts a complete antArtifact", () => {
    const { parser, texts, artifacts } = collect();
    parser.feed(
      'Before <antArtifact identifier="test-id" type="image/svg+xml" title="Test SVG"><svg></svg></antArtifact> After'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].identifier).toBe("test-id");
    expect(artifacts[0].type).toBe("image/svg+xml");
    expect(artifacts[0].title).toBe("Test SVG");
    expect(artifacts[0].content).toBe("<svg></svg>");
    expect(texts.join("")).toContain("Before");
    expect(texts.join("")).toContain("After");
  });

  it("handles streaming char-by-char", () => {
    const { parser, texts, artifacts } = collect();
    const full =
      'Hi <antArtifact identifier="a" type="application/vnd.ant.mermaid" title="Flow">graph TD\n  A-->B</antArtifact> done';
    for (const ch of full) parser.feed(ch);
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe("graph TD\n  A-->B");
    expect(texts.join("")).toContain("Hi");
    expect(texts.join("")).toContain("done");
  });

  it("strips antthinking tags", () => {
    const { parser, texts, artifacts } = collect();
    parser.feed("<antthinking>internal thoughts</antthinking>Hello");
    parser.flush();
    expect(texts.join("")).toBe("Hello");
    expect(texts.join("")).not.toContain("internal thoughts");
    expect(artifacts).toHaveLength(0);
  });

  it("handles multiple artifacts in sequence", () => {
    const { parser, artifacts } = collect();
    parser.feed(
      '<antArtifact identifier="a1" type="image/svg+xml" title="First"><svg>1</svg></antArtifact>' +
      'middle' +
      '<antArtifact identifier="a2" type="application/vnd.ant.mermaid" title="Second">graph TD</antArtifact>'
    );
    parser.flush();
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].identifier).toBe("a1");
    expect(artifacts[1].identifier).toBe("a2");
  });

  it("handles </artifact> as alternate closing tag", () => {
    const { parser, artifacts } = collect();
    parser.feed(
      '<antArtifact identifier="x" type="text/html" title="Test">content</artifact>'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe("content");
  });

  it("handles case-insensitive tags", () => {
    const { parser, artifacts } = collect();
    parser.feed(
      '<antArtifact identifier="x" type="image/svg+xml" title="SVG"><svg/></antArtifact>'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
  });

  it("handles bare <artifact > open tag", () => {
    const { parser, artifacts } = collect();
    parser.feed(
      '<artifact identifier="x" type="image/svg+xml" title="SVG"><svg/></antArtifact>'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe("<svg/>");
  });

  it("flush discards thinking content without leaking", () => {
    const { parser, texts } = collect();
    parser.feed("<antthinking>thinking...");
    parser.flush();
    expect(texts.join("")).toBe("");
  });

  it("flush discards tag buffer without leaking", () => {
    const { parser, texts } = collect();
    parser.feed('<antArtifact identifier="x" type="image/svg+xml"');
    parser.flush();
    expect(texts.join("")).not.toContain("antArtifact");
    expect(texts.join("")).not.toContain("identifier");
  });

  it("flush emits incomplete artifact content as text", () => {
    const { parser, texts, artifacts } = collect();
    parser.feed('<antArtifact identifier="x" type="image/svg+xml" title="T">partial content');
    parser.flush();
    expect(artifacts).toHaveLength(0);
    expect(texts.join("")).toContain("partial content");
  });

  it("handles multiline artifact content", () => {
    const { parser, artifacts } = collect();
    const mermaidContent = "graph TD\n  A[Start] --> B{Check}\n  B -->|Yes| C[Do]\n  B -->|No| D[Skip]";
    parser.feed(
      `<antArtifact identifier="flow" type="application/vnd.ant.mermaid" title="Flow">${mermaidContent}</antArtifact>`
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe(mermaidContent);
  });

  it("handles artifact with language attribute", () => {
    const { parser, artifacts } = collect();
    parser.feed(
      '<antArtifact identifier="code" type="application/vnd.ant.code" title="Code" language="python">print("hello")</antArtifact>'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].language).toBe("python");
  });

  it("handles artifact mixed with thinking blocks", () => {
    const { parser, texts, artifacts } = collect();
    parser.feed(
      '<antthinking>Let me think</antthinking>Intro <antArtifact identifier="a" type="image/svg+xml" title="SVG"><svg/></antArtifact> Outro'
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    const combined = texts.join("");
    expect(combined).toContain("Intro");
    expect(combined).toContain("Outro");
    expect(combined).not.toContain("Let me think");
  });

  it("handles large content without performance issues", () => {
    const { parser, artifacts } = collect();
    const bigContent = "x".repeat(10000);
    parser.feed(
      `<antArtifact identifier="big" type="text/html" title="Big">${bigContent}</antArtifact>`
    );
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe(bigContent);
  });

  it("handles chunked delivery across tag boundaries", () => {
    const { parser, artifacts } = collect();
    parser.feed('<antArti');
    parser.feed('fact identifier="x" type="image/svg+xml" title="T">');
    parser.feed('content');
    parser.feed('</antArt');
    parser.feed('ifact>');
    parser.flush();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].content).toBe("content");
  });
});
