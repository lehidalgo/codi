import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateSecurityReminder } from "#src/runtime/hooks/security-reminder/checker.js";
import type { HookContext } from "#src/core/hooks/hook-artifact.js";

function ctx(overrides: Partial<HookContext>): HookContext {
  return {
    bucket: "runtime",
    event: "PreToolUse",
    toolName: "Write",
    filePath: "src/foo.ts",
    content: "",
    sessionId: "test-sid",
    cwd: process.cwd(),
    ...overrides,
  };
}

describe("evaluateSecurityReminder", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codi-sec-eval-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("returns matched=false on a markdown doc that mentions exec(", () => {
    const v = evaluateSecurityReminder(ctx({ filePath: "doc.md", content: "exec(',',\")" }), {
      stateDir: dir,
    });
    expect(v.matched).toBe(false);
  });

  it("matches exec( in a .ts file", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "match-sid",
        filePath: "src/foo.ts",
        content: "child_process.exec(cmd)",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(true);
    expect(v.ruleId).toBe("child-process-exec");
    expect(v.severity).toBe("warn");
    expect(v.suggestedAction?.length ?? 0).toBeGreaterThan(0);
  });

  it("does not match when same exec( lives inside a // comment", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "comment-sid",
        filePath: "src/foo.ts",
        content: "// exec(cmd)",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(false);
  });

  it("does not re-fire on the same (sid,file,rule) within a session", () => {
    const args = ctx({
      sessionId: "dedupe-sid",
      filePath: "src/foo.ts",
      content: "child_process.exec(cmd)",
    });
    const v1 = evaluateSecurityReminder(args, { stateDir: dir });
    const v2 = evaluateSecurityReminder(args, { stateDir: dir });
    expect(v1.matched).toBe(true);
    expect(v2.matched).toBe(false);
  });

  it("matches gha-injection in .yml workflow path", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "gha-sid",
        filePath: ".github/workflows/build.yml",
        content: "run: echo ${{ github.event.issue.title }}",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(true);
    expect(v.ruleId).toBe("gha-injection");
  });

  it("does not match pickle in a .ts file (per-pattern allowlist)", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "pickle-ts-sid",
        filePath: "src/foo.ts",
        content: "const data = pickle.loads(buf);",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(false);
  });

  it("matches pickle in a .py file", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "pickle-py-sid",
        filePath: "src/foo.py",
        content: "data = pickle.loads(buf)",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(true);
    expect(v.ruleId).toBe("pickle-deserialize");
  });

  it("returns no-match when toolName is Read", () => {
    const v = evaluateSecurityReminder(
      ctx({
        sessionId: "read-sid",
        toolName: "Read",
        filePath: "src/foo.ts",
        content: "child_process.exec(cmd)",
      }),
      { stateDir: dir },
    );
    expect(v.matched).toBe(false);
  });
});
