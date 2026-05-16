/**
 * Gate runner — executes the deterministic checks in a gate and produces
 * structured outcomes. Agent (subagent) checks return a placeholder
 * outcome that signals the calling agent to dispatch the subagent and
 * continue via runAgentCheck once the verdict is available.
 *
 * This split lets the agent principal orchestrate: deterministic results
 * are computed locally; agent-typed checks need the agent's Task tool.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckOutcome, GateCheck, GateDefinition, GateRunResult } from "./gate-types.js";
import type { ManifestEvent } from "./types.js";
import { findDecisionByKind, filterDecisionsByKind } from "./decision-kinds.js";
import { git } from "./git-utils.js";
import {
  getGate,
  registerGate,
  type DeterministicCheckContext as RegistryCtx,
  type DeterministicChecker,
} from "./gate-registry.js";

// Re-export so existing consumers that import the context shape from
// gate-runner keep working. The canonical home is now gate-registry.ts.
export type { DeterministicChecker } from "./gate-registry.js";
export type DeterministicCheckContext = RegistryCtx;

const DETERMINISTIC_CHECKERS: Record<string, DeterministicChecker> = {
  task_described: (ctx) => ({
    check_id: "task_described",
    verdict: ctx.state.task.length > 0 ? "pass" : "fail",
    summary: ctx.state.task.length > 0 ? "Task is described." : "Task is empty.",
    suggested_action: "Set the task at workflow init.",
  }),
  scope_files_listed: (ctx) => ({
    check_id: "scope_files_listed",
    verdict: ctx.state.scope.files_in_plan.length >= 1 ? "pass" : "fail",
    summary:
      ctx.state.scope.files_in_plan.length >= 1
        ? `${ctx.state.scope.files_in_plan.length} file(s) in plan scope.`
        : "scope.files_in_plan is empty.",
    suggested_action:
      "Use `codi workflow scope propose-expansion --file <path> --reason '<text>'` for each file the plan modifies, then approve.",
  }),
  plan_artifact_exists: (ctx) => {
    const docsDir = resolve(ctx.cwd, "docs");
    if (!existsSync(docsDir)) {
      return {
        check_id: "plan_artifact_exists",
        verdict: "fail",
        summary: "docs/ directory does not exist.",
        suggested_action: "Create the plan markdown at docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md.",
      };
    }
    const files = readdirSync(docsDir);
    const planFile = files.find((f) => /^\d{8}_\d{6}_\[PLAN\]_.*\.md$/.test(f));
    return {
      check_id: "plan_artifact_exists",
      verdict: planFile ? "pass" : "fail",
      summary: planFile ? `Plan artifact: docs/${planFile}` : "No plan markdown found.",
      ...(planFile
        ? {}
        : {
            suggested_action:
              "Write the plan at docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md following the categorized doc convention.",
          }),
    };
  },
  no_unresolved_scope_proposals: (ctx) => {
    // F8 — real check: walk the event log per-file, tally proposed vs
    // approved/rejected. Files in scope.files_in_plan are pre-resolved
    // (they ARE in scope) so we ignore proposals matching them.
    if (!ctx.events || ctx.events.length === 0) {
      return {
        check_id: "no_unresolved_scope_proposals",
        verdict: "pass",
        summary: "No events provided; no unresolved proposals possible.",
      };
    }
    const proposedCount = new Map<string, number>();
    const resolvedCount = new Map<string, number>();
    for (const e of ctx.events) {
      if (e.event_type === "scope_expansion_proposed") {
        const p = e.payload as { file_path?: string };
        if (p.file_path) proposedCount.set(p.file_path, (proposedCount.get(p.file_path) ?? 0) + 1);
      } else if (
        e.event_type === "scope_expansion_approved" ||
        e.event_type === "scope_expansion_rejected"
      ) {
        const p = e.payload as { file_path?: string };
        if (p.file_path) resolvedCount.set(p.file_path, (resolvedCount.get(p.file_path) ?? 0) + 1);
      }
    }
    const unresolved: string[] = [];
    for (const [file, proposed] of proposedCount.entries()) {
      const resolved = resolvedCount.get(file) ?? 0;
      if (resolved < proposed) unresolved.push(file);
    }
    if (unresolved.length === 0) {
      return {
        check_id: "no_unresolved_scope_proposals",
        verdict: "pass",
        summary: "All scope expansion proposals are resolved.",
      };
    }
    return {
      check_id: "no_unresolved_scope_proposals",
      verdict: "fail",
      summary: `${unresolved.length} unresolved scope expansion proposal(s): ${unresolved.join(", ")}`,
      suggested_action:
        "Approve or reject each pending proposal via " +
        "`codi workflow scope approve --file <path>` / " +
        "`codi workflow scope reject --file <path> --reason '<text>'`.",
    };
  },
  validation_passes: (ctx) => {
    // F8 — real check: find the most recent `validation_run` event and
    // require exit_code === 0. Latest wins so re-runs supersede earlier
    // failures.
    const events = ctx.events ?? [];
    let latest: ManifestEvent | undefined;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i];
      if (e?.event_type === "validation_run") {
        latest = e;
        break;
      }
    }
    if (!latest) {
      return {
        check_id: "validation_passes",
        verdict: "fail",
        summary: "No validation_run event recorded yet.",
        suggested_action:
          "Run `npm run validate` (or your project's equivalent) and capture the result via a `validation_run` event.",
      };
    }
    const payload = latest.payload as { command?: string; exit_code?: number };
    const ok = payload.exit_code === 0;
    return {
      check_id: "validation_passes",
      verdict: ok ? "pass" : "fail",
      summary: ok
        ? `Latest validation passed: \`${payload.command ?? "?"}\` exit 0.`
        : `Latest validation failed: \`${payload.command ?? "?"}\` exit ${payload.exit_code ?? "?"}.`,
      ...(ok
        ? {}
        : {
            suggested_action:
              "Fix the underlying failure, re-run validation, and append a fresh validation_run event.",
          }),
    };
  },
  all_planned_files_modified: (ctx) => {
    // F8 — real check: probe git for the diff. A planned file counts as
    // modified when `git status --porcelain -- <path>` reports a non-empty
    // status. Untracked files (?? prefix) also count — they're new files
    // the workflow created.
    const files = ctx.state.scope.files_in_plan;
    if (files.length === 0) {
      return {
        check_id: "all_planned_files_modified",
        verdict: "fail",
        summary: "Plan scope is empty; nothing to verify.",
        suggested_action:
          "Add at least one file to the plan via `codi workflow scope propose-expansion --file <path>`.",
      };
    }
    // CORE-028: single `git status --porcelain -- <files...>` instead of
    // N spawns. Git accepts multiple pathspecs and only outputs lines for
    // files with working-tree changes; planned files absent from the
    // output are unchanged.
    const result = git(["status", "--porcelain", "--", ...files], ctx.cwd);
    if (!result.ok) {
      return {
        check_id: "all_planned_files_modified",
        verdict: "fail",
        summary: `git status failed: ${result.stderr.trim() || "unknown error"}`,
        suggested_action:
          "Verify the workflow is running inside a git repository and every planned file path is valid.",
      };
    }
    const changed = parsePorcelainPaths(result.stdout);
    const unchanged: string[] = files.filter((f) => !changed.has(f));
    if (unchanged.length === 0) {
      return {
        check_id: "all_planned_files_modified",
        verdict: "pass",
        summary: `All ${files.length} planned file(s) have working-tree changes.`,
      };
    }
    return {
      check_id: "all_planned_files_modified",
      verdict: "fail",
      summary: `${unchanged.length} of ${files.length} planned file(s) have no changes: ${unchanged.join(", ")}`,
      suggested_action:
        "Edit the listed files, or remove them from scope if they are no longer needed.",
    };
  },
  /**
   * Q7 — bug-fix.reproduce gate. Passes when:
   *  - the dev declared `reproducer_exists: true` in the adaptive intake, OR
   *  - the event log carries a `decision_recorded` event whose payload signals
   *    a reproducer was built (kind === "reproducer_built" or content matches
   *    /reproducer/i).
   * Otherwise fails with a clear pointer to record the marker.
   */
  reproducer_event_exists: (ctx) => {
    const initEvent = (ctx.events ?? []).find((e) => e.event_type === "init");
    const initPayload = (initEvent?.payload ?? {}) as {
      bug_fix_adaptation?: { reproducer_exists?: boolean };
    };
    if (initPayload.bug_fix_adaptation?.reproducer_exists === true) {
      return {
        check_id: "reproducer_event_exists",
        verdict: "pass",
        summary: "Reproducer declared in adaptive intake (reproducer_exists=true).",
      };
    }
    const reproducerEvent =
      findDecisionByKind(ctx.events ?? [], "reproducer_built") ??
      (ctx.events ?? []).find((e) => {
        if (e.event_type !== "decision_recorded") return false;
        const content = (e.payload as { content?: unknown }).content;
        return typeof content === "string" && /reproducer/i.test(content);
      });
    if (reproducerEvent !== undefined) {
      return {
        check_id: "reproducer_event_exists",
        verdict: "pass",
        summary: "Reproducer marker recorded in the event log.",
      };
    }
    return {
      check_id: "reproducer_event_exists",
      verdict: "fail",
      summary: "No reproducer marker found — bug-fix needs a feedback loop before planning.",
      suggested_action:
        'Build a deterministic failing reproducer, then record it via `codi workflow scope propose-expansion` (with the test file) plus a `decision_recorded` event whose payload includes `kind: "reproducer_built"`. Or set `--reproducer-exists` at run time when a reproducer already exists.',
    };
  },
  /**
   * Q7 — bug-fix.execute gate. Enforces TDD discipline: a regression test must
   * exist before the production fix lands. Passes when:
   *  - the adaptive intake says `root_cause_known: true` AND `reproducer_exists: true`
   *    (incident path — post-mortem replaces the test artifact), OR
   *  - the event log carries a `decision_recorded` with kind === "regression_test_added".
   * Fails otherwise.
   */
  tdd_first_test_exists: (ctx) => {
    const initEvent = (ctx.events ?? []).find((e) => e.event_type === "init");
    const initPayload = (initEvent?.payload ?? {}) as {
      bug_fix_adaptation?: { reproducer_exists?: boolean; root_cause_known?: boolean };
    };
    const a = initPayload.bug_fix_adaptation;
    if (a?.reproducer_exists === true && a?.root_cause_known === true) {
      return {
        check_id: "tdd_first_test_exists",
        verdict: "pass",
        summary: "Adaptive intake skipped TDD discipline (reproducer + root cause both declared).",
      };
    }
    const testEvent = findDecisionByKind(ctx.events ?? [], "regression_test_added");
    if (testEvent !== undefined) {
      return {
        check_id: "tdd_first_test_exists",
        verdict: "pass",
        summary: "Regression test recorded before execute — TDD discipline satisfied.",
      };
    }
    return {
      check_id: "tdd_first_test_exists",
      verdict: "fail",
      summary: "No regression test marker — TDD requires the failing test before the fix.",
      suggested_action:
        'Add the regression test FIRST (RED), record a `decision_recorded` event with `kind: "regression_test_added"` and the test path, then write the production fix to turn it GREEN.',
    };
  },
  /**
   * O2 — refactor.baseline gate. Verifies the dev captured an unrefactored
   * test snapshot before mutating code. Passes when the event log carries a
   * `decision_recorded` event with `kind: "baseline_captured"` and a non-empty
   * `summary` field referencing the test command + result.
   */
  baseline_captured: (ctx) => {
    const found = findDecisionByKind(ctx.events ?? [], "baseline_captured");
    if (found !== undefined) {
      return {
        check_id: "baseline_captured",
        verdict: "pass",
        summary: "Baseline test snapshot recorded.",
      };
    }
    return {
      check_id: "baseline_captured",
      verdict: "fail",
      summary: "No baseline_captured marker — refactor needs unrefactored test pass first.",
      suggested_action:
        'Run the project\'s test command, confirm green, and append a decision_recorded event with `kind: "baseline_captured"` and the command/output as the summary.',
    };
  },
  /**
   * O2 — refactor.verify gate. Verifies the post-refactor diff did not break
   * observable behaviour. Passes when a `decision_recorded` event with
   * `kind: "behavior_unchanged"` exists, OR when the adaptive intake declared
   * `kind: "deadcode"` (dead-code removal has no behaviour by definition).
   */
  behavior_unchanged: (ctx) => {
    const initEvent = (ctx.events ?? []).find((e) => e.event_type === "init");
    const adaptation = (initEvent?.payload ?? {}) as {
      refactor_adaptation?: { kind?: string };
    };
    if (adaptation.refactor_adaptation?.kind === "deadcode") {
      return {
        check_id: "behavior_unchanged",
        verdict: "pass",
        summary: "Refactor kind=deadcode — no behaviour to preserve.",
      };
    }
    const found = findDecisionByKind(ctx.events ?? [], "behavior_unchanged");
    if (found !== undefined) {
      return {
        check_id: "behavior_unchanged",
        verdict: "pass",
        summary: "Behaviour preservation marker recorded.",
      };
    }
    return {
      check_id: "behavior_unchanged",
      verdict: "fail",
      summary: "No behavior_unchanged marker — re-run baseline tests post-refactor.",
      suggested_action:
        'Re-run the test command captured at baseline. If green, append a decision_recorded event with `kind: "behavior_unchanged"` and the command/output as proof.',
    };
  },
  /**
   * O2 — migration.plan gate. Migrations always require a documented
   * rollback path. Passes when the plan markdown contains a `## Rollback`
   * (or `### Rollback`) section.
   */
  rollback_documented: (ctx) => {
    const docsDir = resolve(ctx.cwd, "docs");
    if (!existsSync(docsDir)) {
      return {
        check_id: "rollback_documented",
        verdict: "fail",
        summary: "docs/ directory does not exist.",
        suggested_action: "Create the plan markdown with a `## Rollback` section.",
      };
    }
    const files = readdirSync(docsDir);
    const planFile = files.find((f) => /^\d{8}_\d{6}_\[PLAN\]_.*\.md$/.test(f));
    if (!planFile) {
      return {
        check_id: "rollback_documented",
        verdict: "fail",
        summary: "No plan markdown found.",
        suggested_action:
          "Create docs/YYYYMMDD_HHMMSS_[PLAN]_<slug>.md with a `## Rollback` section.",
      };
    }
    let content = "";
    try {
      content = readFileSync(resolve(docsDir, planFile), "utf8");
    } catch {
      return {
        check_id: "rollback_documented",
        verdict: "fail",
        summary: `Could not read docs/${planFile}.`,
      };
    }
    const hasRollbackSection = /^#{2,3}\s+Rollback\b/im.test(content);
    return {
      check_id: "rollback_documented",
      verdict: hasRollbackSection ? "pass" : "fail",
      summary: hasRollbackSection
        ? `Rollback section present in docs/${planFile}.`
        : `No "## Rollback" section in docs/${planFile}.`,
      ...(hasRollbackSection
        ? {}
        : {
            suggested_action:
              "Add a `## Rollback` section to the plan describing the exact steps to revert.",
          }),
    };
  },
  /**
   * O2 — migration.data-validation gate. Verifies pre/post metrics were
   * captured. Passes when a `decision_recorded` event with
   * `kind: "migration_metrics_captured"` exists and the payload carries
   * `pre` and `post` row-count fields.
   */
  migration_metrics_captured: (ctx) => {
    const candidate = findDecisionByKind(ctx.events ?? [], "migration_metrics_captured");
    const candidatePayload = candidate?.payload as { pre?: unknown; post?: unknown } | undefined;
    const found =
      candidate !== undefined &&
      candidatePayload?.pre !== undefined &&
      candidatePayload.post !== undefined
        ? candidate
        : undefined;
    if (found !== undefined) {
      return {
        check_id: "migration_metrics_captured",
        verdict: "pass",
        summary: "Migration pre/post metrics recorded.",
      };
    }
    return {
      check_id: "migration_metrics_captured",
      verdict: "fail",
      summary: "No migration metrics marker — capture row counts pre/post.",
      suggested_action:
        'Run row-count queries before and after the migration and append a decision_recorded event with `kind: "migration_metrics_captured"` and `pre`, `post` payload fields.',
    };
  },
};

