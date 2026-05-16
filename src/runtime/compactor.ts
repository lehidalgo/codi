/**
 * Brain-backed workflow compactor (F11).
 *
 * Replaces the legacy filesystem-archive compactor with one that operates
 * directly on the brain's `workflow_runs` + `workflow_events` tables.
 *
 * Compaction is deterministic and idempotent:
 *   1. Pick terminal (`completed` / `abandoned`) workflows whose last event
 *      ts is older than `thresholdDays` (default 180).
 *   2. For each, build a `CompactedSummary`: reducer state + the always-
 *      preserved events (lifecycle / decisions / scope approvals / handovers).
 *   3. Stash the summary as JSON in `workflow_runs.metadata.compacted` and
 *      delete the now-redundant `workflow_events` rows.
 *
 * Re-running the compactor is safe — already-compacted runs (those with
 * `metadata.compacted` set) are skipped.
 */

import type Database from "better-sqlite3";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { reduce } from "./reducer.js";
import type { ManifestEvent } from "./types.js";

const ALWAYS_PRESERVED = new Set<string>([
  "init",
  "decision_recorded",
  "adr_approved",
  "adr_superseded",
  "scope_expansion_approved",
  "child_workflow_initiated",
  "child_workflow_resolved",
  "workflow_handover",
  "workflow_force_handover",
  "workflow_completed",
  "workflow_abandoned",
]);

export const COMPACTOR_VERSION = "2.0.0";

export interface CompactionResult {
  workflowId: string;
  summarized: boolean;
  preservedCount: number;
  reducedFromCount: number;
  reason: string;
}

export interface CompactorOptions {
  thresholdDays?: number;
  /** Override the wall clock — used by tests. */
  now?: Date;
  /** When true, summarize but do not delete the underlying event rows. */
  dryRun?: boolean;
}

/**
 * Compact every terminal workflow whose last event is older than the
 * threshold. The brain handle is read+write; the caller owns its lifecycle.
 */
export function compactWorkflows(
  handle: BrainHandle,
  opts: CompactorOptions = {},
): CompactionResult[] {
  const raw = handle.raw;
  const threshold = opts.thresholdDays ?? 180;
  const now = opts.now ?? new Date();
  const cutoffMs = now.getTime() - threshold * 24 * 60 * 60 * 1000;
  const dryRun = opts.dryRun ?? false;

  // Gather candidate runs: terminal status, last event older than cutoff,
  // not already compacted (metadata.compacted not set).
  const candidates = raw
    .prepare(
      `SELECT wr.workflow_id   AS workflow_id,
              wr.metadata      AS metadata,
              MAX(we.ts)       AS last_ts,
              COUNT(we.event_id) AS event_count
         FROM workflow_runs wr
         LEFT JOIN workflow_events we ON we.workflow_id = wr.workflow_id
        WHERE wr.status IN ('completed', 'abandoned')
        GROUP BY wr.workflow_id
        ORDER BY wr.workflow_id ASC`,
    )
    .all() as {
    workflow_id: string;
    metadata: string | null;
    last_ts: number | null;
    event_count: number;
  }[];

  const results: CompactionResult[] = [];

  for (const c of candidates) {
    const meta = parseMetadata(c.metadata);
    if (meta && typeof meta.compacted === "object" && meta.compacted !== null) {
      results.push({
        workflowId: c.workflow_id,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: c.event_count,
        reason: "Already compacted.",
      });
      continue;
    }
    if (c.event_count === 0) {
      results.push({
        workflowId: c.workflow_id,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: 0,
        reason: "Empty workflow (no events).",
      });
      continue;
    }
    if (c.last_ts === null || c.last_ts > cutoffMs) {
      results.push({
        workflowId: c.workflow_id,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: c.event_count,
        reason: `Last event newer than threshold (${threshold}d).`,
      });
      continue;
    }

    const events = loadEvents(raw, c.workflow_id);
    const summary = buildSummary(events);
    if (!dryRun) {
      const newMeta = mergeMetadata(meta, summary);
      const txn = raw.transaction(() => {
        raw
          .prepare(`UPDATE workflow_runs SET metadata = ? WHERE workflow_id = ?`)
          .run(JSON.stringify(newMeta), c.workflow_id);
        raw.prepare(`DELETE FROM workflow_events WHERE workflow_id = ?`).run(c.workflow_id);
      });
      txn();
    }

    results.push({
      workflowId: c.workflow_id,
      summarized: true,
      preservedCount: summary.preserved_events.length,
      reducedFromCount: events.length,
      reason: `Compacted: ${summary.preserved_events.length}/${events.length} events preserved verbatim.`,
    });
  }

  return results;
}

interface CompactedSummary {
  readonly workflow_id: string;
  readonly workflow_type: string;
  readonly task: string;
  readonly status: string;
  readonly started_at: string;
  readonly last_event_timestamp: string;
  readonly total_events: number;
  readonly preserved_events: ManifestEvent[];
  readonly reduced_state: ReturnType<typeof reduce>;
  readonly compacted_at: string;
  readonly compactor_version: string;
}

function buildSummary(events: ManifestEvent[]): CompactedSummary {
  const state = reduce(events);
  const preserved = events.filter((e) => ALWAYS_PRESERVED.has(e.event_type));
  return {
    workflow_id: state.workflow_id,
    workflow_type: state.workflow_type,
    task: state.task,
    status: state.status,
    started_at: state.started_at,
    last_event_timestamp: state.last_event_timestamp,
    total_events: events.length,
    preserved_events: preserved,
    reduced_state: state,
    compacted_at: new Date().toISOString(),
    compactor_version: COMPACTOR_VERSION,
  };
}

function loadEvents(raw: Database.Database, workflowId: string): ManifestEvent[] {
  const rows = raw
    .prepare(
      `SELECT payload FROM workflow_events
        WHERE workflow_id = ?
        ORDER BY event_id ASC`,
    )
    .all(workflowId) as { payload: string }[];
  return rows.map((r) => JSON.parse(r.payload) as ManifestEvent);
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function mergeMetadata(
  prev: Record<string, unknown> | null,
  summary: CompactedSummary,
): Record<string, unknown> {
  return { ...(prev ?? {}), compacted: summary };
}

/**
 * Read back a previously compacted summary. Returns null when the workflow
 * has not been compacted (or doesn't exist). Useful for `codi workflow`
 * inspection commands and the brain-ui timeline.
 */
export function readCompactedSummary(
  raw: Database.Database,
  workflowId: string,
): CompactedSummary | null {
  const row = raw
    .prepare(`SELECT metadata FROM workflow_runs WHERE workflow_id = ?`)
    .get(workflowId) as { metadata: string | null } | undefined;
  const meta = parseMetadata(row?.metadata ?? null);
  const compacted = meta?.["compacted"];
  if (!compacted || typeof compacted !== "object") return null;
  return compacted as CompactedSummary;
}
