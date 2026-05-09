/**
 * Stats handler — aggregates workflow runs for `codi workflow stats`.
 *
 * Brain-backed: reads workflow_runs + workflow_events directly. The legacy
 * file-walk implementation was removed in F5 of v3 zero closure.
 */

import { BrainEventLog } from "../brain-event-log.js";
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

export function computeWorkflowStats(_opts: { cwd?: string } = {}): {
  durations: DurationStats;
  tokens: TokenStats;
  retries: RetryStats;
  byWorkflowType: Record<string, number>;
} {
  const result = {
    durations: { totalDurationMs: 0, averageDurationMs: 0, workflowCount: 0 },
    tokens: { totalTokens: 0, averageTokensPerWorkflow: 0, workflowCount: 0 },
    retries: { totalGateChecks: 0, totalGateFailures: 0, failureRate: 0 },
    byWorkflowType: {} as Record<string, number>,
  };

  const log = BrainEventLog.open();
  try {
    const rows = log.privateRaw
      .prepare(
        `SELECT workflow_id FROM workflow_runs WHERE type != 'session' ORDER BY started_at DESC`,
      )
      .all() as { workflow_id: string }[];

    for (const r of rows) {
      const events = log.loadEvents(r.workflow_id);
      if (events.length === 0) continue;
      const state = reduce(events);

      result.durations.workflowCount += 1;
      result.durations.totalDurationMs +=
        new Date(state.last_event_timestamp).getTime() - new Date(state.started_at).getTime();

      result.tokens.workflowCount += 1;
      result.tokens.totalTokens += state.subagent_stats.total_tokens_consumed;

      for (const e of events) {
        if ((e as ManifestEvent).event_type === "gate_check_started")
          result.retries.totalGateChecks += 1;
        if ((e as ManifestEvent).event_type === "gate_check_failed")
          result.retries.totalGateFailures += 1;
      }

      result.byWorkflowType[state.workflow_type] =
        (result.byWorkflowType[state.workflow_type] ?? 0) + 1;
    }
  } finally {
    log.dispose();
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
