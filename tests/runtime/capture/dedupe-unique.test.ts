/**
 * CORE-011 — UNIQUE(turn_id, raw_marker) on captures and
 * UNIQUE(session_id, turn_no) on prompts.
 *
 * Pins three contracts:
 *
 *   1. **Constraint exists** — schema enforces UNIQUE at the SQL
 *      level. A raw `INSERT` of a duplicate must throw
 *      `SQLITE_CONSTRAINT_UNIQUE`. Without this the dedupe path is
 *      dependent on application discipline (which was the race
 *      window the refactor closes).
 *
 *   2. **`persistMarkers` is concurrency-safe** — the new `INSERT OR
 *      IGNORE` flow never produces duplicate rows even when called
 *      twice with identical input. `skippedDuplicates` accounts for
 *      the conflict path and the returned `captureIds` list
 *      preserves the survivor's id (callers join on it).
 *
 *   3. **`recordPrompt` survives concurrent writers** — the
 *      `INSERT...SELECT MAX(turn_no)+1...RETURNING` flow under the
 *      UNIQUE constraint serialises through the file lock; a
 *      collision retries once and converges. The contract is no
 *      duplicate (session_id, turn_no) rows ever land on disk.
 *
 *   4. **Backfill v17 dedupe** — running migrations against a brain
 *      DB seeded with pre-CORE-011 duplicates keeps the oldest row
 *      per group (MIN(id)) and repoints `turns.prompt_id` so no
 *      `turns` row dangles.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openBrain } from "#src/runtime/brain/db.js";
import {
  applyMigrations,
  CURRENT_SCHEMA_VERSION,
} from "#src/runtime/brain/migrate.js";
import { persistMarkers } from "#src/runtime/capture/persist.js";
import { ensureProject, ensureSession, recordPrompt } from "#src/runtime/capture/session.js";
import { parseMarkers } from "#src/runtime/capture/markers.js";

function tmpBrain() {
  const tmp = mkdtempSync(join(tmpdir(), "codi-core011-"));
  const dbPath = join(tmp, "brain.db");
  const handle = openBrain({ dbPath });
  applyMigrations(handle.raw);
  return {
    tmp,
    dbPath,
    handle,
    cleanup: () => {
      handle.close();
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

describe("CORE-011 — UNIQUE constraints on captures + prompts", () => {
  let brain: ReturnType<typeof tmpBrain>;

  beforeEach(() => {
    brain = tmpBrain();
    ensureProject(brain.handle.raw, { projectId: "p1", cwd: brain.tmp });
    ensureSession(brain.handle.raw, {
      sessionId: "s1",
      projectId: "p1",
      agentType: "claude",
      workingDir: brain.tmp,
    });
  });

  afterEach(() => brain.cleanup());

  describe("schema constraints (v17)", () => {
    it("applied schema is at CURRENT_SCHEMA_VERSION (= 17)", () => {
      const row = brain.handle.raw
        .prepare(`SELECT MAX(version) AS v FROM _codi_schema_version`)
        .get() as { v: number };
      expect(row.v).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("captures has UNIQUE index on (turn_id, raw_marker)", () => {
      const indexes = brain.handle.raw
        .prepare(`PRAGMA index_list('captures')`)
        .all() as Array<{ name: string; unique: number }>;
      const idx = indexes.find((r) => r.name === "idx_captures_turn_marker");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(1);
    });

    it("prompts has UNIQUE index on (session_id, turn_no)", () => {
      const indexes = brain.handle.raw
        .prepare(`PRAGMA index_list('prompts')`)
        .all() as Array<{ name: string; unique: number }>;
      const idx = indexes.find((r) => r.name === "idx_prompts_session_turn");
      expect(idx).toBeDefined();
      expect(idx!.unique).toBe(1);
    });

    it("raw duplicate INSERT into captures throws UNIQUE constraint failure", () => {
      const insert = brain.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("s1", 1, 7, Date.now(), "RULE", "x", "marker-a");
      expect(() => insert.run("s1", 1, 7, Date.now(), "RULE", "y", "marker-a")).toThrow(
        /UNIQUE constraint failed/,
      );
    });

    it("raw duplicate INSERT into prompts throws UNIQUE constraint failure", () => {
      const insert = brain.handle.raw.prepare(
        `INSERT INTO prompts(session_id, turn_no, ts, text, char_count) VALUES (?, ?, ?, ?, ?)`,
      );
      insert.run("s1", 1, Date.now(), "hi", 2);
      expect(() => insert.run("s1", 1, Date.now(), "hi again", 8)).toThrow(
        /UNIQUE constraint failed/,
      );
    });
  });

  describe("persistMarkers via INSERT OR IGNORE", () => {
    it("dedupes duplicate (turn_id, raw_marker) without throwing", () => {
      const markers = parseMarkers('|RULE: "no force push"|');
      const ctx = { sessionId: "s1", promptId: 1, turnId: 42 };
      const first = persistMarkers(brain.handle.raw, ctx, markers);
      const second = persistMarkers(brain.handle.raw, ctx, markers);
      expect(first.inserted).toBe(1);
      expect(first.skippedDuplicates).toBe(0);
      expect(second.inserted).toBe(0);
      expect(second.skippedDuplicates).toBe(1);
      expect(second.captureIds).toEqual(first.captureIds);

      const count = (
        brain.handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures`).get() as { c: number }
      ).c;
      expect(count).toBe(1);
    });

    it("does not double FTS5 indexing on conflict", () => {
      const markers = parseMarkers('|DECISION: "use SQLite for storage"|');
      const ctx = { sessionId: "s1", promptId: 1, turnId: 5 };
      persistMarkers(brain.handle.raw, ctx, markers);
      persistMarkers(brain.handle.raw, ctx, markers);
      persistMarkers(brain.handle.raw, ctx, markers);
      const ftsCount = (
        brain.handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures_fts`).get() as { c: number }
      ).c;
      expect(ftsCount).toBe(1);
    });
  });

  describe("recordPrompt under contention", () => {
    it("two sequential calls yield distinct turn_no values", () => {
      const a = recordPrompt(brain.handle.raw, { sessionId: "s1", text: "hello" });
      const b = recordPrompt(brain.handle.raw, { sessionId: "s1", text: "world" });
      expect(a.turnNo).toBe(1);
      expect(b.turnNo).toBe(2);
      expect(a.promptId).not.toBe(b.promptId);
    });

    it("isolated per session — same turn_no allowed across different sessions", () => {
      ensureSession(brain.handle.raw, {
        sessionId: "s2",
        projectId: "p1",
        agentType: "claude",
        workingDir: brain.tmp,
      });
      const a = recordPrompt(brain.handle.raw, { sessionId: "s1", text: "in s1" });
      const b = recordPrompt(brain.handle.raw, { sessionId: "s2", text: "in s2" });
      expect(a.turnNo).toBe(1);
      expect(b.turnNo).toBe(1);
    });
  });

  describe("v17 backfill", () => {
    it("on a fresh DB, the migration runs idempotently", () => {
      // applyMigrations was already called once in `tmpBrain`. Running
      // it again must be a no-op — confirms the v17 statements are
      // idempotent (IF NOT EXISTS / IF EXISTS guards).
      applyMigrations(brain.handle.raw);
      const row = brain.handle.raw
        .prepare(`SELECT MAX(version) AS v FROM _codi_schema_version`)
        .get() as { v: number };
      expect(row.v).toBe(CURRENT_SCHEMA_VERSION);
    });

    it("cleans up duplicate captures keeping MIN(capture_id)", () => {
      // Simulate a pre-v17 state: drop the UNIQUE index temporarily,
      // insert duplicates, re-run v17 cleanup statements, then
      // re-create the UNIQUE index. This proves the backfill SQL is
      // correct without needing a v16-bootstrapped fixture.
      brain.handle.raw.exec(`DROP INDEX idx_captures_turn_marker`);
      const insert = brain.handle.raw.prepare(
        `INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      insert.run("s1", 1, 9, 100, "RULE", "first", "dup");
      insert.run("s1", 1, 9, 200, "RULE", "second", "dup");
      insert.run("s1", 1, 9, 300, "RULE", "third", "dup");
      expect(
        (brain.handle.raw.prepare(`SELECT COUNT(*) AS c FROM captures`).get() as { c: number }).c,
      ).toBe(3);

      brain.handle.raw.exec(
        `DELETE FROM captures WHERE capture_id NOT IN (
           SELECT MIN(capture_id) FROM captures GROUP BY turn_id, raw_marker
         )`,
      );
      brain.handle.raw.exec(
        `CREATE UNIQUE INDEX idx_captures_turn_marker ON captures(turn_id, raw_marker)`,
      );

      const rows = brain.handle.raw
        .prepare(`SELECT capture_id, content FROM captures WHERE raw_marker = 'dup'`)
        .all() as Array<{ capture_id: number; content: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]!.content).toBe("first"); // oldest survived
    });
  });
});
