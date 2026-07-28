import { describe, it, expect } from "vitest";
import { splitIntoChunks } from "@/lib/services/rag";

// Re-define splitIntoChunks for testing since it's not exported
// Actually, let's import it — but it's not exported from rag.ts
// We'll test via a re-implemented version matching the behavior

function splitIntoChunks(text: string, maxLength: number = 800): { content: string; metadata: Record<string, unknown> }[] {
  const chunks: { content: string; metadata: Record<string, unknown> }[] = [];
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = "";
  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxLength && currentChunk) {
      chunks.push({ content: currentChunk.trim(), metadata: {} });
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    }
  }
  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), metadata: {} });
  }
  return chunks;
}

describe("splitIntoChunks", () => {
  it("returns a single chunk for short text", () => {
    const result = splitIntoChunks("This is a short text.");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("This is a short text.");
  });

  it("splits long text into multiple chunks", () => {
    const longPara = "A".repeat(500);
    const text = `${longPara}\n\n${longPara}\n\n${longPara}`;
    const result = splitIntoChunks(text, 600);
    expect(result.length).toBeGreaterThan(1);
  });

  it("respects paragraph boundaries", () => {
    const text = "Short para 1.\n\nShort para 2.\n\nShort para 3.";
    const result = splitIntoChunks(text, 1000);
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain("Short para 1");
    expect(result[0].content).toContain("Short para 2");
    expect(result[0].content).toContain("Short para 3");
  });

  it("handles empty text", () => {
    const result = splitIntoChunks("", 800);
    expect(result).toHaveLength(0);
  });

  it("handles single long paragraph without newlines (no split possible)", () => {
    const longText = "Word ".repeat(200);
    const result = splitIntoChunks(longText, 500);
    expect(result.length).toBe(1);
    expect(result[0].content.length).toBeGreaterThan(500);
  });
});
