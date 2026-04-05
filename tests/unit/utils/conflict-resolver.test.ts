import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("includes --force and --json hints in message", () => {
    const err = new UnresolvableConflictError(["rules/x"]);
    expect(err.message).toContain("--force");
    expect(err.message).toContain("--json");
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

  it("throws UnresolvableConflictError when both sides change the same line", async () => {
    // both changed line2 differently — true conflict
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await expect(resolveConflicts([conflict])).rejects.toThrow(UnresolvableConflictError);
  });

  it("thrown error lists all unresolvable files", async () => {
    const current = "line1\nUSER\nline3\n";
    const incoming = "line1\nUPSTREAM\nline3\n";
    const c1 = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);
    const c2 = makeConflictEntry("rules/bar", "/tmp/bar.md", current, incoming);

    const err = await resolveConflicts([c1, c2]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnresolvableConflictError);
    expect((err as UnresolvableConflictError).files).toContain("rules/foo");
    expect((err as UnresolvableConflictError).files).toContain("rules/bar");
  });

  it("only lists truly unresolvable files in the error", async () => {
    // c1: pure addition — incoming is a superset, hasConflicts = false
    const c1 = makeConflictEntry(
      "rules/safe",
      "/tmp/safe.md",
      "# Safe\n\nOriginal content\n",
      "# Safe\n\nOriginal content\n\n## Added Section\nNew content\n",
    );
    // c2: true conflict — both sides changed the same line
    const c2 = makeConflictEntry(
      "rules/conflict",
      "/tmp/conflict.md",
      "line1\nUSER-VERSION\nline3\n",
      "line1\nUPSTREAM-VERSION\nline3\n",
    );

    const err = await resolveConflicts([c1, c2]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnresolvableConflictError);
    expect((err as UnresolvableConflictError).files).toEqual(["rules/conflict"]);
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