/**
 * Team-consolidation gate checkers (scoped to workflowType === "team-consolidation"
 * at registration). The workflow ships `agent_driven: true`, so the agent
 * does the substantive work; these checkers verify the *audit trail*
 * (manifest event markers + filesystem evidence) it must leave behind.
 *
 * Each gate maps to one observable contract:
 *  - `scope_described`        — workflow `task` set (alias of task_described)
 *  - `mode_chosen`            — init payload carries mode ∈ {local, team}
 *  - `brains_path_known`      — init payload carries brains_path + path exists
 *  - `brains_listed`          — decision_recorded kind="brains_enumerated"
 *  - `dev_layout_validated`   — decision_recorded kind="dev_layout_validated", invalid=0
 *  - `per_dev_findings_done`  — N decision_recorded kind="dev_findings" ≥ brains.length
 *  - `report_written`         — docs/ has a YYYYMMDD_HHMMSS_[REPORT]_*.md file
 */
const TEAM_CONSOLIDATION_CHECKERS: Record<string, DeterministicChecker> = {
  scope_described: (ctx) => ({
    check_id: "scope_described",
    verdict: ctx.state.task.length > 0 ? "pass" : "fail",
    summary: ctx.state.task.length > 0 ? "Scope described." : "Scope is empty.",
    suggested_action: "Set the workflow task at init.",
  }),
  mode_chosen: (ctx) => {
    const initEvent = (ctx.events ?? []).find((e) => e.event_type === "init");
    const payload = (initEvent?.payload ?? {}) as {
      team_consolidation_adaptation?: { mode?: string };
    };
    const mode = payload.team_consolidation_adaptation?.mode;
    const ok = mode === "local" || mode === "team";
    return {
      check_id: "mode_chosen",
      verdict: ok ? "pass" : "fail",
      summary: ok ? `Mode chosen: ${mode}.` : "Mode not chosen.",
      suggested_action:
        "Pass `--mode local` or `--mode team` at workflow init so team_consolidation_adaptation.mode is recorded.",
    };
  },
  brains_path_known: (ctx) => {
    const initEvent = (ctx.events ?? []).find((e) => e.event_type === "init");
    const payload = (initEvent?.payload ?? {}) as {
      team_consolidation_adaptation?: { brains_path?: string };
    };
    const brainsPath = payload.team_consolidation_adaptation?.brains_path;
    const ok = typeof brainsPath === "string" && brainsPath.length > 0 && existsSync(brainsPath);
    return {
      check_id: "brains_path_known",
      verdict: ok ? "pass" : "fail",
      summary: ok
        ? `Brains path: ${brainsPath}.`
        : "Brains path missing from init payload or not present on disk.",
      suggested_action:
        "Pass `--brains-path <dir>` at init so the workflow records team_consolidation_adaptation.brains_path.",
    };
  },
  brains_listed: (ctx) => {
    const ev = findDecisionByKind(ctx.events ?? [], "brains_enumerated");
    const brains = (ev?.payload as { brains?: unknown[] } | undefined)?.brains;
    const count = Array.isArray(brains) ? brains.length : 0;
    return {
      check_id: "brains_listed",
      verdict: count > 0 ? "pass" : "fail",
      summary:
        count > 0 ? `${count} brain(s) enumerated.` : "No brains_enumerated marker recorded.",
      suggested_action:
        'Append a decision_recorded event with `kind: "brains_enumerated"` and a non-empty `brains` array (one entry per dev brain.db discovered).',
    };
  },
  dev_layout_validated: (ctx) => {
    const ev = findDecisionByKind(ctx.events ?? [], "dev_layout_validated");
    if (ev === undefined) {
      return {
        check_id: "dev_layout_validated",
        verdict: "fail",
        summary: "No dev_layout_validated marker recorded.",
        suggested_action:
          'After inspecting each dev brain.db schema, append a decision_recorded event with `kind: "dev_layout_validated"` and `invalid: 0` once all layouts pass.',
      };
    }
    const payload = ev.payload as { invalid?: number; valid?: number };
    const invalid = payload.invalid ?? -1;
    const valid = payload.valid ?? 0;
    const ok = invalid === 0;
    return {
      check_id: "dev_layout_validated",
      verdict: ok ? "pass" : "fail",
      summary: ok
        ? `Dev layout validated (${valid} valid, 0 invalid).`
        : `Dev layout marker present but ${invalid} invalid entr(y/ies) remain.`,
      suggested_action: ok
        ? undefined
        : 'Repair the invalid dev brain.db files (missing tables, wrong schema) and re-emit `kind: "dev_layout_validated"` with `invalid: 0`.',
    };
  },
  per_dev_findings_done: (ctx) => {
    const events = ctx.events ?? [];
    const enumerated = findDecisionByKind(events, "brains_enumerated");
    const brains = (enumerated?.payload as { brains?: unknown[] } | undefined)?.brains;
    const expected = Array.isArray(brains) ? brains.length : 0;
    const found = filterDecisionsByKind(events, "dev_findings").length;
    const ok = expected > 0 && found >= expected;
    return {
      check_id: "per_dev_findings_done",
      verdict: ok ? "pass" : "fail",
      summary: `Findings recorded: ${found}/${expected} dev(s).`,
      suggested_action: ok
        ? undefined
        : 'For each dev in `brains_enumerated.brains`, append a decision_recorded event with `kind: "dev_findings"` referencing the dev_id.',
    };
  },
  report_written: (ctx) => {
    const docsDir = resolve(ctx.cwd, "docs");
    if (!existsSync(docsDir)) {
      return {
        check_id: "report_written",
        verdict: "fail",
        summary: "docs/ directory does not exist.",
        suggested_action:
          "Write the consolidation report to docs/YYYYMMDD_HHMMSS_[REPORT]_consolidation.md.",
      };
    }
    const reports = readdirSync(docsDir).filter((name) =>
      /^\d{8}_\d{6}_\[REPORT\]_.*\.md$/.test(name),
    );
    return {
      check_id: "report_written",
      verdict: reports.length > 0 ? "pass" : "fail",
      summary:
        reports.length > 0
          ? `${reports.length} [REPORT] file(s) present in docs/.`
          : "No docs/YYYYMMDD_HHMMSS_[REPORT]_*.md file found.",
      suggested_action:
        reports.length > 0
          ? undefined
          : "Write the consolidation report to docs/ following the YYYYMMDD_HHMMSS_[REPORT]_<slug>.md naming.",
    };
  },
};

