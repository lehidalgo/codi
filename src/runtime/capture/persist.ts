/**
 * Persist parsed capture markers into the brain DB.
 *
 * Idempotency: identical markers from the same (session_id, turn_id) are
 * deduplicated by (raw_marker) — re-running the parser on the same agent
 * output never doubles up.
 */

import type Database from "better-sqlite3";
import type { ParsedMarker } from "./markers.js";
import { extractFilePaths } from "./extract.js";

export interface CaptureInsertContext {
  readonly sessionId: string;
  readonly promptId: number;
  readonly turnId: number;
  readonly workflowId?: string;
  readonly phase?: string;
  /**
   * Optional explicit file paths to attach to every marker in this batch.
   * When set, this overrides the auto-extracted paths from each marker's
   * content. Pass `undefined` (the default) to let `persistMarkers` mine
   * paths out of each marker individually.
   */
  readonly filePaths?: readonly string[];
}

export interface CaptureInsertResult {
  readonly inserted: number;
  readonly skippedDuplicates: number;
  readonly captureIds: readonly number[];
}

/**
 * Insert markers, skipping any whose (turn_id, raw_marker) pair already exists.
 * Caller wraps in a transaction if multiple turns share the same call.
 */
export function persistMarkers(
  raw: Database.Database,
  ctx: CaptureInsertContext,
  markers: readonly ParsedMarker[],
): CaptureInsertResult {
  const ids: number[] = [];
  let skipped = 0;

  const exists = raw.prepare(
    "SELECT capture_id FROM captures WHERE turn_id = ? AND raw_marker = ?",
  );
  const insert = raw.prepare(
    `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker, file_paths, workflow_id, phase)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const now = Date.now();
  const ctxPathsJson =
    ctx.filePaths && ctx.filePaths.length > 0 ? JSON.stringify(ctx.filePaths) : null;

  for (const m of markers) {
    const dup = exists.get(ctx.turnId, m.rawMarker) as { capture_id?: number } | undefined;
    if (dup?.capture_id !== undefined) {
      skipped++;
      ids.push(dup.capture_id);
      continue;
    }
    // Per-marker auto-extraction: each marker gets the paths it actually
    // names. The caller can override with ctx.filePaths when they have
    // explicit ground truth (e.g. tool-driven capture).
    let filePathsJson = ctxPathsJson;
    if (filePathsJson === null) {
      const extracted = extractFilePaths(m.content);
      filePathsJson = extracted.length > 0 ? JSON.stringify(extracted) : null;
    }
    const result = insert.run(
      ctx.sessionId,
      ctx.promptId,
      ctx.turnId,
      now,
      m.type,
      m.content,
      m.rawMarker,
      filePathsJson,
      ctx.workflowId ?? null,
      ctx.phase ?? null,
    );
    ids.push(Number(result.lastInsertRowid));

    // ISSUE-049 — write-time correction attribution. Every CORRECTION
    // marker doubles as a row in the `corrections` table, with
    // `linked_artifacts` snapshotting the artifacts active in this exact
    // turn. Doing it here (inside the same transaction the caller
    // already wraps `persistMarkers` in) makes the attribution explicit
    // and causally honest, instead of inferring it later from
    // temporal overlap via a SQL VIEW.
    if (m.type === "CORRECTION") {
      recordCorrectionFromMarker(raw, ctx, m, now, filePathsJson);
    }
  }

  return { inserted: ids.length - skipped, skippedDuplicates: skipped, captureIds: ids };
}

/**
 * Look up every distinct artifact_name recorded against the same
 * (session_id, turn_id) in `artifacts_used`. Returned as a JSON-encoded
 * string array (or `null` when there are none) so it slots straight
 * into the new `corrections.linked_artifacts` column.
 *
 * Why JSON inside a TEXT column rather than a join table:
 *   - corrections are append-only; a denormalised list cannot drift.
 *   - the attribution snapshot is meaningful only at the moment of the
 *     correction; later artifact-use entries should not retro-link.
 */
function snapshotLinkedArtifacts(
  raw: Database.Database,
  sessionId: string,
  turnId: number,
): string | null {
  const rows = raw
    .prepare(
      `SELECT DISTINCT artifact_name
       FROM artifacts_used
       WHERE session_id = ? AND turn_id = ?
       ORDER BY artifact_name`,
    )
    .all(sessionId, turnId) as Array<{ artifact_name: string }>;
  if (rows.length === 0) return null;
  return JSON.stringify(rows.map((r) => r.artifact_name));
}

/**
 * Persist a `corrections` row derived from a CORRECTION capture. The
 * file_path is the first path the marker referenced (or empty when none
 * were named); diff_summary is the verbatim marker content; detected_via
 * stays the literal "iron-law-9-marker" so consumers can distinguish
 * marker-derived corrections from future detection sources (e.g. an
 * edit-revert detector).
 */
function recordCorrectionFromMarker(
  raw: Database.Database,
  ctx: CaptureInsertContext,
  marker: ParsedMarker,
  now: number,
  filePathsJson: string | null,
): void {
  let firstPath = "";
  if (filePathsJson !== null) {
    try {
      const parsed = JSON.parse(filePathsJson) as string[];
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        firstPath = parsed[0];
      }
    } catch {
      // Defensive: filePathsJson is produced by JSON.stringify just above,
      // so a parse failure here is impossible — fall through with empty.
    }
  }
  const linkedArtifacts = snapshotLinkedArtifacts(raw, ctx.sessionId, ctx.turnId);
  raw
    .prepare(
      `INSERT INTO corrections(session_id, ts, file_path, diff_summary,
                               source_turn_id, detected_via, linked_artifacts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ctx.sessionId,
      now,
      firstPath,
      marker.content,
      ctx.turnId,
      "iron-law-9-marker",
      linkedArtifacts,
    );
}
