/**
 * Bridge: connects approveTransition to the gate-runner.
 *
 * Loads the active workflow's gate list for `fromPhase`, runs each
 * deterministic checker, persists gate_check_* events, and returns a
 * GateRunResult. Always returns. Fail-open: any thrown error becomes a
 * gate failure with the message in summary; never throws to the caller.
 *
 * Advisory by design — the caller (approveTransition) decides whether
 * to act on the result. Default behaviour is to approve regardless.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { CheckOutcome, GateCheck, GateRunResult } from "./gate-types.js";
import { aggregateOutcomes, runDeterministicCheck } from "./gate-runner.js";
import type { BrainEventLog } from "./brain-event-log.js";
import type { ManifestEvent, Phase, ReducedState } from "./types.js";
import { createEvent } from "./event-factory.js";

const SYSTEM_AUTHOR = { type: "system" as const, id: "codi" };

export interface BridgeContext {
  cwd: string;
  workflowType: string;
  workflowId: string;
  state: ReducedState;
  events: ManifestEvent[];
  log: BrainEventLog;
}

interface WorkflowYaml {
  id: string;
  phases: Record<string, { gates?: string[]; next?: string[] }>;
}

function findWorkflowYaml(workflowType: string): string | null {
  // Resolve relative to this compiled module so the lookup works whether
  // the runtime is invoked from inside the codi project itself, from the
  // bundled dist binary, or from a consumer scratch project (where
  // process.cwd() is unrelated).
  const filename = `${workflowType}.yaml`;
  const moduleAnchored: string[] = [];
  try {
    const here = new URL(".", import.meta.url).pathname;
    moduleAnchored.push(
      // Bundled dist: import.meta.url is dist/cli.js → dist/templates/...
      join(here, "templates", "workflows", filename),
      // tsx src: import.meta.url is src/runtime/... → src/templates/...
      join(here, "..", "templates", "workflows", filename),
      // Sibling-up fallback
      join(here, "..", "..", "templates", "workflows", filename),
    );
  } catch {
    /* import.meta.url may be unavailable under some test runners */
  }
  const candidates = [
    ...moduleAnchored,
    join(process.cwd(), "src", "templates", "workflows", filename),
    join(process.cwd(), "dist", "templates", "workflows", filename),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function gatesForPhase(workflowType: string, phase: Phase): string[] {
  const path = findWorkflowYaml(workflowType);
  if (!path) return [];
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = parseYaml(raw) as WorkflowYaml;
    const phaseSpec = parsed.phases?.[phase];
    return phaseSpec?.gates ?? [];
  } catch {
    return [];
  }
}

export function runPhaseGates(fromPhase: Phase, ctx: BridgeContext): GateRunResult {
  const gateNames = gatesForPhase(ctx.workflowType, fromPhase);
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
