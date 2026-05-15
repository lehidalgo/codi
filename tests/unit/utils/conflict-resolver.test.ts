import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  UnresolvableConflictError,
  resolveConflicts,
  makeConflictEntry,
} from "#src/utils/conflict-resolver.js";

describe("UnresolvableConflictError", () => {
  it("stores file list on .files", () => {
    const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
    expect(err.files).toEqual(["rules/foo", "rules/bar"]);
  });

  it("includes all file names in message", () => {
    const err = new UnresolvableConflictError(["rules/foo", "rules/bar"]);
    expect(err.message).toContain("rules/foo");
    expect(err.message).toContain("rules/bar");
  });

  it("sets name to UnresolvableConflictError", () => {
    const err = new UnresolvableConflictError([]);
    expect(err.name).toBe("UnresolvableConflictError");
  });

  it("is an instance of Error", () => {
    const err = new UnresolvableConflictError(["rules/x"]);
    expect(err).toBeInstanceOf(Error);
  });

  it("includes --on-conflict keep-incoming and keep-current hints in message", () => {
    const err = new UnresolvableConflictError(["rules/x"]);
    expect(err.message).toContain("--on-conflict keep-incoming");
    expect(err.message).toContain("--on-conflict keep-current");
  });
});

describe("resolveConflicts - non-TTY", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it("auto-merges when changes are on different lines", async () => {
    // incoming only adds new content — no line removals, so hasConflicts = false
    const current = "# Rule\n\nOriginal content\n";
    const incoming = "# Rule\n\nOriginal content\n\n## New Section\nUpstream addition\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    const resolution = await resolveConflicts([conflict]);

    expect(resolution.merged).toHaveLength(1);
    expect(resolution.accepted).toHaveLength(0);
    expect(resolution.skipped).toHaveLength(0);
    expect(resolution.merged[0]!.incomingContent).toContain("Original content");
    expect(resolution.merged[0]!.incomingContent).toContain("Upstream addition");
  });

  it("returns merged entries when all conflicts auto-merge successfully", async () => {
    const c1 = makeConflictEntry(
      "rules/foo",
      "/tmp/foo.md",
      "# Foo\n\nBase content\n",
      "# Foo\n\nBase content\n\n## Extra\nAdded by upstream\n",
    );
    const c2 = makeConflictEntry(
      "rules/bar",
      "/tmp/bar.md",
      "# Bar\n\nBase content\n",
      "# Bar\n\nBase content\n\n## New Section\nMore additions\n",
    );

    const resolution = await resolveConflicts([c1, c2]);
    expect(resolution.merged).toHaveLength(2);
    expect(resolution.accepted).toHaveLength(0);
    expect(resolution.skipped).toHaveLength(0);
  });
});

describe("resolveConflicts - non-TTY structured output (CORE-007)", () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY;
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
  });

  it("does NOT throw when there are unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await expect(resolveConflicts([conflict])).resolves.not.toThrow();
  });

  it("returns unresolvable entries in resolution.unresolvable (was: process.exitCode=2 side effect)", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    const resolution = await resolveConflicts([conflict]);

    expect(resolution.unresolvable).toHaveLength(1);
    expect(resolution.unresolvable[0]!.label).toBe("rules/foo");
  });

  it("returns nonInteractivePayload for stderr emission by the CLI caller", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    const resolution = await resolveConflicts([conflict]);

    expect(resolution.nonInteractivePayload).toBeDefined();
    expect(resolution.nonInteractivePayload!.type).toBe("conflicts");
    expect(resolution.nonInteractivePayload!.items).toHaveLength(1);
    expect(resolution.nonInteractivePayload!.items[0]).toMatchObject({
      label: "rules/foo",
      fullPath: "/tmp/foo.md",
      currentContent: current,
      incomingContent: incoming,
    });
  });

  it("returns unresolvable entries separately from skipped (no more conflation)", async () => {
    // c1: auto-mergeable (pure addition)
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## New Section\nAdded upstream\n",
    );
    // c2: true conflict
    const c2 = makeConflictEntry(
      "rules/conflict",
      "/tmp/conflict.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );

    const resolution = await resolveConflicts([c1, c2]);

    expect(resolution.merged).toHaveLength(1);
    expect(resolution.merged[0]!.label).toBe("rules/safe");
    expect(resolution.unresolvable).toHaveLength(1);
    expect(resolution.unresolvable[0]!.label).toBe("rules/conflict");
    expect(resolution.skipped).toHaveLength(0); // CORE-007: user-skipped only
    expect(resolution.accepted).toHaveLength(0);
  });

  it("nonInteractivePayload only lists unresolvable files, not auto-merged ones", async () => {
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## New Section\nAdded upstream\n",
    );
    const c2 = makeConflictEntry(
      "rules/conflict",
      "/tmp/conflict.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );

    const resolution = await resolveConflicts([c1, c2]);

    expect(resolution.nonInteractivePayload).toBeDefined();
    expect(resolution.nonInteractivePayload!.items).toHaveLength(1);
    expect(resolution.nonInteractivePayload!.items[0]!.label).toBe("rules/conflict");
  });

  it("nonInteractivePayload is undefined when all conflicts auto-merge cleanly", async () => {
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## New Section\nAdded upstream\n",
    );

    const resolution = await resolveConflicts([c1]);

    expect(resolution.unresolvable).toHaveLength(0);
    expect(resolution.nonInteractivePayload).toBeUndefined();
  });
});

