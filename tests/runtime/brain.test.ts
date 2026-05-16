/**
 * Brain DB schema bootstrap + sanity inserts (Sprint 2 proper).
 *
 * Each test creates an isolated tmp SQLite to keep them parallel-safe.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openBrain } from "#src/runtime/brain/db.js";
import { applyMigrations, CURRENT_SCHEMA_VERSION } from "#src/runtime/brain/migrate.js";
function tmpDb(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "codi-brain-"));
  return {
    path: join(dir, "brain.db"),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

describe("brain / schema bootstrap", () => {
  it("creates the 11 canonical tables on first run", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        applyMigrations(handle.raw);
        const tables = handle.raw
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all() as { name: string }[];
        const names = tables.map((r) => r.name);
        expect(names).toContain("projects");
        expect(names).toContain("sessions");
        expect(names).toContain("prompts");
        expect(names).toContain("turns");
        expect(names).toContain("captures");
        expect(names).toContain("tool_calls");
        expect(names).toContain("corrections");
        expect(names).toContain("artifacts_used");
        expect(names).toContain("_codi_schema_version");
        expect(names).toContain("workflow_runs");
        expect(names).toContain("workflow_events");
        expect(names).toContain("workflow_definitions");
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });

  it("schema_version reflects CURRENT_SCHEMA_VERSION after fresh bootstrap", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        const r = applyMigrations(handle.raw);
        expect(r.applied).toContain(CURRENT_SCHEMA_VERSION);
        const v = handle.raw
          .prepare("SELECT MAX(version) as v FROM _codi_schema_version")
          .get() as { v: number };
        expect(v.v).toBe(CURRENT_SCHEMA_VERSION);
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });

  it("creates FTS5 mirrors and triggers", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        applyMigrations(handle.raw);
        const ftsRows = handle.raw
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts' ORDER BY name",
          )
          .all() as { name: string }[];
        expect(ftsRows.map((r) => r.name)).toEqual(["captures_fts", "prompts_fts"]);

        const triggers = handle.raw
          .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
          .all() as { name: string }[];
        expect(triggers.length).toBe(6);
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });

  it("is idempotent — second apply does nothing new", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        const first = applyMigrations(handle.raw);
        const second = applyMigrations(handle.raw);
        expect(first.applied).toEqual([CURRENT_SCHEMA_VERSION]);
        expect(second.applied).toEqual([]);
        const versions = handle.raw
          .prepare("SELECT version FROM _codi_schema_version ORDER BY version")
          .all() as { version: number }[];
        expect(versions.map((r) => r.version)).toEqual([CURRENT_SCHEMA_VERSION]);
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });

  it("FTS5 mirror picks up captures via trigger", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        applyMigrations(handle.raw);
        handle.raw
          .prepare(
            "INSERT INTO captures(session_id, prompt_id, turn_id, ts, type, content, raw_marker) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run("s1", 1, 1, Date.now(), "RULE", "always test the database layer", '|RULE: "x"|');

        const hits = handle.raw
          .prepare("SELECT rowid FROM captures_fts WHERE captures_fts MATCH 'database'")
          .all() as { rowid: number }[];
        expect(hits.length).toBe(1);
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });

  // DEFECT-007 regression: better-sqlite3 has SQLITE_DBCONFIG_DEFENSIVE on
  // by default, which previously blocked the prompts_fts contentless-table
  // sync triggers ("unsafe use of virtual table prompts_fts"). openBrain
  // now flips unsafeMode for read-write handles so DELETE/UPDATE on
  // prompts succeeds and the FTS mirror stays consistent.
  it("DELETE on prompts fires the FTS sync trigger without 'unsafe use of virtual table'", () => {
    const t = tmpDb();
    try {
      const handle = openBrain({ dbPath: t.path });
      try {
        applyMigrations(handle.raw);
        handle.raw
          .prepare(
            "INSERT INTO prompts(session_id, turn_no, ts, text, char_count) VALUES (?, ?, ?, ?, ?)",
          )
          .run("s-fts", 1, Date.now(), "find me later", 13);

        const beforeFts = handle.raw
          .prepare("SELECT rowid FROM prompts_fts WHERE prompts_fts MATCH 'later'")
          .all() as { rowid: number }[];
        expect(beforeFts.length).toBe(1);

        // The DELETE used to throw `SqliteError: unsafe use of virtual
        // table "prompts_fts"`. With unsafeMode it must succeed and the
        // FTS row must be removed by the trigger.
        expect(() =>
          handle.raw.prepare("DELETE FROM prompts WHERE session_id = ?").run("s-fts"),
        ).not.toThrow();

        const afterPrompts = handle.raw.prepare("SELECT COUNT(*) AS c FROM prompts").get() as {
          c: number;
        };
        expect(afterPrompts.c).toBe(0);

        const afterFts = handle.raw
          .prepare("SELECT rowid FROM prompts_fts WHERE prompts_fts MATCH 'later'")
          .all() as { rowid: number }[];
        expect(afterFts.length).toBe(0);
      } finally {
        handle.close();
      }
    } finally {
      t.cleanup();
    }
  });
});
