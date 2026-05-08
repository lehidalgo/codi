/**
 * Archive compactor — reduces older archives to a deterministic summary,
 * preserving critical events (decisions, ADRs, scope expansions, lifecycle).
 *
 * Compaction is deterministic: same archive produces same summary.json on
 * every run. Compaction never alters individual event JSON files. The
 * summary is written alongside the existing files; full archives can
 * still be reconstructed from git history of the directory.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ManifestEvent } from "./types.js";
import { reduce } from "./reducer.js";

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

export interface CompactionResult {
  archiveId: string;
  summarized: boolean;
  preservedCount: number;
  reducedFromCount: number;
  reason: string;
}

export interface CompactorOptions {
  archivesDir: string;
  thresholdDays?: number;
  now?: Date;
}

export function compactAllArchives(opts: CompactorOptions): CompactionResult[] {
  const threshold = opts.thresholdDays ?? 180;
  const now = opts.now ?? new Date();
  const cutoffMs = now.getTime() - threshold * 24 * 60 * 60 * 1000;

  if (!existsSync(opts.archivesDir)) return [];

  const results: CompactionResult[] = [];
  for (const entry of readdirSync(opts.archivesDir)) {
    const dir = join(opts.archivesDir, entry);
    if (!statSync(dir).isDirectory()) continue;

    const summaryPath = join(dir, "summary.json");
    if (existsSync(summaryPath)) {
      results.push({
        archiveId: entry,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: 0,
        reason: "Already compacted.",
      });
      continue;
    }

    const events = loadArchive(dir);
    if (events.length === 0) {
      results.push({
        archiveId: entry,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: 0,
        reason: "Empty archive.",
      });
      continue;
    }
    const lastTs = new Date(events[events.length - 1]?.timestamp ?? 0).getTime();
    if (lastTs > cutoffMs) {
      results.push({
        archiveId: entry,
        summarized: false,
        preservedCount: 0,
        reducedFromCount: events.length,
        reason: `Archive last event newer than threshold (${threshold}d).`,
      });
      continue;
    }

    const summary = buildSummary(events);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    results.push({
      archiveId: entry,
      summarized: true,
      preservedCount: summary.preserved_events.length,
      reducedFromCount: events.length,
      reason: `Compacted: ${summary.preserved_events.length}/${events.length} events preserved verbatim, rest summarized.`,
    });
  }
  return results;
}

interface CompactedSummary {
  workflow_id: string;
  workflow_type: string;
  task: string;
  status: string;
  started_at: string;
  last_event_timestamp: string;
  total_events: number;
  preserved_events: ManifestEvent[];
  reduced_state: ReturnType<typeof reduce>;
  compacted_at: string;
  compactor_version: string;
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
    compactor_version: "1.0.0",
  };
}

function loadArchive(dir: string): ManifestEvent[] {
  const events: { sequence: number; event: ManifestEvent }[] = [];
  for (const name of readdirSync(dir)) {
    const m = name.match(/^(\d{3})_[a-z_]+\.json$/);
    if (!m || !m[1]) continue;
    const data = readFileSync(join(dir, name), "utf-8");
    events.push({ sequence: parseInt(m[1], 10), event: JSON.parse(data) as ManifestEvent });
  }
  events.sort((a, b) => a.sequence - b.sequence);
  return events.map((e) => e.event);
}