// Module-init: publish every deterministic checker declared above into
// the gate-registry so consumers (gate-runner-bridge, future agent-
// dispatcher) can resolve a flat YAML gate id without importing this
// file. Re-registering on subsequent loads is a no-op overwrite (intended
// behaviour for test harnesses that reset and re-import).
for (const [id, checker] of Object.entries(DETERMINISTIC_CHECKERS)) {
  registerGate({ id, type: "deterministic", checker });
}
// Team-consolidation gates are scoped to that workflow type so they cannot
// silently apply to bug-fix / feature / refactor workflows whose YAML
// happens to reference the same id (none do today; scoping is a guardrail).
for (const [id, checker] of Object.entries(TEAM_CONSOLIDATION_CHECKERS)) {
  registerGate({
    id,
    type: "deterministic",
    checker,
    requiredWorkflowTypes: ["team-consolidation"],
  });
}

/**
 * Parse `git status --porcelain` v1 output into a Set of file paths with
 * working-tree changes. Each non-empty line carries the shape
 * `XY<space>filename` where `XY` is a 2-char status. Rename entries use
 * `R  old -> new`; both sides count as "touched" because either path
 * appearing in the plan should pass the check.
 *
 * CORE-028 — exported so the gate-runner test suite can assert the
 * parser directly without going through `git status`.
 */
