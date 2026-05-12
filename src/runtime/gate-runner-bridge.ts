/**
 * Bridge: connects approveTransition to the gate-runner.
 *
 * Loads the active workflow's gate list for `fromPhase` from the
 * brain-backed `workflow_definitions` table (seeded by `applyMigrations`
 * from `src/templates/workflows/*.yaml`), runs each deterministic checker,
 * persists gate_check_* events, and returns a GateRunResult.
 *
 * Always returns. Fail-open: any thrown error (including missing workflow
 * type or empty gate set) becomes an empty outcome list; the caller
 * decides whether to act on the result. Default behaviour is to approve
 * regardless.
 */

import type { CheckOutcome, GateCheck, GateRunResult } from "./gate-types.js";
import { aggregateOutcomes, runDeterministicCheck } from "./gate-runner.js";
import type { BrainEventLog } from "./brain-event-log.js";
import type { ManifestEvent, Phase, ReducedState } from "./types.js";
import { createEvent } from "./event-factory.js";
import { gatesForPhase as wfGatesForPhase } from "./workflow-graph.js";

const SYSTEM_AUTHOR = { type: "system" as const, id: "codi" };

export interface BridgeContext {
  cwd: string;
  workflowType: string;
  workflowId: string;
  state: ReducedState;
  events: ManifestEvent[];
  log: BrainEventLog;
}

function gatesForPhase(log: BrainEventLog, workflowType: string, phase: Phase): readonly string[] {
  try {
    return wfGatesForPhase(log.privateRaw, workflowType, phase);
  } catch {
    // UnknownWorkflowTypeError or any other read error → fail-open with no
    // gates, matching the previous YAML-reader behaviour. The transition
    // proceeds; legality is enforced separately by assertLegalTransition.
    return [];
  }
}

export function runPhaseGates(fromPhase: Phase, ctx: BridgeContext): GateRunResult {
  const gateNames = gatesForPhase(ctx.log, ctx.workflowType, fromPhase);
  const checks: GateCheck[] = gateNames.map((id) => ({ id, type: "deterministic" }));
  const outcomes: CheckOutcome[] = [];

  for (const check of checks) {
    const startTs = Date.now();
    try {
      ctx.log.append(
        ctx.workflowId,
        createEvent({
          eventType: "gate_check_started",
          payload: {
            gate_name: fromPhase,
            check_id: check.id,
            check_type: check.type,
          },
          author: SYSTEM_AUTHOR,
          parentEventId: null,
        }),
      );
    } catch {
      /* persistence failure does not block the check itself */
    }

    let outcome: CheckOutcome;
    try {
      outcome = runDeterministicCheck(check, {
        cwd: ctx.cwd,
        state: ctx.state,
        events: ctx.events,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      outcome = {
        check,
        retries_used: 0,
        result: {
          check_id: check.id,
          verdict: "fail",
          summary: `Bridge error running ${check.id}: ${message}`,
        },
      };
    }

    try {
      const passed = outcome.result.verdict === "pass";
      const event = passed
        ? createEvent({
            eventType: "gate_check_passed",
            payload: {
              gate_name: fromPhase,
              check_id: check.id,
              duration_ms: Math.max(0, Date.now() - startTs),
            },
            author: SYSTEM_AUTHOR,
            parentEventId: null,
          })
        : createEvent({
            eventType: "gate_check_failed",
            payload: {
              gate_name: fromPhase,
              check_id: check.id,
              reason: outcome.result.summary ?? `Gate ${check.id} failed`,
              retry_count: 0,
              retries_remaining: 0,
              suggested_action: outcome.result.suggested_action ?? "",
            },
            author: SYSTEM_AUTHOR,
            parentEventId: null,
          });
      ctx.log.append(ctx.workflowId, event);
    } catch {
      /* persistence failure does not block the result */
    }

    outcomes.push(outcome);
  }

  return aggregateOutcomes(fromPhase, outcomes);
}

export function formatGateAdvisory(result: GateRunResult): string {
  const lines: string[] = [];
  lines.push(
    `Gates for phase '${result.gate_name}' ran. ${
      result.passed ? "All passed." : "Some failed (advisory — transition still completes)."
    }`,
  );
  for (const outcome of result.outcomes) {
    if (outcome.result.verdict === "pass") continue;
    const id = outcome.check.id;
    lines.push(`  [${id}] ${outcome.result.summary ?? ""}`);
    const sa = outcome.result.suggested_action;
    if (sa && sa.length > 0) lines.push(`    → ${sa}`);
  }
  return lines.join("\n");
}
