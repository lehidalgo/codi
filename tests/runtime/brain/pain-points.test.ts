/**
 * ISSUE-051 — pain-points aggregator.
 *
 * Drives `getPainPoints` against a tmp brain.db seeded with each of the
 * four signals (corrections / gate_check_failed / CORRECTION captures /
 * FEEDBACK captures). Verifies merging, ranking, window filtering, and
 * the `parseSinceFlag` helper.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations } from "#src/runtime/brain/migrate.js";
import { getPainPoints, parseSinceFlag } from "#src/runtime/brain/pain-points.js";

function insertCorrection(
  raw: ReturnType<typeof openBrain>["raw"],
  sessionId: string,
  ts: number,
  linkedArtifacts: string | null,
): void {
  raw
    .prepare(
      `INSERT INTO corrections(session_id, ts, file_path, diff_summary,
                                source_turn_id, detected_via, linked_artifacts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(sessionId, ts, "x.ts", "diff", 1, "iron-law-9-marker", linkedArtifacts);
}

function insertGateFailed(
  raw: ReturnType<typeof openBrain>["raw"],
  workflowId: string,
  ts: number,
  gate: string,
): void {
  raw
    .prepare(
      `INSERT INTO workflow_events(workflow_id, event_type, ts, payload)
       VALUES (?, ?, ?, ?)`,
    )
    .run(workflowId, "gate_check_failed", ts, JSON.stringify({ gate }));
}

function insertCapture(
  raw: ReturnType<typeof openBrain>["raw"],
  sessionId: string,
  promptId: number,
  turnId: number,
  ts: number,
  type: string,
  content: string,
): void {
  raw
    .prepare(
      `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(sessionId, promptId, turnId, ts, type, content, `|${type}: "${content}"|`);
}

describe("ISSUE-051 — getPainPoints", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codi-pain-"));
    dbPath = join(tmpDir, "brain.db");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array on a fresh brain", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      const points = getPainPoints(handle.raw);
      expect(points).toEqual([]);
    } finally {
      handle.close();
    }
  });

  it("merges + ranks signals by hit count, newest-first on ties", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      // 3 corrections to "codi-commit"
      insertCorrection(handle.raw, "s1", 100, '["codi-commit"]');
      insertCorrection(handle.raw, "s1", 200, '["codi-commit"]');
      insertCorrection(handle.raw, "s2", 300, '["codi-commit"]');
      // 2 gate failures for "task_described"
      insertGateFailed(handle.raw, "wf-1", 400, "task_described");
      insertGateFailed(handle.raw, "wf-1", 500, "task_described");
      // 1 FEEDBACK capture
      insertCapture(handle.raw, "s1", 1, 1, 600, "FEEDBACK", "this is broken");

      const points = getPainPoints(handle.raw);
      expect(points.length).toBe(3);
      // Top: 3 corrections > 2 gate_failed > 1 feedback
      expect(points[0]!.hits).toBe(3);
      expect(points[0]!.signal).toBe("correction");
      expect(points[1]!.hits).toBe(2);
      expect(points[1]!.signal).toBe("gate_failed");
      expect(points[2]!.hits).toBe(1);
      expect(points[2]!.signal).toBe("capture_feedback");
    } finally {
      handle.close();
    }
  });

  it("respects the since window — rows older than the cutoff are excluded", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      insertCorrection(handle.raw, "s1", 100, '["old"]');
      insertCorrection(handle.raw, "s1", 1_000_000, '["recent"]');
      const points = getPainPoints(handle.raw, { since: 500 });
      expect(points.length).toBe(1);
      expect(points[0]!.bucket).toBe('["recent"]');
    } finally {
      handle.close();
    }
  });

  it("respects the limit", () => {
    const handle = openBrain({ dbPath });
    applyMigrations(handle.raw);
    try {
      for (let i = 0; i < 10; i++) {
        insertCapture(handle.raw, "s1", 1, 1, i * 1000, "FEEDBACK", `case ${i}`);
      }
      const points = getPainPoints(handle.raw, { limit: 3 });
      expect(points.length).toBe(3);
    } finally {
      handle.close();
    }
  });
});

describe("ISSUE-051 — parseSinceFlag", () => {
  it("parses Nd / Nh / Nm relative windows", () => {
    const now = Date.now();
    const d = parseSinceFlag("1d");
    expect(d).toBeGreaterThan(now - 86_400_000 - 1000);
    expect(d).toBeLessThan(now - 86_400_000 + 1000);
    const h = parseSinceFlag("24h");
    expect(h).toBeGreaterThan(now - 86_400_000 - 1000);
    const m = parseSinceFlag("60m");
    expect(m).toBeGreaterThan(now - 3_600_000 - 1000);
  });

  it("parses absolute epoch ms", () => {
    expect(parseSinceFlag("1700000000000")).toBe(1700000000000);
  });

  it("returns undefined for missing or malformed values", () => {
    expect(parseSinceFlag(undefined)).toBeUndefined();
    expect(parseSinceFlag("not-a-window")).toBeUndefined();
  });
});
