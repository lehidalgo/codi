import { describe, it, expect } from "vitest";
import { runWorkflow, abandonWorkflow } from "#src/runtime/cli-handlers.js";
import { useTmpBrain, withBrain, human } from "./_setup.js";

const h = useTmpBrain();
const tmpDir = (): string => h.tmpDir();

void abandonWorkflow;

describe("bug-fix adaptive intake (Q7)", () => {
  it("resolveBugFixAdaptation: profile='quick' produces a complete shape", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveBugFixAdaptation({ profile: "quick" });
    expect(r.profile).toBe("quick");
    expect(r.severity).toBe("P3");
    expect(r.reproducerExists).toBe(true);
    expect(r.rootCauseKnown).toBe(true);
    expect(r.scope).toBe("single");
    expect(r.executeMode).toBe("inline");
    expect(r.grill).toBe(false);
  });

  it("resolveBugFixAdaptation: profile='deep' enables grill + subagent", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveBugFixAdaptation({ profile: "deep" });
    expect(r.profile).toBe("deep");
    expect(r.severity).toBe("P1");
    expect(r.scope).toBe("multi");
    expect(r.executeMode).toBe("subagent");
    expect(r.grill).toBe(true);
  });

  it("resolveBugFixAdaptation: explicit overrides win over profile defaults", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveBugFixAdaptation({
      profile: "standard",
      severity: "P0",
      executeMode: "subagent",
    });
    expect(r.profile).toBe("standard");
    expect(r.severity).toBe("P0");
    expect(r.executeMode).toBe("subagent");
    // unspecified fields fall back to standard profile
    expect(r.reproducerExists).toBe(false);
    expect(r.rootCauseKnown).toBe(false);
  });

  it("resolveBugFixAdaptation: defaults to 'standard' when no profile given", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = resolveBugFixAdaptation({ severity: "P1" });
    expect(r.severity).toBe("P1");
    expect(r.scope).toBe("multi"); // standard default
    expect(r.executeMode).toBe("inline");
  });

  it("runWorkflow stores bug_fix_adaptation in the init event payload", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = runWorkflow({
      workflowType: "bug-fix",
      task: "intermittent flaky test",
      author: human,
      cwd: tmpDir(),
      bugFixAdaptation: resolveBugFixAdaptation({ profile: "deep", severity: "P0" }),
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as {
        bug_fix_adaptation?: {
          profile?: string;
          severity?: string;
          execute_mode?: string;
          grill?: boolean;
        };
      };
      expect(payload.bug_fix_adaptation).toBeDefined();
      expect(payload.bug_fix_adaptation?.profile).toBe("deep");
      expect(payload.bug_fix_adaptation?.severity).toBe("P0");
      expect(payload.bug_fix_adaptation?.execute_mode).toBe("subagent");
      expect(payload.bug_fix_adaptation?.grill).toBe(true);
    });
  });

  it("runWorkflow stores carryover_from in the init event payload", async () => {
    const { runWorkflow } = await import("#src/runtime/cli-handlers.js");
    const r = runWorkflow({
      workflowType: "bug-fix",
      task: "now a bug",
      author: human,
      cwd: tmpDir(),
      carryoverFrom: "feat-original-task-20260101",
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as { carryover_from?: string };
      expect(payload.carryover_from).toBe("feat-original-task-20260101");
    });
  });

  it("computeBugFixSkipPhases: empty when nothing triggers a skip", async () => {
    const { resolveBugFixAdaptation, computeBugFixSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    expect(computeBugFixSkipPhases(resolveBugFixAdaptation({ profile: "standard" }))).toEqual([]);
  });

  it("computeBugFixSkipPhases: 'reproduce' when reproducerExists=true", async () => {
    const { resolveBugFixAdaptation, computeBugFixSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveBugFixAdaptation({ profile: "quick" });
    expect(computeBugFixSkipPhases(a)).toContain("reproduce");
  });

  it("computeBugFixSkipPhases: 'plan' when severity=P0 + rootCauseKnown=true", async () => {
    const { resolveBugFixAdaptation, computeBugFixSkipPhases } =
      await import("#src/runtime/workflows/index.js");
    const incident = resolveBugFixAdaptation({ profile: "incident" });
    expect(computeBugFixSkipPhases(incident)).toEqual(
      expect.arrayContaining(["reproduce", "plan"]),
    );
  });

  it("computeBugFixNextPhase: skips reproduce when adaptation says so", async () => {
    const { resolveBugFixAdaptation, computeBugFixNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveBugFixAdaptation({ profile: "quick" });
    expect(computeBugFixNextPhase("intent", a)).toBe("execute");
  });

  it("computeBugFixNextPhase: incident jumps from intent to execute", async () => {
    const { resolveBugFixAdaptation, computeBugFixNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveBugFixAdaptation({ profile: "incident" });
    expect(computeBugFixNextPhase("intent", a)).toBe("execute");
  });

  it("computeBugFixNextPhase: standard profile preserves full ordering", async () => {
    const { resolveBugFixAdaptation, computeBugFixNextPhase } =
      await import("#src/runtime/workflows/index.js");
    const a = resolveBugFixAdaptation({ profile: "standard" });
    expect(computeBugFixNextPhase("intent", a)).toBe("reproduce");
    expect(computeBugFixNextPhase("reproduce", a)).toBe("plan");
    expect(computeBugFixNextPhase("plan", a)).toBe("execute");
    expect(computeBugFixNextPhase("execute", a)).toBe("verify");
    expect(computeBugFixNextPhase("verify", a)).toBe("done");
  });

  it("computeBugFixNextPhase: returns null at terminal phase", async () => {
    const { resolveBugFixAdaptation, computeBugFixNextPhase } =
      await import("#src/runtime/workflows/index.js");
    expect(
      computeBugFixNextPhase("done", resolveBugFixAdaptation({ profile: "standard" })),
    ).toBeNull();
  });

  it("carryover_from materializes carryover_context from prior workflow", async () => {
    const { runWorkflow, abandonWorkflow } = await import("#src/runtime/cli-handlers.js");
    // Run a prior workflow first
    const prior = runWorkflow({
      workflowType: "feature",
      task: "original feature",
      author: human,
      cwd: tmpDir(),
    });
    abandonWorkflow({ reason: "reclassified to bug-fix", author: human, cwd: tmpDir() });
    // Now run a bug-fix that carries over from it
    const next = runWorkflow({
      workflowType: "bug-fix",
      task: "follow-up bug",
      author: human,
      cwd: tmpDir(),
      carryoverFrom: prior.workflowId,
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(next.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as {
        carryover_from?: string;
        carryover_context?: { task?: string; type?: string };
      };
      expect(payload.carryover_from).toBe(prior.workflowId);
      expect(payload.carryover_context).toBeDefined();
      expect(payload.carryover_context?.task).toBe("original feature");
      expect(payload.carryover_context?.type).toBe("feature");
    });
  });

  it("carryover_from with unknown id leaves carryover_context absent", async () => {
    const { runWorkflow } = await import("#src/runtime/cli-handlers.js");
    const r = runWorkflow({
      workflowType: "bug-fix",
      task: "x",
      author: human,
      cwd: tmpDir(),
      carryoverFrom: "ghost-workflow-id-99999999",
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as {
        carryover_from?: string;
        carryover_context?: unknown;
      };
      expect(payload.carryover_from).toBe("ghost-workflow-id-99999999");
      expect(payload.carryover_context).toBeUndefined();
    });
  });

  it("non-bug-fix workflows do NOT carry bug_fix_adaptation even if passed", async () => {
    const { resolveBugFixAdaptation } = await import("#src/runtime/workflows/index.js");
    const r = runWorkflow({
      workflowType: "feature",
      task: "add x",
      author: human,
      cwd: tmpDir(),
      bugFixAdaptation: resolveBugFixAdaptation({ profile: "quick" }),
    });
    withBrain(tmpDir(), (log) => {
      const events = log.loadEvents(r.workflowId);
      const init = events.find((e) => e.event_type === "init");
      const payload = init?.payload as { bug_fix_adaptation?: unknown };
      expect(payload.bug_fix_adaptation).toBeUndefined();
    });
  });
});
