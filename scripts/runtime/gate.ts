#!/usr/bin/env tsx
/**
 * gate CLI — runs deterministic checks for a named gate, identifies
 * remaining agent checks for the principal to dispatch as subagents.
 *
 * Subcommands:
 *   run <gate-name> [--workflow-skill <path>]
 *   continue --check <id> --verdict <pass|fail> --summary "<text>"
 *
 * The "run" command produces a JSON report on stdout. Deterministic checks
 * are evaluated locally; agent checks are listed under
 * `requires_subagent_dispatch` for the principal to handle.
 *
 * The "continue" command appends a verdict from a subagent dispatch to
 * the running gate state.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EventLog } from "../lib/event-log.js";
import { reduce } from "../lib/reducer.js";
import { createEvent } from "../lib/event-factory.js";
import {
  aggregateOutcomes,
  isAgentCheck,
  loadGateDefinition,
  runDeterministicCheck,
} from "../lib/gate-runner.js";
import type { CheckOutcome, GateRunResult } from "../lib/gate-types.js";
import { archiveDir } from "../lib/paths.js";

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function findWorkflowSkillContract(workflowType: string): Record<string, unknown> {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(
    here,
    "..",
    "skills",
    "workflows",
    `${workflowType}-workflow`,
    "contract.json",
  );
  if (!existsSync(path)) {
    fail(`Workflow contract not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

function cmdRun(positional: string[]): void {
  const gateName = positional[1];
  if (!gateName) fail("gate run requires a <gate-name>");

  const log = EventLog.fromCwd(process.cwd());
  const wId = log.getActiveWorkflowId();
  if (!wId) fail("No active workflow.");

  const events = log.loadEvents(wId);
  const state = reduce(events);
  const contract = findWorkflowSkillContract(state.workflow_type);
  const def = loadGateDefinition(contract as Parameters<typeof loadGateDefinition>[0], gateName);
  if (!def) fail(`Gate '${gateName}' not defined in ${state.workflow_type}-workflow contract.`);

  log.append(
    wId,
    createEvent({
      eventType: "gate_check_started",
      payload: { gate_name: gateName, check_id: gateName, check_type: "deterministic" },
      author: { type: "system", id: "gate-runner" },
      parentEventId: state.last_event_id,
    }),
  );

  const ctx = {
    cwd: process.cwd(),
    state,
    archiveDir: archiveDir(log.paths, wId),
  };

  const outcomes: CheckOutcome[] = [];
  const requiresSubagent: typeof def.checks = [];
  for (const check of def.checks) {
    if (isAgentCheck(check)) {
      requiresSubagent.push(check);
      continue;
    }
    const outcome = runDeterministicCheck(check, ctx);
    outcomes.push(outcome);
    log.append(
      wId,
      createEvent({
        eventType: outcome.result.verdict === "pass" ? "gate_check_passed" : "gate_check_failed",
        payload:
          outcome.result.verdict === "pass"
            ? {
                gate_name: gateName,
                check_id: outcome.result.check_id,
                duration_ms: 0,
              }
            : {
                gate_name: gateName,
                check_id: outcome.result.check_id,
                reason: outcome.result.summary ?? "Deterministic check failed.",
                retry_count: 0,
                retries_remaining: outcome.check.max_retries ?? 0,
                ...(outcome.result.suggested_action !== undefined
                  ? { suggested_action: outcome.result.suggested_action }
                  : {}),
              },
        author: { type: "system", id: "gate-runner" },
        parentEventId: null,
      }),
    );
  }

  const aggregate: GateRunResult = aggregateOutcomes(gateName, outcomes);

  const report = {
    gate: gateName,
    workflow_id: wId,
    deterministic: {
      passed: aggregate.passed,
      outcomes: aggregate.outcomes,
      failed_checks: aggregate.failed_checks,
    },
    requires_subagent_dispatch: requiresSubagent.map((c) => ({
      check_id: c.id,
      skill: c.skill,
      max_retries: c.max_retries ?? 0,
      next: `Dispatch via context: fork. Then run \`devloop gate continue --check ${c.id} --verdict pass|fail --summary '<text>'\`.`,
    })),
    overall_status:
      requiresSubagent.length === 0 ? (aggregate.passed ? "passed" : "failed") : "pending_subagent",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(aggregate.passed && requiresSubagent.length === 0 ? 0 : 2);
}

function cmdContinue(_positional: string[], flags: Record<string, string | boolean>): void {
  const checkId = flags["check"];
  const verdict = flags["verdict"];
  if (typeof checkId !== "string") fail("continue requires --check <id>");
  if (verdict !== "pass" && verdict !== "fail") fail("continue requires --verdict pass|fail");

  const log = EventLog.fromCwd(process.cwd());
  const wId = log.getActiveWorkflowId();
  if (!wId) fail("No active workflow.");

  log.append(
    wId,
    createEvent({
      eventType: verdict === "pass" ? "gate_check_passed" : "gate_check_failed",
      payload:
        verdict === "pass"
          ? { gate_name: "agent", check_id: checkId, duration_ms: 0 }
          : {
              gate_name: "agent",
              check_id: checkId,
              reason: typeof flags["summary"] === "string" ? flags["summary"] : "agent verdict",
              retry_count: 0,
              retries_remaining: 0,
            },
      author: { type: "system", id: "gate-runner" },
      parentEventId: null,
    }),
  );
  console.log(`Recorded ${verdict} for check ${checkId}.`);
  process.exit(verdict === "pass" ? 0 : 2);
}

function main(): void {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const sub = positional[0];

  switch (sub) {
    case "run":
      cmdRun(positional);
      break;
    case "continue":
      cmdContinue(positional, flags);
      break;
    default:
      console.error("gate CLI: subcommands are run, continue");
      process.exit(1);
  }
}

main();
