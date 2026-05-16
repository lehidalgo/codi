/**
 * eval_runs writer + reader (ISSUE-050).
 *
 * Persists every execution of an `evals.json` case so trend analysis,
 * regression detection, and the rule-refinement loop have historical
 * data to draw on. The schema (v13) lives in
 * `src/runtime/brain/migrate.ts`. The current writer is the brain CLI
 * subcommand `codi brain record-eval-run`; the eval harness
 * (`dev-skill-creator/scripts/ts/run-eval.ts`) shells out to that
 * subcommand so the harness itself does not need to know about
 * brain.db.
 */

import type Database from "better-sqlite3";

export interface EvalRunRecord {
  readonly ts: number;
  readonly projectId: string;
  readonly sessionId?: string | undefined;
  readonly skillName: string;
  readonly skillVersion?: string | undefined;
  readonly caseId: string;
  readonly passed: boolean;
  readonly triggerRate?: number | undefined;
  readonly runs?: number | undefined;
  readonly triggers?: number | undefined;
  readonly model?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly error?: string | undefined;
  /** Where this row came from — e.g. "run-eval" / "ci" / "agent". */
  readonly triggerSource: string;
  /** Forward-compatible JSON payload for harness-specific fields. */
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface EvalRunRow {
  readonly run_id: number;
  readonly ts: number;
  readonly project_id: string;
  readonly session_id: string | null;
  readonly skill_name: string;
  readonly skill_version: string | null;
  readonly case_id: string;
  readonly passed: number;
  readonly trigger_rate: number | null;
  readonly runs: number;
  readonly triggers: number | null;
  readonly model: string | null;
  readonly duration_ms: number | null;
  readonly error: string | null;
  readonly trigger_source: string;
  readonly metadata: string | null;
}

/** Insert one eval-run row. Returns the new `run_id`. */
export function recordEvalRun(raw: Database.Database, record: EvalRunRecord): number {
  const metadataJson =
    record.metadata !== undefined && Object.keys(record.metadata).length > 0
      ? JSON.stringify(record.metadata)
      : null;
  const result = raw
    .prepare(
      `INSERT INTO eval_runs(
         ts, project_id, session_id, skill_name, skill_version, case_id,
         passed, trigger_rate, runs, triggers, model, duration_ms, error,
         trigger_source, metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.ts,
      record.projectId,
      record.sessionId ?? null,
      record.skillName,
      record.skillVersion ?? null,
      record.caseId,
      record.passed ? 1 : 0,
      record.triggerRate ?? null,
      record.runs ?? 1,
      record.triggers ?? null,
      record.model ?? null,
      record.durationMs ?? null,
      record.error ?? null,
      record.triggerSource,
      metadataJson,
    );
  return Number(result.lastInsertRowid);
}

/**
 * Return the most-recent `limit` eval runs for `skillName`, newest first.
 * Used by the rule-refinement loop and the eventual brain-ui panel.
 */
export function getRecentEvalRuns(
  raw: Database.Database,
  skillName: string,
  limit = 50,
): readonly EvalRunRow[] {
  return raw
    .prepare(
      `SELECT * FROM eval_runs
       WHERE skill_name = ?
       ORDER BY ts DESC
       LIMIT ?`,
    )
    .all(skillName, limit) as EvalRunRow[];
}

export interface SkillEvalSummary {
  readonly skillName: string;
  readonly totalRuns: number;
  readonly passRate: number;
  readonly latestTs: number;
}

/**
 * Aggregate pass-rate per skill across the entire eval_runs history of
 * a project. Drives the trend-analysis surface.
 */
export function summarizeEvalRunsByProject(
  raw: Database.Database,
  projectId: string,
): readonly SkillEvalSummary[] {
  const rows = raw
    .prepare(
      `SELECT skill_name        AS skillName,
              COUNT(*)          AS totalRuns,
              AVG(passed) * 1.0 AS passRate,
              MAX(ts)           AS latestTs
       FROM eval_runs
       WHERE project_id = ?
       GROUP BY skill_name
       ORDER BY latestTs DESC`,
    )
    .all(projectId) as Array<{
    skillName: string;
    totalRuns: number;
    passRate: number;
    latestTs: number;
  }>;
  return rows;
}
