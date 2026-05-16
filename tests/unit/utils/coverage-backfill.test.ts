/**
 * CORE-029 — branch coverage backfill for `src/utils/**`.
 *
 * The dedicated unit tests for each utility module exercise their
 * happy paths and the common error branches; this file fills in the
 * less-trafficked corners (defensive fallbacks, alternate buffer
 * encodings, dead-end input shapes) so the `src/utils/**` branch
 * coverage threshold can climb from 92% to ≥95% without leaving
 * dead branches unmeasured.
 */
import { describe, it, expect } from "vitest";
import {
  ensureProjectContextAnchor,
  injectProjectContext,
} from "#src/utils/project-context-preserv.js";
import { PROJECT_CONTEXT_ANCHOR, PROJECT_CONTEXT_START } from "#src/constants.js";
import { execFileWithTimeout } from "#src/utils/exec.js";

describe("ensureProjectContextAnchor (CORE-029)", () => {
  it("returns input unchanged when PROJECT_CONTEXT_ANCHOR is already present", () => {
    const generated = `# Title\n\n${PROJECT_CONTEXT_ANCHOR}\n\n## Body\n`;
    expect(ensureProjectContextAnchor(generated)).toBe(generated);
  });

  it("returns input unchanged when PROJECT_CONTEXT_START is present (block already injected)", () => {
    // Inject a real block so PROJECT_CONTEXT_START appears verbatim.
    const block = injectProjectContext("## Body\n", `${PROJECT_CONTEXT_START}\nx`);
    expect(ensureProjectContextAnchor(block)).toBe(block);
  });

  it("prepends the anchor when neither anchor nor block is present", () => {
    const generated = "## Body\n\nContent.";
    const result = ensureProjectContextAnchor(generated);
    expect(result.startsWith(PROJECT_CONTEXT_ANCHOR)).toBe(true);
    expect(result).toContain("## Body");
    expect(result).toContain("Content.");
  });
});

describe("execFileWithTimeout — Buffer vs string branches (CORE-029)", () => {
  it("returns string stdout when encoding: 'utf-8' is requested", async () => {
    // Default encoding for execFile is "buffer"; pass utf-8 explicitly so
    // execFileAsync returns the string variant. Hits the
    // `typeof result.stdout === 'string'` true branch.
    const r = await execFileWithTimeout("node", ["-e", "console.log('hello')"], {
      timeoutMs: 5_000,
      encoding: "utf-8",
    });
    expect(typeof r.stdout).toBe("string");
    expect(r.stdout.trim()).toBe("hello");
  });

  it("returns string stdout when encoding is omitted (Buffer → toString branch)", async () => {
    // Without an explicit encoding, execFileAsync resolves with Buffer
    // for stdout/stderr. The wrapper coerces via `.toString()` — this
    // hits the `else` branch of the typeof guard.
    const r = await execFileWithTimeout("node", ["-e", "console.log('world')"], {
      timeoutMs: 5_000,
    });
    expect(typeof r.stdout).toBe("string");
    expect(r.stdout.trim()).toBe("world");
  });
});