describe("resolveConflicts - unionMerge", () => {
  it("applies non-overlapping changes cleanly with no markers", async () => {
    const current = "# Rule\n\nOriginal content\n";
    const incoming = "# Rule\n\nOriginal content\n\n## New Section\nUpstream addition\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    const resolution = await resolveConflicts([conflict], { unionMerge: true });

    expect(resolution.merged).toHaveLength(1);
    expect(resolution.accepted).toHaveLength(0);
    expect(resolution.skipped).toHaveLength(0);
    expect(resolution.merged[0]!.hasMarkers).toBe(false);
    expect(resolution.merged[0]!.incomingContent).not.toContain("<<<<<<<");
    expect(resolution.merged[0]!.incomingContent).toContain("Upstream addition");
  });

  it("wraps overlapping changes in git-style markers and flags hasMarkers", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    const resolution = await resolveConflicts([conflict], { unionMerge: true });

    expect(resolution.merged).toHaveLength(1);
    expect(resolution.merged[0]!.hasMarkers).toBe(true);
    const content = resolution.merged[0]!.incomingContent;
    expect(content).toContain("<<<<<<< current");
    expect(content).toContain("=======");
    expect(content).toContain(">>>>>>> incoming");
    expect(content).toContain("USER-VERSION");
    expect(content).toContain("UPSTREAM-VERSION");
  });

  it("never prompts or fails — returns every conflict as merged", async () => {
    const c1 = makeConflictEntry(
      "rules/clean",
      "/tmp/a.md",
      "# A\nbase\n",
      "# A\nbase\n## New\nadded\n",
    );
    const c2 = makeConflictEntry(
      "rules/overlap",
      "/tmp/b.md",
      "line1\nLOCAL\nline3\n",
      "line1\nREMOTE\nline3\n",
    );

    const resolution = await resolveConflicts([c1, c2], { unionMerge: true });

    expect(resolution.merged).toHaveLength(2);
    expect(resolution.accepted).toHaveLength(0);
    expect(resolution.skipped).toHaveLength(0);
    expect(resolution.merged[0]!.hasMarkers).toBe(false);
    expect(resolution.merged[1]!.hasMarkers).toBe(true);
  });

  it("force takes precedence over unionMerge", async () => {
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", "LOCAL\n", "INCOMING\n");

    const resolution = await resolveConflicts([conflict], {
      unionMerge: true,
      force: true,
    });

    expect(resolution.accepted).toHaveLength(1);
    expect(resolution.merged).toHaveLength(0);
    expect(resolution.accepted[0]!.incomingContent).toBe("INCOMING\n");
  });

  it("keepCurrent takes precedence over unionMerge", async () => {
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", "LOCAL\n", "INCOMING\n");

    const resolution = await resolveConflicts([conflict], {
      unionMerge: true,
      keepCurrent: true,
    });

    expect(resolution.skipped).toHaveLength(1);
    expect(resolution.merged).toHaveLength(0);
  });
});
