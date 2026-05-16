import { describe, it, expect } from "vitest";
import { SECURITY_PATTERNS } from "#src/runtime/hooks/security-reminder/patterns.js";

describe("SECURITY_PATTERNS", () => {
  it("contains the nine canonical rules", () => {
    const ids = SECURITY_PATTERNS.map((p) => p.ruleId).sort();
    expect(ids).toEqual([
      "child-process-exec",
      "dangerously-set-html",
      "document-write",
      "eval-call",
      "gha-injection",
      "inner-html-assign",
      "new-function",
      "os-system",
      "pickle-deserialize",
    ]);
  });

  it("each pattern has either substrings or pathPredicate", () => {
    for (const p of SECURITY_PATTERNS) {
      const hasSubstring = p.kind === "substring" && (p.substrings?.length ?? 0) > 0;
      const hasPath = p.kind === "path" && typeof p.pathPredicate === "function";
      expect(hasSubstring || hasPath).toBe(true);
    }
  });

  it("pickle and os-system constrain to .py", () => {
    const pickle = SECURITY_PATTERNS.find((p) => p.ruleId === "pickle-deserialize");
    const osSystem = SECURITY_PATTERNS.find((p) => p.ruleId === "os-system");
    expect(pickle?.allowedExtensions).toEqual([".py"]);
    expect(osSystem?.allowedExtensions).toEqual([".py"]);
  });

  it("dangerously-set-html constrains to jsx/tsx", () => {
    const r = SECURITY_PATTERNS.find((p) => p.ruleId === "dangerously-set-html");
    expect(r?.allowedExtensions).toEqual([".jsx", ".tsx"]);
  });

  it("each pattern has a non-empty reminder and suggestedAction", () => {
    for (const p of SECURITY_PATTERNS) {
      expect(p.reminder.length).toBeGreaterThan(20);
      expect(p.suggestedAction.length).toBeGreaterThan(10);
    }
  });

  it("gha-injection uses path predicate, not substrings", () => {
    const gha = SECURITY_PATTERNS.find((p) => p.ruleId === "gha-injection");
    expect(gha?.kind).toBe("path");
    expect(gha?.pathPredicate?.(".github/workflows/build.yml")).toBe(true);
    expect(gha?.pathPredicate?.("src/foo.ts")).toBe(false);
  });
});
