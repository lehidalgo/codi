import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));
const { execFileSync } = await import("node:child_process");
const { getPreviousVersion } = await import("#src/core/hooks/hook-logic/get-previous-version.js");

describe("getPreviousVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed version from HEAD content", () => {
    vi.mocked(execFileSync).mockReturnValueOnce("---\nname: test\nversion: 7\n---\nbody");
    const result = getPreviousVersion("HEAD", "src/templates/rules/test.ts");
    expect(result).toEqual({ kind: "found", version: 7 });
  });

  it("returns 'no-head' when HEAD does not exist", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      const e: Error & { status?: number; stderr?: Buffer } = new Error("HEAD not found");
      e.status = 128;
      e.stderr = Buffer.from("fatal: bad revision 'HEAD'");
      throw e;
    });
    const result = getPreviousVersion("HEAD", "src/templates/rules/new.ts");
    expect(result).toEqual({ kind: "no-head" });
  });

  it("returns 'new-file' when path doesn't exist at HEAD", () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      const e: Error & { status?: number; stderr?: Buffer } = new Error("path not found");
      e.status = 128;
      e.stderr = Buffer.from("fatal: path 'foo' does not exist in 'HEAD'");
      throw e;
    });
    const result = getPreviousVersion("HEAD", "src/templates/rules/foo.ts");
    expect(result).toEqual({ kind: "new-file" });
  });

  it("returns version 1 when frontmatter has no version field", () => {
    vi.mocked(execFileSync).mockReturnValueOnce("---\nname: test\n---\nbody");
    const result = getPreviousVersion("HEAD", "src/templates/rules/test.ts");
    expect(result).toEqual({ kind: "found", version: 1 });
  });
});
