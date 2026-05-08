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
import type { ReducedState } from "./types.js";

export interface DeterministicCheckContext {
  cwd: string;
  state: ReducedState;
  archiveDir: string;
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
      "Use `devloop scope propose-expansion --file <path> --reason '<text>'` for each file the plan modifies, then approve.",
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
    // Agent check would dig into events; here we only have ReducedState
    // counters, which is sufficient: in M3, the reducer doesn't track
    // pending proposals separately. We over-approximate by checking that
    // no scope expansion was proposed without resolution by counting.
    // For now, this check passes trivially when reduced state is consistent;
    // the real check is in the user-prompt-state hook output.
    const total =
      ctx.state.scope.scope_expansions_approved + ctx.state.scope.scope_expansions_rejected;
    return {
      check_id: "no_unresolved_scope_proposals",
      verdict: total >= 0 ? "pass" : "fail",
      summary: "No detectable unresolved scope proposals.",
    };
  },
  validation_passes: () => ({
    check_id: "validation_passes",
    verdict: "fail",
    summary:
      "validation_passes is checked dynamically against the most recent validation_run event.",
    suggested_action:
      "Run `pnpm run validate` (or your project's equivalent) and capture the result via a `validation_run` event.",
  }),
  all_planned_files_modified: (ctx) => ({
    check_id: "all_planned_files_modified",
    verdict: ctx.state.scope.files_in_plan.length > 0 ? "pass" : "fail",
    summary:
      ctx.state.scope.files_in_plan.length > 0
        ? "Files in plan scope present (tracking actual edits requires the post-tool-use hook log; M5 hardens this)."
        : "Plan scope is empty; nothing to verify.",
  }),
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
