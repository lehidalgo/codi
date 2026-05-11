/**
 * Coverage for the 5 deterministic checkers added by the workflow
 * adaptive-intake work: baseline_captured, behavior_unchanged,
 * rollback_documented, migration_metrics_captured, sheet_creds_present.
 *
 * The bug-fix enforcers (reproducer_event_exists, tdd_first_test_exists)
 * already have coverage in gate-runner.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDeterministicCheck, type DeterministicCheckContext } from "#src/runtime/gate-runner.js";
import type { GateCheck } from "#src/runtime/gate-types.js";
import type { ManifestEvent, ReducedState } from "#src/runtime/types.js";

function emptyState(): ReducedState {
  return {
    workflow_id: "test",
    workflow_type: "feature",
    task: "test",
    status: "active",
    current_phase: "intent",
    phase_history: [],
    scope: {
      files_in_plan: [],
      incidental_changes: 0,
      scope_expansions_approved: 0,
      scope_expansions_rejected: 0,
    },
    child_workflows: [],
    paused_for_child_id: null,
    knowledge: { context_terms_added: [], adrs_approved: [] },
    subagent_stats: {
      total_dispatched: 0,
      total_completed: 0,
      total_failed: 0,
      total_tokens_consumed: 0,
    },
    current_owner: "human:tester",
    started_at: new Date().toISOString(),
    last_event_id: "e0",
    last_event_timestamp: new Date().toISOString(),
    events_count: 0,
  };
}

function event(type: ManifestEvent["event_type"], payload: Record<string, unknown>): ManifestEvent {
  return {
    event_id: `e${Math.random().toString(36).slice(2)}`,
    event_type: type,
    workflow_id: "test",
    timestamp: new Date().toISOString(),
    actor: { type: "human", id: "tester" },
    payload,
  } as ManifestEvent;
}

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "codi-gate-new-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe("gate-runner — baseline_captured", () => {
  it("passes when a decision_recorded marker exists", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("decision_recorded", { kind: "baseline_captured" })],
    };
    const check: GateCheck = { id: "baseline_captured", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when no marker present", () => {
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "baseline_captured", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.suggested_action).toContain("baseline_captured");
  });
});

describe("gate-runner — behavior_unchanged", () => {
  it("passes when refactor kind=deadcode", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("init", { refactor_adaptation: { kind: "deadcode" } })],
    };
    const check: GateCheck = { id: "behavior_unchanged", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("deadcode");
  });

  it("passes when behavior_unchanged marker recorded", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [
        event("init", { refactor_adaptation: { kind: "extract" } }),
        event("decision_recorded", { kind: "behavior_unchanged" }),
      ],
    };
    const check: GateCheck = { id: "behavior_unchanged", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when neither deadcode nor marker present", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("init", { refactor_adaptation: { kind: "extract" } })],
    };
    const check: GateCheck = { id: "behavior_unchanged", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
  });
});

describe("gate-runner — rollback_documented", () => {
  it("passes when plan markdown has ## Rollback section", () => {
    mkdirSync(join(cwd, "docs"), { recursive: true });
    writeFileSync(
      join(cwd, "docs", "20260101_120000_[PLAN]_migration.md"),
      "# Title\n\n## Plan\n\n## Rollback\n\nRevert step.\n",
    );
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "rollback_documented", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when docs/ directory does not exist", () => {
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "rollback_documented", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("docs/");
  });

  it("fails when no plan markdown found", () => {
    mkdirSync(join(cwd, "docs"), { recursive: true });
    writeFileSync(join(cwd, "docs", "README.md"), "no plan");
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "rollback_documented", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toMatch(/plan markdown/i);
  });

  it("fails when plan exists but lacks ## Rollback", () => {
    mkdirSync(join(cwd, "docs"), { recursive: true });
    writeFileSync(
      join(cwd, "docs", "20260101_120000_[PLAN]_no-rollback.md"),
      "# Title\n\n## Plan\n\nDo the thing.\n",
    );
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "rollback_documented", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
    expect(outcome.result.summary).toContain("Rollback");
  });
});

describe("gate-runner — migration_metrics_captured", () => {
  it("passes when marker has pre + post fields", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [
        event("decision_recorded", {
          kind: "migration_metrics_captured",
          pre: 1000,
          post: 1000,
        }),
      ],
    };
    const check: GateCheck = { id: "migration_metrics_captured", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when marker exists but lacks pre/post", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("decision_recorded", { kind: "migration_metrics_captured" })],
    };
    const check: GateCheck = { id: "migration_metrics_captured", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
  });

  it("fails when no marker present", () => {
    const ctx: DeterministicCheckContext = { cwd, state: emptyState(), events: [] };
    const check: GateCheck = { id: "migration_metrics_captured", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
  });
});

describe("gate-runner — sheet_creds_present", () => {
  it("passes when no_sheet=true (local-only project)", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("init", { project_adaptation: { no_sheet: true } })],
    };
    const check: GateCheck = { id: "sheet_creds_present", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
    expect(outcome.result.summary).toContain("no_sheet");
  });

  it("passes when sheet_creds_verified marker recorded", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [
        event("init", { project_adaptation: { no_sheet: false } }),
        event("decision_recorded", { kind: "sheet_creds_verified" }),
      ],
    };
    const check: GateCheck = { id: "sheet_creds_present", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("pass");
  });

  it("fails when sheets path but no marker", () => {
    const ctx: DeterministicCheckContext = {
      cwd,
      state: emptyState(),
      events: [event("init", { project_adaptation: { no_sheet: false } })],
    };
    const check: GateCheck = { id: "sheet_creds_present", type: "deterministic" };
    const outcome = runDeterministicCheck(check, ctx);
    expect(outcome.result.verdict).toBe("fail");
  });
});
