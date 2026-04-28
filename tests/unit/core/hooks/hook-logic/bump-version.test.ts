import { describe, it, expect } from "vitest";
import { bumpVersion } from "#src/core/hooks/hook-logic/bump-version.js";

const headContent = "---\nname: x\nversion: 5\n---\nbody-original";
const stagedSame = "---\nname: x\nversion: 5\n---\nbody-original";
const stagedDiff = "---\nname: x\nversion: 5\n---\nbody-CHANGED";
const stagedBumped = "---\nname: x\nversion: 6\n---\nbody-CHANGED";
const stagedRegressed = "---\nname: x\nversion: 3\n---\nbody-CHANGED";

describe("bumpVersion", () => {
  it("no-op when content matches HEAD", () => {
    const r = bumpVersion(stagedSame, { kind: "found", version: 5 }, headContent);
    expect(r.action).toBe("no-op");
  });

  it("bumps when content differs and version not increased", () => {
    const r = bumpVersion(stagedDiff, { kind: "found", version: 5 }, headContent);
    expect(r.action).toBe("bumped");
    expect(r.fromVersion).toBe(5);
    expect(r.toVersion).toBe(6);
    expect(r.rewrittenContent).toContain("version: 6");
    expect(r.rewrittenContent).toContain("body-CHANGED");
  });

  it("no-op when content differs but user already bumped", () => {
    const r = bumpVersion(stagedBumped, { kind: "found", version: 5 }, headContent);
    expect(r.action).toBe("no-op");
  });

  it("rejects version regression", () => {
    const r = bumpVersion(stagedRegressed, { kind: "found", version: 5 }, headContent);
    expect(r.action).toBe("rejected");
    expect(r.rejectReason).toMatch(/regression/);
  });

  it("treats new file as version 1 when no version field", () => {
    const r = bumpVersion("---\nname: x\n---\nbody", { kind: "new-file" });
    expect(r.action).toBe("bumped");
    expect(r.fromVersion).toBe(null);
    expect(r.toVersion).toBe(1);
    expect(r.rewrittenContent).toContain("version: 1");
  });

  it("preserves explicit version on new file", () => {
    const r = bumpVersion("---\nname: x\nversion: 3\n---\nbody", { kind: "new-file" });
    expect(r.action).toBe("no-op");
    expect(r.toVersion).toBe(3);
  });

  it("rejects malformed frontmatter", () => {
    const r = bumpVersion("not a yaml frontmatter", { kind: "found", version: 1 });
    expect(r.action).toBe("rejected");
    expect(r.rejectReason).toMatch(/frontmatter/);
  });
});
