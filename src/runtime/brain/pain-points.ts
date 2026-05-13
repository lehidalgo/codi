/**
 * Pain-points aggregator (ISSUE-051).
 *
 * Surfaces recurring failure / friction signals from the brain DB so the
 * dev can see what is going wrong most often without writing ad-hoc SQL.
 * Four signals are unioned, ranked by hit count over a rolling window:
 *
 *   1. `correction`   — rows in the `corrections` table (ISSUE-049)
 *   2. `gate_failed`  — `workflow_events` of type `gate_check_failed`
 *   3. `capture_correction` — `captures` of Iron Law 9 type `CORRECTION`
 *   4. `capture_feedback`   — `captures` of Iron Law 9 type `FEEDBACK`
 *
 * Each signal contributes a `bucket` key (artifact name, gate name, or
 * marker content stem) so similar pain points group together.
 */

import type Database from "better-sqlite3";

export interface PainPoint {
  /** The signal category. */
  readonly signal: "correction" | "gate_failed" | "capture_correction" | "capture_feedback";
  /** Short label that identifies the pain (artifact, gate name, marker stem). */
  readonly bucket: string;
  /** How many times this signal+bucket fired in the window. */
  readonly hits: number;
  /** Newest occurrence (epoch ms) so callers can show "last seen X ago". */
  readonly latestTs: number;
}

export interface PainPointOptions {
  /** Lower bound on `ts` (epoch ms). Omit to scan the entire table. */
  readonly since?: number;
  /** Top-N cap on the returned list. Defaults to 20. */
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;
const BUCKET_MAX_CHARS = 60;

/**
 * Pure read query — opens no transactions, mutates nothing. Safe to call
 * from any consumer (CLI, brain-ui, agent).
 */
export function getPainPoints(
  raw: Database.Database,
  opts: PainPointOptions = {},
): readonly PainPoint[] {
  const since = opts.since ?? 0;
  const limit = opts.limit ?? DEFAULT_LIMIT;

  // SQLite cannot UNION across heterogeneous schemas easily, so run each
  // query separately and merge in JS. Each one already groups by its
  // natural bucket key.
  const corrections = raw
    .prepare(
      `SELECT COALESCE(linked_artifacts, '') AS bucket,
              COUNT(*) AS hits,
              MAX(ts)  AS latestTs
       FROM corrections
       WHERE ts >= ?
       GROUP BY linked_artifacts
       ORDER BY hits DESC`,
    )
    .all(since) as Array<{ bucket: string; hits: number; latestTs: number }>;

  const gateFailed = raw
    .prepare(
      `SELECT COALESCE(json_extract(payload, '$.gate'),
                       json_extract(payload, '$.check_id'),
                       'unknown_gate') AS bucket,
              COUNT(*) AS hits,
              MAX(ts)  AS latestTs
       FROM workflow_events
       WHERE event_type = 'gate_check_failed' AND ts >= ?
       GROUP BY bucket
       ORDER BY hits DESC`,
    )
    .all(since) as Array<{ bucket: string; hits: number; latestTs: number }>;

  const captureCorrection = raw
    .prepare(
      `SELECT substr(content, 1, ?) AS bucket,
              COUNT(*) AS hits,
              MAX(ts)  AS latestTs
       FROM captures
       WHERE type = 'CORRECTION' AND deleted_at IS NULL AND ts >= ?
       GROUP BY bucket
       ORDER BY hits DESC`,
    )
    .all(BUCKET_MAX_CHARS, since) as Array<{ bucket: string; hits: number; latestTs: number }>;

  const captureFeedback = raw
    .prepare(
      `SELECT substr(content, 1, ?) AS bucket,
              COUNT(*) AS hits,
              MAX(ts)  AS latestTs
       FROM captures
       WHERE type = 'FEEDBACK' AND deleted_at IS NULL AND ts >= ?
       GROUP BY bucket
       ORDER BY hits DESC`,
    )
    .all(BUCKET_MAX_CHARS, since) as Array<{ bucket: string; hits: number; latestTs: number }>;

  const merged: PainPoint[] = [
    ...corrections.map((r) => ({ signal: "correction" as const, ...r })),
    ...gateFailed.map((r) => ({ signal: "gate_failed" as const, ...r })),
    ...captureCorrection.map((r) => ({ signal: "capture_correction" as const, ...r })),
    ...captureFeedback.map((r) => ({ signal: "capture_feedback" as const, ...r })),
  ];

  merged.sort((a, b) => b.hits - a.hits || b.latestTs - a.latestTs);
  return merged.slice(0, limit);
}

/** Parse a "since" CLI flag like "7d", "24h", "30m", or epoch ms. */
export function parseSinceFlag(flag: string | undefined): number | undefined {
  if (flag === undefined) return undefined;
  const match = flag.match(/^(\d+)([dhm])$/);
  if (!match) {
    const ms = Number(flag);
    return Number.isFinite(ms) ? ms : undefined;
  }
  const n = Number(match[1]);
  const unit = match[2];
  const ms = unit === "d" ? n * 86_400_000 : unit === "h" ? n * 3_600_000 : n * 60_000;
  return Date.now() - ms;
}
