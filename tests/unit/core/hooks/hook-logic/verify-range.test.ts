import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));
const { execFileSync } = await import("node:child_process");
const { verifyRange } = await import("#src/core/hooks/hook-logic/verify-range.js");

describe("verifyRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no offenders when version increased on every change", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("src/templates/rules/x.ts\n")
      .mockReturnValueOnce("---\nversion: 5\n---\nold")
      .mockReturnValueOnce("---\nversion: 6\n---\nnew");
    const offenders = verifyRange("base-oid", "head-oid");
    expect(offenders).toEqual([]);
  });

  it("flags content change without version bump", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("src/templates/rules/x.ts\n")
      .mockReturnValueOnce("---\nversion: 5\n---\nold")
      .mockReturnValueOnce("---\nversion: 5\n---\nNEW");
    const offenders = verifyRange("base-oid", "head-oid");
    expect(offenders).toHaveLength(1);
    expect(offenders[0].path).toBe("src/templates/rules/x.ts");
    expect(offenders[0].reason).toBe("content-changed-without-bump");
  });

  it("flags version regression", () => {
    vi.mocked(execFileSync)
      .mockReturnValueOnce("src/templates/rules/x.ts\n")
      .mockReturnValueOnce("---\nversion: 5\n---\nold")
      .mockReturnValueOnce("---\nversion: 3\n---\nNEW");
    const offenders = verifyRange("base-oid", "head-oid");
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toBe("version-regression");
  });

  it("ignores non-artifact files in the diff", () => {
    vi.mocked(execFileSync).mockReturnValueOnce("README.md\nsrc/cli.ts\n");
    const offenders = verifyRange("base-oid", "head-oid");
    expect(offenders).toEqual([]);
  });

  it("returns empty when range is empty", () => {
    vi.mocked(execFileSync).mockReturnValueOnce("");
    const offenders = verifyRange("base-oid", "head-oid");
    expect(offenders).toEqual([]);
  });
});
