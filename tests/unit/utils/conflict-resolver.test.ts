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

describe("resolveConflicts - non-TTY structured output (exit 2)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
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
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    process.exitCode = originalExitCode;
    stdoutSpy.mockRestore();
  });

  it("does NOT throw when there are unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await expect(resolveConflicts([conflict])).resolves.not.toThrow();
  });

  it("sets process.exitCode to 2 for unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    expect(process.exitCode).toBe(2);
  });

  it("writes JSON payload to stdout for unresolvable conflicts", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as unknown;
    expect(parsed).toMatchObject({ type: "conflicts" });
  });

  it("payload items contain label, fullPath, currentContent, incomingContent", async () => {
    const current = "line1\nUSER-VERSION\nline3\n";
    const incoming = "line1\nUPSTREAM-VERSION\nline3\n";
    const conflict = makeConflictEntry("rules/foo", "/tmp/foo.md", current, incoming);

    await resolveConflicts([conflict]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as { type: string; items: unknown[] };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      label: "rules/foo",
      fullPath: "/tmp/foo.md",
      currentContent: current,
      incomingContent: incoming,
    });
  });

  it("returns failed entries in skipped, auto-merged in merged", async () => {
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
    expect(resolution.skipped).toHaveLength(1);
    expect(resolution.skipped[0]!.label).toBe("rules/conflict");
    expect(resolution.accepted).toHaveLength(0);
  });

  it("payload only lists unresolvable files, not auto-merged ones", async () => {
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

    await resolveConflicts([c1, c2]);

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(written) as { type: string; items: Array<{ label: string }> };
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.label).toBe("rules/conflict");
  });
});
