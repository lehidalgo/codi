import { describe, it, expect } from "vitest";
import vm from "node:vm";
import {
  buildBrainSessionStartScript,
  buildBrainStopScript,
  buildBrainPostCommitScript,
  BRAIN_SESSION_START_FILENAME,
  BRAIN_STOP_FILENAME,
  BRAIN_POST_COMMIT_FILENAME,
} from "#src/core/hooks/brain-hooks.js";

describe("brain hook builders", () => {
  it("filenames follow codi-brain-* convention", () => {
    expect(BRAIN_SESSION_START_FILENAME).toBe("codi-brain-session-start.cjs");
    expect(BRAIN_STOP_FILENAME).toBe("codi-brain-stop.cjs");
    expect(BRAIN_POST_COMMIT_FILENAME).toBe("codi-brain-post-commit.cjs");
  });

  it("SessionStart script: shebang + /hot + outbox-flush + additionalContext", () => {
    const s = buildBrainSessionStartScript();
    expect(s).toMatch(/^#!\/usr\/bin\/env node/);
    expect(s).toContain("/hot");
    expect(s).toContain("brain-outbox");
    expect(s).toContain("additionalContext");
  });

  it("Stop script: shebang + parses markers + supports opt-in extraction", () => {
    const s = buildBrainStopScript();
    expect(s).toMatch(/^#!\/usr\/bin\/env node/);
    expect(s).toContain("CODI-DECISION");
    expect(s).toContain("auto_extract");
    expect(s).toContain("evidence_quote");
  });

  it("Stop script: Gemini require is inside the extract() function (not top-level)", () => {
    const s = buildBrainStopScript();
    const idx = s.indexOf("@google/generative-ai");
    expect(idx).toBeGreaterThan(0);
    // Assert the most recent `function` declaration before the require is
    // `async function extract(` — confirms the require is inside that
    // function body, so it only executes when extract() is called.
    const before = s.slice(0, idx);
    const lastFn = before.lastIndexOf("function ");
    expect(lastFn).toBeGreaterThan(0);
    expect(before.slice(lastFn)).toMatch(/function\s+extract\s*\(/);
    // And extract() is only called from under the auto_extract gate:
    // use `await extract(` to hit the call site, not the `function extract(` declaration.
    const extractCallIdx = s.indexOf("await extract(");
    expect(extractCallIdx).toBeGreaterThan(0);
    const beforeCall = s.slice(0, extractCallIdx);
    expect(beforeCall).toMatch(/if\s*\(\s*cfg\.autoExtract/);
  });

  it("PostCommit script: shebang + /vault/reconcile", () => {
    const s = buildBrainPostCommitScript();
    expect(s).toMatch(/^#!\/usr\/bin\/env node/);
    expect(s).toContain("/vault/reconcile");
  });

  it("all three scripts compile as Node (syntax check)", () => {
    for (const s of [
      buildBrainSessionStartScript(),
      buildBrainStopScript(),
      buildBrainPostCommitScript(),
    ]) {
      expect(() => new vm.Script(s)).not.toThrow();
    }
  });
});
