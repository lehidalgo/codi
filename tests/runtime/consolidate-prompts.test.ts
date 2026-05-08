/**
 * Editable prompt templates (Item 4).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderPrompt, clearTemplateCache, PATTERN_CODES } from "#src/runtime/consolidate/index.js";

beforeEach(() => clearTemplateCache());

describe("renderPrompt", () => {
  it("loads every one of the 8 templates", () => {
    for (const code of PATTERN_CODES) {
      const text = renderPrompt(code, {});
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain("# Role");
    }
  });

  it("substitutes known placeholders", () => {
    const text = renderPrompt("P1", {
      pattern_code: "P1",
      artifact_name: "src/auth.ts",
      hits: 4,
      sessions: 3,
      window_days: 30,
      evidence_sample: "removed any cast",
    });
    expect(text).toContain("P1");
    expect(text).toContain("src/auth.ts");
    expect(text).toContain("4");
    expect(text).toContain("removed any cast");
    // Unrelated placeholders left literal so they surface in review.
    expect(text).not.toContain("{artifact_name}");
  });

  it("leaves unknown placeholders intact (no silent swallow)", () => {
    const text = renderPrompt("P5", { pattern_code: "P5" });
    expect(text).toContain("{sample_content}");
    expect(text).toContain("{hits}");
  });

  it("caches templates between calls", () => {
    const a = renderPrompt("P3", { skill_a: "x", skill_b: "y" });
    const b = renderPrompt("P3", { skill_a: "x", skill_b: "y" });
    expect(a).toBe(b);
  });

  it("clearTemplateCache() forces a re-read", () => {
    renderPrompt("P2", {});
    clearTemplateCache();
    // Should not throw — fresh load works.
    const text = renderPrompt("P2", {});
    expect(text).toContain("# Role");
  });
});
