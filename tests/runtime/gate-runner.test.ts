import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  aggregateOutcomes,
  isAgentCheck,
  loadGateDefinition,
  runDeterministicCheck,
  type DeterministicCheckContext,
} from "#src/runtime/gate-runner.js";
import {
  runWorkflow,
  proposeScopeExpansion,
  approveScopeExpansion,
} from "#src/runtime/cli-handlers.js";
import { reduce } from "#src/runtime/reducer.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import type { GateCheck } from "#src/runtime/gate-types.js";
import type { Author } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "tester" };

function buildCtx(cwd: string): DeterministicCheckContext {
  const log = BrainEventLog.open();
  try {
    const id = log.getActiveWorkflowId();
    if (!id) throw new Error("no workflow");
    const events = log.loadEvents(id);
    return {
      cwd,
      state: reduce(events),
    };
  } finally {
    log.dispose();
  }
}

let prevBrainDb: string | undefined;
function isolateBrain(dir: string): void {
  prevBrainDb = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
}
function restoreBrain(): void {
  if (prevBrainDb === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = prevBrainDb;
}

function setup(): string {
  const dir = mkdtempSync(join(tmpdir(), "codi-gate-"));
  isolateBrain(dir);
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
  runWorkflow({
    workflowType: "feature",
    task: "Test gate",
    author: human,
    cwd: dir,
  });
  return dir;
}

describe("isAgentCheck", () => {
  it("identifies agent checks", () => {
    expect(isAgentCheck({ id: "x", type: "agent" })).toBe(true);
    expect(isAgentCheck({ id: "x", type: "deterministic" })).toBe(false);
  });
});

describe("loadGateDefinition", () => {
  it("returns the gate definition by name", () => {
    const contract = {
      gates: {
        "plan-complete": {
          checks: [{ id: "task_described", type: "deterministic" as const }],
        },
      },
    };
    const def = loadGateDefinition(contract, "plan-complete");
    expect(def?.checks).toHaveLength(1);
  });

  it("returns null for unknown gate", () => {
    const def = loadGateDefinition({ gates: {} }, "missing");
    expect(def).toBeNull();
  });
});

describe("runDeterministicCheck — registered checkers", () => {
  let dir: string;

  beforeEach(() => {
    dir = setup();
  });

  afterEach(() => {
    restoreBrain();
    rmSync(dir, { recursive: true, force: true });
  });

  it("task_described passes when state.task is non-empty", () => {
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "task_described", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("scope_files_listed fails when no files in plan", () => {
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "scope_files_listed", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.suggested_action).toContain("propose-expansion");
  });

  it("scope_files_listed passes after a file is approved", () => {
    proposeScopeExpansion({
      filePath: "src/x.ts",
      reason: "x",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "scope_files_listed", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("plan_artifact_exists fails without plan markdown", () => {
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "plan_artifact_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
  });

  it("plan_artifact_exists passes when matching markdown is present", () => {
    writeFileSync(join(dir, "docs", "20260501_120000_[PLAN]_test.md"), "# Plan\n", "utf-8");
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "plan_artifact_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("returns advisory pass for unregistered checker ids", () => {
    const ctx = buildCtx(dir);
    const check: GateCheck = { id: "nonexistent_check", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("No deterministic checker");
  });
});

describe("Q7 — bug-fix gate enforcers", () => {
  let dir: string;

  function setupBugFix(adaptation?: Record<string, unknown>): {
    ctx: DeterministicCheckContext;
    workflowId: string;
  } {
    dir = mkdtempSync(join(tmpdir(), "codi-gate-bf-"));
    isolateBrain(dir);
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "CONTEXT.md"), "# Context\n", "utf-8");
    runWorkflow({
      workflowType: "bug-fix",
      task: "Test bug-fix gate",
      author: human,
      cwd: dir,
      ...(adaptation !== undefined
        ? { bugFixAdaptation: adaptation as Record<string, never> }
        : {}),
    });
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) throw new Error("no workflow");
      const events = log.loadEvents(id);
      return {
        ctx: { cwd: dir, state: reduce(events), events },
        workflowId: id,
      };
    } finally {
      log.dispose();
    }
  }

  afterEach(() => {
    restoreBrain();
    rmSync(dir, { recursive: true, force: true });
  });

  it("reproducer_event_exists passes when reproducer_exists=true in init", () => {
    const { ctx } = setupBugFix({ profile: "quick", reproducerExists: true });
    const check: GateCheck = { id: "reproducer_event_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("Reproducer declared");
  });

  it("reproducer_event_exists fails when nothing declared and no marker event", () => {
    const { ctx } = setupBugFix({ profile: "standard", reproducerExists: false });
    const check: GateCheck = { id: "reproducer_event_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.suggested_action).toContain("reproducer_built");
  });

  it("tdd_first_test_exists passes when both reproducer + root_cause declared", () => {
    const { ctx } = setupBugFix({
      profile: "incident",
      reproducerExists: true,
      rootCauseKnown: true,
    });
    const check: GateCheck = { id: "tdd_first_test_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("tdd_first_test_exists fails when no test marker recorded", () => {
    const { ctx } = setupBugFix({ profile: "standard", reproducerExists: false });
    const check: GateCheck = { id: "tdd_first_test_exists", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.suggested_action).toContain("regression_test_added");
  });
});

describe("aggregateOutcomes", () => {
  it("flags overall pass when all outcomes pass", () => {
    const outcomes = [
      {
        check: { id: "a", type: "deterministic" } as GateCheck,
        retries_used: 0,
        result: { check_id: "a", verdict: "pass" as const },
      },
    ];
    const agg = aggregateOutcomes("test", outcomes);
    expect(agg.passed).toBe(true);
    expect(agg.failed_checks).toHaveLength(0);
  });

  it("flags overall fail when any outcome fails", () => {
    const outcomes = [
      {
        check: { id: "a", type: "deterministic" } as GateCheck,
        retries_used: 0,
        result: { check_id: "a", verdict: "pass" as const },
      },
      {
        check: { id: "b", type: "deterministic", max_retries: 2 } as GateCheck,
        retries_used: 1,
        result: { check_id: "b", verdict: "fail" as const, summary: "bad" },
      },
    ];
    const agg = aggregateOutcomes("test", outcomes);
    expect(agg.passed).toBe(false);
    expect(agg.failed_checks).toHaveLength(1);
    expect(agg.retries_remaining).toBe(1);
  });
});
