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
  }

  return { inserted: ids.length - skipped, skippedDuplicates: skipped, captureIds: ids };
}
