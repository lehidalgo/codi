/**
 * CORE-007 — purity contract for `resolveConflicts`.
 *
 * The legacy implementation mutated `process.exitCode` (a global side
 * effect invisible to callers) and rewrote `conflict.incomingContent`
 * on the input entries (input mutation). Both behaviours leaked state
 * across composition boundaries, hid failure modes from tests, and
 * meant that any caller forgetting to inspect `process.exitCode` would
 * silently miss unresolvable conflicts.
 *
 * Post-CORE-007:
 *   - `resolveConflicts` MUST NOT touch `process.exitCode`. Callers
 *     read `resolution.unresolvable[]` and map it to an exit code.
 *   - Input entries MUST NOT be mutated. Merged content is returned
 *     via newly-constructed `ConflictEntry` objects in `merged[]`.
 *
 * These invariants are enforced here. Regressions also fail the
 * `guard-no-process-exit-in-utils.mjs` script at lint time.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { makeConflictEntry, resolveConflicts } from "#src/utils/conflict-resolver.js";

describe("resolveConflicts purity (CORE-007)", () => {
  let originalIsTTY: boolean | undefined;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
    originalExitCode = process.exitCode as number | undefined;
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    process.exitCode = originalExitCode;
  });

  it("does NOT mutate process.exitCode when unresolvable conflicts exist (sentinel test)", async () => {
    // Sentinel value chosen so the test fails for both the legacy
    // `process.exitCode = 2` write AND any other accidental write
    // (e.g. resetting to 0). Any post-call value other than the
    // sentinel is a regression.
    const SENTINEL = 99;
    process.exitCode = SENTINEL;

    const conflict = makeConflictEntry(
      "rules/foo",
      "/tmp/foo.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );
    const resolution = await resolveConflicts([conflict]);

    expect(process.exitCode).toBe(SENTINEL);
    // Sanity: the conflict really was hard (otherwise the sentinel
    // test is meaningless because no side effect could fire).
    expect(resolution.unresolvable).toHaveLength(1);
  });

  it("does NOT mutate process.exitCode when conflicts are clean auto-merges", async () => {
    const SENTINEL = 77;
    process.exitCode = SENTINEL;

    const conflict = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal\n",
      "# Safe\n\nOriginal\n\n## New\nAdded\n",
    );
    const resolution = await resolveConflicts([conflict]);

    expect(process.exitCode).toBe(SENTINEL);
    expect(resolution.merged).toHaveLength(1);
    expect(resolution.unresolvable).toHaveLength(0);
  });

  it("does NOT mutate input ConflictEntry.incomingContent (frozen-input test)", async () => {
    const originalIncoming = "# Safe\n\nOriginal\n\n## New\nAdded\n";
    const conflict = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal\n",
      originalIncoming,
    );
    Object.freeze(conflict); // would throw TypeError on any property reassignment

    const resolution = await resolveConflicts([conflict]);

    expect(conflict.incomingContent).toBe(originalIncoming);
    // The merged entry must be a NEW object (copy-on-write). Its
    // `incomingContent` may equal the original when buildConflictMarkers
    // returns the same merged string verbatim (pure-addition case), so we
    // only assert object identity here, not value inequality.
    expect(resolution.merged[0]).not.toBe(conflict);
  });

  it("does NOT mutate input on unionMerge path", async () => {
    const originalIncoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry(
      "rules/foo",
      "/tmp/foo.md",
      "line1\nUSER-VERSION\nline3\n",
      originalIncoming,
    );
    Object.freeze(conflict);

    const resolution = await resolveConflicts([conflict], { unionMerge: true });

    expect(conflict.incomingContent).toBe(originalIncoming);
    expect(conflict.hasMarkers).toBeUndefined();
    expect(resolution.merged[0]).not.toBe(conflict);
    expect(resolution.merged[0]!.hasMarkers).toBe(true);
  });

  it("does NOT mutate input on force / keepCurrent paths", async () => {
    const originalIncoming = "## new content\n";
    const c1 = makeConflictEntry("a", "/tmp/a.md", "## old\n", originalIncoming);
    const c2 = makeConflictEntry("b", "/tmp/b.md", "## old\n", originalIncoming);
    Object.freeze(c1);
    Object.freeze(c2);

    await resolveConflicts([c1], { force: true });
    await resolveConflicts([c2], { keepCurrent: true });

    expect(c1.incomingContent).toBe(originalIncoming);
    expect(c2.incomingContent).toBe(originalIncoming);
  });
});