export function parsePorcelainPaths(stdout: string): Set<string> {
  const out = new Set<string>();
  for (const raw of stdout.split("\n")) {
    if (raw.length < 4) continue;
    const rest = raw.substring(3);
    const arrow = rest.indexOf(" -> ");
    if (arrow >= 0) {
      out.add(rest.substring(0, arrow));
      out.add(rest.substring(arrow + 4));
    } else {
      out.add(rest);
    }
  }
  return out;
}

export function isAgentCheck(check: GateCheck): boolean {
  return check.type === "agent";
}

export function runDeterministicCheck(
  check: GateCheck,
  ctx: DeterministicCheckContext,
): CheckOutcome {
  const spec = getGate(check.id);
  if (!spec || spec.type !== "deterministic") {
    return {
      check,
      retries_used: 0,
      result: {
        check_id: check.id,
        verdict: "pass",
        summary: `No deterministic checker registered for ${check.id} (advisory).`,
      },
    };
  }
  return { check, retries_used: 0, result: spec.checker(ctx) };
}

export function aggregateOutcomes(gateName: string, outcomes: CheckOutcome[]): GateRunResult {
  const failed = outcomes.filter((o) => o.result.verdict === "fail");
  const passed = failed.length === 0;
  const totalRetriesAllowed = outcomes.reduce((sum, o) => sum + (o.check.max_retries ?? 0), 0);
  const totalRetriesUsed = outcomes.reduce((sum, o) => sum + o.retries_used, 0);
  return {
    gate_name: gateName,
    passed,
    outcomes,
    failed_checks: failed,
    retries_remaining: Math.max(0, totalRetriesAllowed - totalRetriesUsed),
    next_step: passed
      ? `Gate '${gateName}' passed. Propose phase transition.`
      : `Gate '${gateName}' failed. Address failed checks and re-run.`,
  };
}

export function loadGateDefinition(
  contract: { gates?: Record<string, GateDefinition> },
  gateName: string,
): GateDefinition | null {
  const gates = contract.gates ?? {};
  const def = gates[gateName];
  return def ?? null;
}
