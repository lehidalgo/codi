import { describe, it, expect } from "vitest";
import { normalizeTitle, dedupCandidates } from "#src/brain-client/dedup.js";
import type { ExtractionCandidate } from "#src/brain-client/types.js";

function cand(title: string): ExtractionCandidate {
  return {
    title,
    body: "",
    tags: [],
    evidence_quote: "",
    confidence: 0.9,
    type: "decision",
  };
}

describe("dedup", () => {
  it("normalizeTitle lowercases and collapses whitespace", () => {
    expect(normalizeTitle("  Use  Gemini  ")).toBe("use gemini");
    expect(normalizeTitle("USE\tGEMINI\nFOR\nGENERATION")).toBe("use gemini for generation");
  });

  it("skips candidates whose normalized title is in the existing set", () => {
    const cands = [cand("Use Gemini"), cand("Something unique")];
    const existing = new Set(["use gemini"]);
    const result = dedupCandidates(cands, existing);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Something unique");
  });

  it("returns all candidates when existing set is empty", () => {
    const cands = [cand("a"), cand("b")];
    const result = dedupCandidates(cands, new Set());
    expect(result).toHaveLength(2);
  });
});
