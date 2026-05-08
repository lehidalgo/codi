/**
 * Stats handler — aggregates archived workflows for the `devloop stats`
 * subcommand. Reads every archive directory, runs the reducer, and rolls
 * up duration / token / gate-failure metrics plus a per-type counter.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { EventLog } from "../event-log.js";
import { reduce } from "../reducer.js";
import type { ManifestEvent } from "../types.js";

export interface DurationStats {
  totalDurationMs: number;
  averageDurationMs: number;
  workflowCount: number;
}

export interface TokenStats {
  totalTokens: number;
  averageTokensPerWorkflow: number;
  workflowCount: number;
}

export interface RetryStats {
  totalGateChecks: number;
  totalGateFailures: number;
  failureRate: number;
}

export function computeWorkflowStats(opts: { cwd?: string }): {
  durations: DurationStats;
  tokens: TokenStats;
  retries: RetryStats;
  byWorkflowType: Record<string, number>;
} {
  const log = EventLog.fromCwd(opts.cwd ?? process.cwd());
  const archivesDir = log.paths.archivesDir;
  const result = {
    durations: { totalDurationMs: 0, averageDurationMs: 0, workflowCount: 0 },
    tokens: { totalTokens: 0, averageTokensPerWorkflow: 0, workflowCount: 0 },
    retries: { totalGateChecks: 0, totalGateFailures: 0, failureRate: 0 },
    byWorkflowType: {} as Record<string, number>,
  };

  if (!existsSync(archivesDir)) return result;
  const archives = readdirSync(archivesDir);
  for (const id of archives) {
    const dir = join(archivesDir, id);
    if (!statSync(dir).isDirectory()) continue;

    const files = readdirSync(dir).filter((n) => /^\d{3}_[a-z_]+\.json$/.test(n));
    if (files.length === 0) continue;

    const events: ManifestEvent[] = [];
    for (const f of files) {
      try {
        const data = readFileSync(join(dir, f), "utf-8");
        events.push(JSON.parse(data) as ManifestEvent);
      } catch {
        // skip corrupted entries
      }
    }
    if (events.length === 0) continue;

    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const state = reduce(events);

    result.durations.workflowCount += 1;
    result.durations.totalDurationMs +=
      new Date(state.last_event_timestamp).getTime() - new Date(state.started_at).getTime();

    result.tokens.workflowCount += 1;
    result.tokens.totalTokens += state.subagent_stats.total_tokens_consumed;

    for (const e of events) {
      if (e.event_type === "gate_check_started") result.retries.totalGateChecks += 1;
      if (e.event_type === "gate_check_failed") result.retries.totalGateFailures += 1;
    }

    result.byWorkflowType[state.workflow_type] =
      (result.byWorkflowType[state.workflow_type] ?? 0) + 1;
  }

  if (result.durations.workflowCount > 0) {
    result.durations.averageDurationMs =
      result.durations.totalDurationMs / result.durations.workflowCount;
  }
  if (result.tokens.workflowCount > 0) {
    result.tokens.averageTokensPerWorkflow =
      result.tokens.totalTokens / result.tokens.workflowCount;
  }
  if (result.retries.totalGateChecks > 0) {
    result.retries.failureRate = result.retries.totalGateFailures / result.retries.totalGateChecks;
  }
  return result;
}
