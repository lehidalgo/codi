import { describe, it, expect } from "vitest";
import { runRuntimeHooks, aggregateExitDecision } from "#src/runtime/hooks/runner.js";
import type { RuntimeHookArtifact, HookContext } from "#src/core/hooks/hook-artifact.js";

const baseHook: RuntimeHookArtifact = {
  bucket: "runtime",
  name: "h-pass",
  description: "",
  version: "1",
  managed_by: "codi",
  required: false,
  default: true,
  category: "security",
  events: ["PreToolUse"],
  evaluate: () => ({ hookName: "h-pass", matched: false, severity: "info" }),
};

const blocking: RuntimeHookArtifact = {
  ...baseHook,
  name: "h-block",
  evaluate: () => ({
    hookName: "h-block",
    matched: true,
    severity: "block",
    message: "no",
    suggestedAction: "do other thing",
  }),
};

const throwing: RuntimeHookArtifact = {
  ...baseHook,
  name: "h-throw",
  evaluate: () => {
    throw new Error("boom");
  },
};

const slow: RuntimeHookArtifact = {
  ...baseHook,
  name: "h-slow",
  evaluate: () =>
    new Promise((resolve) =>
      setTimeout(() => resolve({ hookName: "h-slow", matched: true, severity: "warn" }), 50),
    ),
};

const ctx: HookContext = {
  bucket: "runtime",
  event: "PreToolUse",
  toolName: "Write",
  filePath: "x.ts",
  content: "",
  sessionId: "s",
  cwd: process.cwd(),
};

describe("runRuntimeHooks", () => {
  it("aggregates verdicts in order", async () => {
    const verdicts = await runRuntimeHooks([baseHook, blocking], ctx);
    expect(verdicts).toHaveLength(2);
    expect(verdicts[0]?.hookName).toBe("h-pass");
    expect(verdicts[1]?.hookName).toBe("h-block");
  });

  it("fails open on throw, does not crash other hooks", async () => {
    const verdicts = await runRuntimeHooks([throwing, baseHook], ctx);
    const t = verdicts.find((v) => v.hookName === "h-throw");
    expect(t?.matched).toBe(false);
    expect(verdicts.some((v) => v.hookName === "h-pass")).toBe(true);
  });

  it("respects phaseFilter — skip when current phase not in filter", async () => {
    const filtered: RuntimeHookArtifact = { ...baseHook, phaseFilter: ["execute"] };
    const v = await runRuntimeHooks([filtered], { ...ctx, workflowPhase: "plan" });
    expect(v[0]?.matched).toBe(false);
  });

  it("respects phaseFilter — run when current phase matches", async () => {
    const filtered: RuntimeHookArtifact = {
      ...baseHook,
      phaseFilter: ["execute"],
      evaluate: () => ({ hookName: "h-pass", matched: true, severity: "warn" }),
    };
    const v = await runRuntimeHooks([filtered], { ...ctx, workflowPhase: "execute" });
    expect(v[0]?.matched).toBe(true);
  });

  it("dispatchSkill returns informational verdict, does not call evaluate", async () => {
    let called = false;
    const dispatching: RuntimeHookArtifact = {
      ...baseHook,
      dispatchSkill: "codi-quality-gates",
      evaluate: () => {
        called = true;
        return { hookName: "h-pass", matched: true, severity: "block" };
      },
    };
    const v = await runRuntimeHooks([dispatching], ctx);
    expect(called).toBe(false);
    expect(v[0]?.matched).toBe(false);
    expect(v[0]?.message).toContain("dispatchSkill=codi-quality-gates");
  });

  it("supports async evaluate", async () => {
    const v = await runRuntimeHooks([slow], ctx);
    expect(v[0]?.matched).toBe(true);
  });
});

describe("aggregateExitDecision", () => {
  it("returns exit 0 when no matches", () => {
    const r = aggregateExitDecision([{ hookName: "a", matched: false, severity: "info" }]);
    expect(r.exitCode).toBe(0);
    expect(r.stderrLines).toHaveLength(0);
  });

  it("returns exit 2 when any block-severity match", () => {
    const r = aggregateExitDecision([
      { hookName: "a", matched: true, severity: "block", message: "blocked!" },
    ]);
    expect(r.exitCode).toBe(2);
    expect(r.stderrLines.join("\n")).toContain("blocked!");
  });

  it("returns exit 2 when any warn-severity match", () => {
    const r = aggregateExitDecision([
      {
        hookName: "a",
        matched: true,
        severity: "warn",
        message: "warned",
        suggestedAction: "fix",
      },
    ]);
    expect(r.exitCode).toBe(2);
    expect(r.stderrLines.join("\n")).toContain("warned");
    expect(r.stderrLines.join("\n")).toContain("fix");
  });

  it("info severity does not block", () => {
    const r = aggregateExitDecision([
      { hookName: "a", matched: true, severity: "info", message: "fyi" },
    ]);
    expect(r.exitCode).toBe(0);
  });
});
