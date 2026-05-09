/**
 * Gate runner — executes the deterministic checks in a gate and produces
 * structured outcomes. Agent (subagent) checks return a placeholder
 * outcome that signals the calling agent to dispatch the subagent and
 * continue via runAgentCheck once the verdict is available.
 *
 * This split lets the agent principal orchestrate: deterministic results
 * are computed locally; agent-typed checks need the agent's Task tool.
 */

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CheckOutcome,
  GateCheck,
  GateDefinition,
  GateResult,
  GateRunResult,
} from "./gate-types.js";
import type { ManifestEvent, ReducedState } from "./types.js";
import { git } from "./git-utils.js";

export interface DeterministicCheckContext {
  cwd: string;
  state: ReducedState;
  /** Raw event log — checkers may walk it when ReducedState is insufficient. */
  events?: ReadonlyArray<ManifestEvent>;
}

export type DeterministicChecker = (ctx: DeterministicCheckContext) => GateResult;

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
          "Run `pnpm run validate` (or your project's equivalent) and capture the result via a `validation_run` event.",
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
    const unchanged: string[] = [];
    for (const file of files) {
      const result = git(["status", "--porcelain", "--", file], ctx.cwd);
      if (!result.ok) {
        // Git failed (not a repo, etc.) — skip the check rather than fail-pass.
        return {
          check_id: "all_planned_files_modified",
          verdict: "fail",
          summary: `git status failed for ${file}: ${result.stderr.trim() || "unknown error"}`,
          suggested_action:
            "Verify the workflow is running inside a git repository and the file path is correct.",
        };
      }
      if (result.stdout.trim().length === 0) unchanged.push(file);
    }
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
};

export function isAgentCheck(check: GateCheck): boolean {
  return check.type === "agent";
}

export function runDeterministicCheck(
  check: GateCheck,
  ctx: DeterministicCheckContext,
): CheckOutcome {
  const checker = DETERMINISTIC_CHECKERS[check.id];
  if (!checker) {
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
  return { check, retries_used: 0, result: checker(ctx) };
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
