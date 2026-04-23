import { describe, it, expect, vi } from "vitest";
import { extractWithGemini, type GeminiModelLike } from "#src/brain-client/extractor.js";

function fakeModel(rawResponse: string): GeminiModelLike {
  return {
    generateContent: vi.fn().mockResolvedValue({ response: { text: () => rawResponse } }),
  };
}

describe("extractWithGemini", () => {
  it("returns candidates parsed from model structured output", async () => {
    const model = fakeModel(
      JSON.stringify({
        candidates: [
          {
            title: "Use Gemini",
            body: "cheaper",
            tags: ["llm"],
            evidence_quote: "let us use Gemini",
            confidence: 0.95,
            type: "decision",
          },
        ],
      }),
    );
    const candidates = await extractWithGemini({
      transcript: "let us use Gemini because it is cheaper",
      model,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("Use Gemini");
    expect(candidates[0].confidence).toBe(0.95);
  });

  it("SAFETY: forces confidence=0 when evidence_quote is not in transcript", async () => {
    const model = fakeModel(
      JSON.stringify({
        candidates: [
          {
            title: "Hallucinated",
            body: "",
            tags: [],
            evidence_quote: "a quote that does NOT appear anywhere",
            confidence: 0.99,
            type: "decision",
          },
        ],
      }),
    );
    const candidates = await extractWithGemini({
      transcript: "completely different content here",
      model,
    });
    expect(candidates[0].confidence).toBe(0);
  });

  it("evidence verification is whitespace- and case-insensitive", async () => {
    const model = fakeModel(
      JSON.stringify({
        candidates: [
          {
            title: "t",
            body: "",
            tags: [],
            evidence_quote: "LET   us\nuse gemini",
            confidence: 0.8,
            type: "decision",
          },
        ],
      }),
    );
    const candidates = await extractWithGemini({
      transcript: "user: let us use Gemini now",
      model,
    });
    expect(candidates[0].confidence).toBe(0.8);
  });

  it("returns empty on malformed model response", async () => {
    const model = fakeModel("not valid json");
    const candidates = await extractWithGemini({ transcript: "x", model });
    expect(candidates).toEqual([]);
  });

  it("returns empty when candidates is not an array", async () => {
    const model = fakeModel(JSON.stringify({ candidates: "string-not-array" }));
    const candidates = await extractWithGemini({ transcript: "x", model });
    expect(candidates).toEqual([]);
  });

  it("drops candidates missing required fields", async () => {
    const model = fakeModel(
      JSON.stringify({
        candidates: [
          {
            body: "no title",
            tags: [],
            evidence_quote: "x",
            confidence: 0.9,
            type: "decision",
          },
          {
            title: "missing type",
            body: "",
            tags: [],
            evidence_quote: "x",
            confidence: 0.9,
          },
        ],
      }),
    );
    const candidates = await extractWithGemini({ transcript: "x", model });
    expect(candidates).toHaveLength(0);
  });

  it("clamps confidence into [0,1]", async () => {
    const model = fakeModel(
      JSON.stringify({
        candidates: [
          {
            title: "t",
            body: "",
            tags: [],
            evidence_quote: "match",
            confidence: 2.5,
            type: "decision",
          },
        ],
      }),
    );
    const candidates = await extractWithGemini({
      transcript: "match this quote",
      model,
    });
    expect(candidates[0].confidence).toBe(1);
  });
});
