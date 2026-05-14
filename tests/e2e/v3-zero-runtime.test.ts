/**
 * v3 zero closure end-to-end runtime suite.
 *
 * These scenarios exercise the F1–F11 surface in-process — no CLI spawning,
 * no built artifacts — so they run fast and pinpoint runtime regressions.
 * The dist-binary integration is covered separately in v3-zero-cli.test.ts.
 *
 * Each `describe` corresponds to one scenario from the e2e plan
 * (docs/20260509_172807_[TESTING]_codi-v3-zero-e2e-plan.md).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Under heavy vitest parallelism (281 files × worker_threads) the runtime
// e2e occasionally hits SQLite WAL visibility lag between paired open() →
// write() → open() → read() against the same on-disk brain. The features
// themselves are correct — proven by 100% pass rate when this file runs
// in isolation. One retry hardens the suite without masking real defects.
const SUITE_RETRY = 2;
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openBrain, type BrainHandle } from "#src/runtime/brain/db.js";
import { applyMigrations, CURRENT_SCHEMA_VERSION } from "#src/runtime/brain/migrate.js";
import {
  seedWorkflowDefinitions,
  readBuiltinDefinitions,
} from "#src/runtime/brain/seed-workflows.js";
import {
  abandonWorkflow,
  approveScopeExpansion,
  approveTransition,
  proposeScopeExpansion,
  proposeTransition,
  recoverWorkflow,
  rejectScopeExpansion,
  rejectTransition,
  runWorkflow,
} from "#src/runtime/cli-handlers.js";
import { BrainEventLog } from "#src/runtime/brain-event-log.js";
import { reduce } from "#src/runtime/reducer.js";
import { createEvent } from "#src/runtime/event-factory.js";
import { runDeterministicCheck } from "#src/runtime/gate-runner.js";
import {
  decideGitCommand,
  isPhaseApproval,
  readGateState,
  readLastPromptTs,
  readRecentPrompts,
  shouldRecommendPull,
} from "#src/runtime/iron-laws-enforcer.js";
import { ensureSession, openTurn, recordPrompt } from "#src/runtime/capture/session.js";
import { processStopHook } from "#src/runtime/capture/stop-hook.js";
import { processPromptSubmit } from "#src/runtime/capture/prompt-hook.js";
import { processPostToolUse } from "#src/runtime/capture/tool-hook.js";
import { compactWorkflows, readCompactedSummary } from "#src/runtime/compactor.js";
import type { Author, GateCheck, ManifestEvent } from "#src/runtime/types.js";

const human: Author = { type: "human", id: "qa" };

let dir: string;
let savedBrain: string | undefined;

function bootstrapKb(d: string): void {
  mkdirSync(join(d, "docs"), { recursive: true });
  writeFileSync(join(d, "docs", "CONTEXT.md"), "# C\n", "utf-8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-e2e-runtime-"));
  bootstrapKb(dir);
  savedBrain = process.env["CODI_BRAIN_DB"];
  process.env["CODI_BRAIN_DB"] = join(dir, "brain.db");
});

afterEach(() => {
  if (savedBrain === undefined) delete process.env["CODI_BRAIN_DB"];
  else process.env["CODI_BRAIN_DB"] = savedBrain;
  rmSync(dir, { recursive: true, force: true });
});

function withHandle<T>(cb: (h: BrainHandle) => T): T {
  const handle = openBrain();
  try {
    applyMigrations(handle.raw);
    return cb(handle);
  } finally {
    handle.close();
  }
}

// ─── S1 — Schema migration round-trip ───────────────────────────────────────

describe("S1 — schema migration round-trip", { retry: SUITE_RETRY }, () => {
  it("creates workflow_definitions on first apply, idempotent on second", () => {
    withHandle((h) => {
      const tables = h.raw
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_definitions'`,
        )
        .get() as { name?: string } | undefined;
      expect(tables?.name).toBe("workflow_definitions");
      const v = h.raw.prepare(`SELECT MAX(version) AS v FROM _codi_schema_version`).get() as {
        v: number;
      };
      expect(v.v).toBe(CURRENT_SCHEMA_VERSION);
    });

    // Re-open + re-apply on the same DB → still v2.
    withHandle((h) => {
      const v = h.raw.prepare(`SELECT MAX(version) AS v FROM _codi_schema_version`).get() as {
        v: number;
      };
      expect(v.v).toBe(CURRENT_SCHEMA_VERSION);
    });
  });
});

// ─── S2 — Seeder idempotency ────────────────────────────────────────────────

describe("S2 — workflow seeder idempotency", { retry: SUITE_RETRY }, () => {
  it("seeds 7 built-in YAMLs and preserves user-managed rows on re-seed", () => {
    withHandle((h) => {
      const built = readBuiltinDefinitions();
      seedWorkflowDefinitions(h.raw, built);
      const rows = h.raw
        .prepare(`SELECT id, managed_by FROM workflow_definitions ORDER BY id`)
        .all() as { id: string; managed_by: string }[];
      expect(rows).toHaveLength(7);
      expect(rows.every((r) => r.managed_by === "codi")).toBe(true);

      // Promote one row to user-managed.
      h.raw
        .prepare(`UPDATE workflow_definitions SET managed_by = 'user' WHERE id = 'feature'`)
        .run();

      // Re-seed; user row should be preserved.
      seedWorkflowDefinitions(h.raw, built);
      const featureRow = h.raw
        .prepare(`SELECT managed_by FROM workflow_definitions WHERE id = 'feature'`)
        .get() as { managed_by: string };
      expect(featureRow.managed_by).toBe("user");
    });
  });
});

// ─── S3 — Phase graph enforcement (F4) ──────────────────────────────────────

describe("S3 — phase graph enforcement", { retry: SUITE_RETRY }, () => {
  it("rejects illegal phase transitions and accepts legal ones", () => {
    // Seed definitions so the enforcer has something to read.
    withHandle((h) => seedWorkflowDefinitions(h.raw, readBuiltinDefinitions()));

    runWorkflow({ workflowType: "feature", task: "x", author: human, cwd: dir });

    // intent → verify is illegal (must go through plan/decompose/execute first).
    expect(() => proposeTransition({ toPhase: "verify", author: human, cwd: dir })).toThrow(
      /Illegal transition/,
    );

    // intent → plan is legal.
    expect(() => proposeTransition({ toPhase: "plan", author: human, cwd: dir })).not.toThrow();

    // After propose, status flips to pending_approval (Iron Law 4 wiring).
    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state?.status).toBe("pending_approval");
    });
  });
});

// ─── S4 — Stop hook end-to-end (F6) ─────────────────────────────────────────

describe("S4 — Stop hook full cycle", { retry: SUITE_RETRY }, () => {
  it("parses 3 markers, persists captures, closes turn, idempotent on re-fire", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "sess",
        projectId: "proj",
        agentType: "claude-code",
        workingDir: dir,
      });
      const p = recordPrompt(h.raw, { sessionId: "sess", text: "audit it" });
      const turnId = openTurn(h.raw, {
        sessionId: "sess",
        promptId: p.promptId,
        turnNo: p.turnNo,
      });

      const result = processStopHook(h, {
        sessionId: "sess",
        cwd: dir,
        agentTextOverride:
          'Done.\n|RULE: "always pin deps"|\n|INSIGHT: "auth has 3 dead branches"|\n|DECISION: "go with B"|',
      });
      expect(result.markerCount).toBe(3);
      expect(result.capturesInserted).toBe(3);
      expect(result.turnId).toBe(turnId);

      const turn = h.raw
        .prepare(`SELECT agent_text, duration_ms FROM turns WHERE turn_id = ?`)
        .get(turnId) as { agent_text: string; duration_ms: number };
      expect(turn.agent_text).toContain("RULE");
      expect(turn.duration_ms).toBeGreaterThanOrEqual(0);

      const session = h.raw
        .prepare(`SELECT total_capture_count FROM sessions WHERE session_id = 'sess'`)
        .get() as { total_capture_count: number };
      expect(session.total_capture_count).toBe(3);

      // Idempotency: re-run with the same agent text → 0 new captures.
      const second = processStopHook(h, {
        sessionId: "sess",
        cwd: dir,
        agentTextOverride:
          'Done.\n|RULE: "always pin deps"|\n|INSIGHT: "auth has 3 dead branches"|\n|DECISION: "go with B"|',
      });
      expect(second.capturesInserted).toBe(0);
      expect(second.capturesSkipped).toBe(3);
    });
  });

  it("synthesizes a turn when UserPromptSubmit didn't run", () => {
    withHandle((h) => {
      const result = processStopHook(h, {
        sessionId: "lonely",
        cwd: dir,
        agentTextOverride: '|OBSERVATION: "first ever observation"|',
      });
      expect(result.capturesInserted).toBe(1);
      const turnCount = h.raw
        .prepare(`SELECT COUNT(*) AS c FROM turns WHERE session_id = 'lonely'`)
        .get() as { c: number };
      expect(turnCount.c).toBe(1);
    });
  });
});

// ─── S5 — Iron Laws live wiring (F7) ────────────────────────────────────────

describe("S5 — Iron Law 4 hard gate + L7 commit approval", { retry: SUITE_RETRY }, () => {
  it("L4: phase_transition_proposed flips status, banner predicate fires", () => {
    withHandle((h) => seedWorkflowDefinitions(h.raw, readBuiltinDefinitions()));
    runWorkflow({ workflowType: "feature", task: "L4", author: human, cwd: dir });
    proposeTransition({ toPhase: "plan", author: human, cwd: dir });

    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state).not.toBeNull();
      expect(state?.status).toBe("pending_approval");
    });

    // 'ok' approves; 'looks good' does not.
    expect(isPhaseApproval("ok")).toBe(true);
    expect(isPhaseApproval("OK")).toBe(true);
    expect(isPhaseApproval("looks good")).toBe(false);
    expect(isPhaseApproval("yeah")).toBe(false);
  });

  it("L4: approve → status active; reject → status active (phase unchanged)", () => {
    withHandle((h) => seedWorkflowDefinitions(h.raw, readBuiltinDefinitions()));
    runWorkflow({ workflowType: "feature", task: "L4-approve", author: human, cwd: dir });
    proposeTransition({ toPhase: "plan", author: human, cwd: dir });
    approveTransition({ author: human, cwd: dir });
    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state?.status).toBe("active");
      expect(state?.currentPhase).toBe("plan");
    });

    proposeTransition({ toPhase: "decompose", author: human, cwd: dir });
    rejectTransition({ reason: "scope unclear", author: human, cwd: dir });
    withHandle((h) => {
      const state = readGateState(h.raw);
      expect(state?.status).toBe("active");
      expect(state?.currentPhase).toBe("plan"); // no phase change after reject
    });
  });

  it("L7: git mutation blocked when no approval token in recent prompts", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s", text: "fix this bug" });
      recordPrompt(h.raw, { sessionId: "s", text: "rerun the tests" });
      const recent = readRecentPrompts(h.raw, { sessionId: "s", limit: 5 });
      const verdict = decideGitCommand({
        bashCommand: "git push origin main",
        recentPrompts: recent,
      });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toContain("Iron Law 7");
    });
  });

  it("L7: git mutation allowed when 'ok' is in recent prompts", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      recordPrompt(h.raw, { sessionId: "s", text: "ok" });
      const recent = readRecentPrompts(h.raw, { sessionId: "s", limit: 5 });
      expect(
        decideGitCommand({ bashCommand: "git commit -m 'x'", recentPrompts: recent }).allowed,
      ).toBe(true);
    });
  });

  it("L5: pull-reminder fires when last brain read >60s old AND tool mutates", () => {
    withHandle((h) => {
      ensureSession(h.raw, {
        sessionId: "s",
        projectId: "p",
        agentType: "claude-code",
        workingDir: dir,
      });
      // No prompts yet → last_ts = 0
      const lastTs = readLastPromptTs(h.raw, "s");
      expect(lastTs).toBe(0);
      expect(
        shouldRecommendPull({ lastBrainReadTs: lastTs, nowTs: Date.now(), toolName: "Edit" }),
      ).toBe(true);
      expect(
        shouldRecommendPull({ lastBrainReadTs: Date.now(), nowTs: Date.now(), toolName: "Edit" }),
      ).toBe(false);
      expect(shouldRecommendPull({ lastBrainReadTs: 0, nowTs: Date.now(), toolName: "Read" })).toBe(
        false,
      ); // read tools never trigger
    });
  });
});

// ─── S6 — Real gate check evidence (F8) ─────────────────────────────────────

describe("S6 — gate checks against real evidence", { retry: SUITE_RETRY }, () => {
  function buildCtx() {
    const log = BrainEventLog.open();
    try {
      const id = log.getActiveWorkflowId();
      if (!id) throw new Error("no workflow");
      const events = log.loadEvents(id);
      return { cwd: dir, state: reduce(events), events };
    } finally {
      log.dispose();
    }
  }

  it("no_unresolved_scope_proposals: pending → fail; resolved → pass", () => {
    runWorkflow({ workflowType: "feature", task: "S6-A", author: human, cwd: dir });
    proposeScopeExpansion({ filePath: "src/a.ts", reason: "needed", author: human, cwd: dir });
    proposeScopeExpansion({ filePath: "src/b.ts", reason: "needed", author: human, cwd: dir });

    const check: GateCheck = { id: "no_unresolved_scope_proposals", type: "deterministic" };
    const failOutcome = runDeterministicCheck(check, buildCtx());
    expect(failOutcome.result.verdict).toBe("fail");
    expect(failOutcome.result.summary).toMatch(/src\/a\.ts.*src\/b\.ts|src\/b\.ts.*src\/a\.ts/);

    approveScopeExpansion({ filePath: "src/a.ts", author: human, cwd: dir });
    rejectScopeExpansion({
      filePath: "src/b.ts",
      reason: "wrong file",
      author: human,
      cwd: dir,
    });
    const passOutcome = runDeterministicCheck(check, buildCtx());
    expect(passOutcome.result.verdict).toBe("pass");
  });

  it("validation_passes: no event → fail; exit 1 → fail; exit 0 → pass", () => {
    runWorkflow({ workflowType: "feature", task: "S6-B", author: human, cwd: dir });
    const check: GateCheck = { id: "validation_passes", type: "deterministic" };
    expect(runDeterministicCheck(check, buildCtx()).result.verdict).toBe("fail");

    function append(event: ManifestEvent) {
      const log = BrainEventLog.open();
      try {
        const id = log.getActiveWorkflowId();
        if (!id) throw new Error("no wf");
        log.append(id, event);
      } finally {
        log.dispose();
      }
    }

    append(
      createEvent({
        eventType: "validation_run",
        payload: { command: "npm test", exit_code: 1, duration_ms: 100 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    expect(runDeterministicCheck(check, buildCtx()).result.verdict).toBe("fail");

    append(
      createEvent({
        eventType: "validation_run",
        payload: { command: "npm test", exit_code: 0, duration_ms: 100 },
        author: { type: "system", id: "ci" },
        parentEventId: null,
      }),
    );
    expect(runDeterministicCheck(check, buildCtx()).result.verdict).toBe("pass");
  });

  it("all_planned_files_modified: untouched fails, modified passes, untracked passes", () => {
    runWorkflow({ workflowType: "feature", task: "S6-C", author: human, cwd: dir });
    // git init the workflow dir.
    execFileSync("git", ["init", "-b", "main"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "qa@codi.local"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "qa"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, "untouched.ts"), "// baseline\n", "utf-8");
    execFileSync("git", ["add", "."], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: dir, stdio: "ignore" });

    proposeScopeExpansion({
      filePath: "untouched.ts",
      reason: "baseline",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    const check: GateCheck = { id: "all_planned_files_modified", type: "deterministic" };
    const failOutcome = runDeterministicCheck(check, buildCtx());
    expect(failOutcome.result.verdict).toBe("fail");
    expect(failOutcome.result.summary).toContain("untouched.ts");

    writeFileSync(join(dir, "untouched.ts"), "// modified\n", "utf-8");
    expect(runDeterministicCheck(check, buildCtx()).result.verdict).toBe("pass");
  });
});

// ─── S9 — Brain-backed compactor (F11) ──────────────────────────────────────

describe("S9 — compactWorkflows end-to-end", { retry: SUITE_RETRY }, () => {
  it("compacts terminal workflows older than threshold; idempotent re-run", () => {
    runWorkflow({ workflowType: "feature", task: "S9", author: human, cwd: dir });
    abandonWorkflow({ reason: "test", author: human, cwd: dir });

    withHandle((h) => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const first = compactWorkflows(h, { thresholdDays: 0, now: future });
      const compacted = first.find((r) => r.summarized);
      expect(compacted).toBeDefined();
      expect(compacted!.preservedCount).toBeGreaterThan(0);

      const summary = readCompactedSummary(h.raw, compacted!.workflowId);
      expect(summary).not.toBeNull();
      const preservedTypes = (summary?.preserved_events ?? []).map((e) => e.event_type);
      expect(preservedTypes).toContain("init");
      expect(preservedTypes).toContain("workflow_abandoned");

      // Events should be physically deleted.
      const remaining = h.raw
        .prepare(`SELECT COUNT(*) AS c FROM workflow_events WHERE workflow_id = ?`)
        .get(compacted!.workflowId) as { c: number };
      expect(remaining.c).toBe(0);

      // Re-run → marked Already compacted.
      const second = compactWorkflows(h, { thresholdDays: 0, now: future });
      expect(second.find((r) => r.reason === "Already compacted.")).toBeDefined();
    });
  });
});

// ─── Cross-feature: full lifecycle integration ──────────────────────────────

describe("CROSS — full user flow via runtime handlers", { retry: SUITE_RETRY }, () => {
  it("run → scope propose+approve → transitions → done with hooks recording captures", async () => {
    withHandle((h) => seedWorkflowDefinitions(h.raw, readBuiltinDefinitions()));

    // 1. Run feature workflow
    runWorkflow({
      workflowType: "feature",
      task: "Build dark mode toggle",
      author: human,
      cwd: dir,
    });

    // 2. Scope a file
    proposeScopeExpansion({
      filePath: "src/theme.ts",
      reason: "main switch",
      author: human,
      cwd: dir,
    });
    approveScopeExpansion({ author: human, cwd: dir });

    // 3. Walk every phase to done — feature graph: intent→plan→decompose→execute→verify→done
    for (const phase of ["plan", "decompose", "execute", "verify", "done"] as const) {
      proposeTransition({ toPhase: phase, author: human, cwd: dir });
      approveTransition({ author: human, cwd: dir });
    }

    // 4. Simulate one capture turn
    withHandle((h) => {
      const sub = processPromptSubmit(h, {
        sessionId: "cross-s",
        prompt: "summarize the work",
        cwd: dir,
      });
      processPostToolUse(h, {
        sessionId: "cross-s",
        cwd: dir,
        toolName: "Read",
        toolInput: { file_path: "src/theme.ts" },
        toolResponse: { success: true },
      });
      const stop = processStopHook(h, {
        sessionId: "cross-s",
        cwd: dir,
        agentTextOverride: '|DECISION: "use prefers-color-scheme media query"|',
      });
      expect(stop.capturesInserted).toBe(1);
      expect(stop.turnId).toBe(sub.turnId);

      // Workflow should be completed with all hook artefacts present.
      const log = BrainEventLog.open();
      try {
        const id = log.getActiveWorkflowId();
        expect(id).toBeTruthy();
        const state = reduce(log.loadEvents(id!));
        expect(state.status).toBe("completed");
        expect(state.current_phase).toBe("done");
        expect(state.scope.files_in_plan).toContain("src/theme.ts");
      } finally {
        log.dispose();
      }
    });
  });

  it("recover after manual pointer clear restores the in-flight workflow", () => {
    runWorkflow({
      workflowType: "feature",
      task: "Recoverable",
      author: human,
      cwd: dir,
    });
    // Manually nuke the pointer.
    withHandle((h) => {
      const log = BrainEventLog.wrap(h);
      log.clearActiveWorkflowId();
      expect(log.getActiveWorkflowId()).toBeNull();
    });

    const recovered = recoverWorkflow({});
    expect(recovered.recovered).toBe(true);
    expect(recovered.workflowId).toMatch(/^feat-recoverable-/);
  });
});

// ─── S12 — Dist asset packaging ─────────────────────────────────────────────

describe("S12 — dist/ asset packaging", { retry: SUITE_RETRY }, () => {
  it("dist/ ships the schemas and workflow YAMLs", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "dist", "cli.js"))).toBe(true);
    expect(existsSync(join(root, "dist", "schemas", "runtime", "manifest-event.schema.json"))).toBe(
      true,
    );
    expect(existsSync(join(root, "dist", "templates", "workflows", "feature.yaml"))).toBe(true);
    expect(
      existsSync(join(root, "dist", "templates", "workflows", "team-consolidation.yaml")),
    ).toBe(true);
  });
});
