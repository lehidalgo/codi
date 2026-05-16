/**
 * CORE-005 — brain DB schema alignment guard.
 *
 * Asserts that `src/runtime/brain/schema.ts` (Drizzle ORM source of truth
 * for query types) and `src/runtime/brain/migrate.ts` (raw SQL bootstrap
 * + 15 versioned ALTERs, source of truth for deployment) produce
 * structurally identical SQLite schemas for every table modelled in
 * both sides.
 *
 * Coverage:
 *   PRAGMA table_info(<table>)   — columns, types, nullability, defaults, PK
 *   PRAGMA index_list(<table>)   — named indexes, uniqueness
 *   PRAGMA index_info(<index>)   — index column ordering
 *
 * Out of scope (deliberate):
 *   - FTS5 virtual tables (Drizzle does not model them — only raw SQL
 *     creates `captures_fts` and `prompts_fts`).
 *   - FTS5 triggers (raw-SQL-only by design).
 *   - CHECK constraints (zero declared today; PRAGMA cannot inspect
 *     them — defer text-diff helper to when the first CHECK lands).
 *   - FOREIGN KEY constraints (codi runs SQLite with foreign_keys=OFF
 *     by default and declares zero `.references()` in schema.ts).
 *
 * When this test fails, the message lists the offending table and the
 * column-set delta. Local fix: edit either `schema.ts` (Drizzle) or
 * `migrate.ts` (BOOTSTRAP_STATEMENTS / VERSIONED_MIGRATIONS) until both
 * produce the same PRAGMA snapshot.
 */
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { applyMigrations, _resetMigrationCacheForTests } from "#src/runtime/brain/migrate.js";
import * as schema from "#src/runtime/brain/schema.js";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  isSqliteTable,
  synthesizeCreateTable,
  indexStmtsFor,
  normalizeColumns,
  normalizeIndexes,
  normalizeIndexInfo,
  type PragmaColumn,
  type PragmaIndex,
  type PragmaIndexColumn,
} from "./_schema-alignment-helpers.js";

/**
 * Tables that exist only on the raw-SQL side (Drizzle has no model).
 * Includes FTS5 virtual tables and their internal SQLite-managed shadow
 * tables (`*_config`, `*_data`, `*_docsize`, `*_idx`, `*_content`).
 */
const RAW_ONLY_TABLES = new Set(["captures_fts", "prompts_fts"]);
const RAW_ONLY_PREFIXES = ["captures_fts_", "prompts_fts_"];

function isRawOnlyTable(name: string): boolean {
  if (RAW_ONLY_TABLES.has(name)) return true;
  return RAW_ONLY_PREFIXES.some((p) => name.startsWith(p));
}

function openBootstrapDb(): Database.Database {
  _resetMigrationCacheForTests();
  const db = new Database(":memory:");
  applyMigrations(db);
  return db;
}

function openDrizzleDb(): Database.Database {
  const db = new Database(":memory:");
  const tables = Object.values(schema).filter(isSqliteTable);
  for (const t of tables) {
    db.exec(synthesizeCreateTable(t));
    for (const idxStmt of indexStmtsFor(t)) {
      db.exec(idxStmt);
    }
  }
  return db;
}

describe("brain / schema alignment (CORE-005)", () => {
  it("every Drizzle-modelled table also exists in the raw-SQL bootstrap", () => {
    const bootDb = openBootstrapDb();
    const drizzleTables = Object.values(schema)
      .filter(isSqliteTable)
      .map((t) => getTableConfig(t).name)
      .sort();
    const bootTableRows = bootDb
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all() as { name: string }[];
    const bootTables = bootTableRows.map((r) => r.name).sort();
    const bootRealTables = bootTables.filter((n) => !isRawOnlyTable(n));

    for (const t of drizzleTables) {
      expect(
        bootRealTables,
        `Drizzle table "${t}" is missing from BOOTSTRAP_STATEMENTS/VERSIONED_MIGRATIONS in migrate.ts`,
      ).toContain(t);
    }
    for (const t of bootRealTables) {
      expect(
        drizzleTables,
        `BOOTSTRAP table "${t}" has no Drizzle export in schema.ts (add a sqliteTable() definition or add to RAW_ONLY_TABLES)`,
      ).toContain(t);
    }
  });

  it("PRAGMA table_info matches between BOOTSTRAP and Drizzle per table", () => {
    const bootDb = openBootstrapDb();
    const drizzleDb = openDrizzleDb();

    const tables = Object.values(schema).filter(isSqliteTable);
    const drifts: string[] = [];

    for (const table of tables) {
      const name = getTableConfig(table).name;
      const bootRows = bootDb
        .prepare(`PRAGMA table_info(${name})`)
        .all() as PragmaColumn[];
      const dzRows = drizzleDb
        .prepare(`PRAGMA table_info(${name})`)
        .all() as PragmaColumn[];

      const bootNorm = normalizeColumns(bootRows);
      const dzNorm = normalizeColumns(dzRows);
      if (JSON.stringify(bootNorm) !== JSON.stringify(dzNorm)) {
        drifts.push(
          `Table "${name}" column drift:\n` +
            `  BOOTSTRAP: ${JSON.stringify(bootNorm)}\n` +
            `  Drizzle:   ${JSON.stringify(dzNorm)}`,
        );
      }
    }

    expect(drifts, drifts.join("\n\n")).toEqual([]);
  });

  it("PRAGMA index_list matches per table (names + unique flag)", () => {
    const bootDb = openBootstrapDb();
    const drizzleDb = openDrizzleDb();

    const tables = Object.values(schema).filter(isSqliteTable);
    const drifts: string[] = [];

    for (const table of tables) {
      const name = getTableConfig(table).name;
      const bootRows = bootDb
        .prepare(`PRAGMA index_list(${name})`)
        .all() as PragmaIndex[];
      const dzRows = drizzleDb
        .prepare(`PRAGMA index_list(${name})`)
        .all() as PragmaIndex[];

      const bootNorm = normalizeIndexes(bootRows);
      const dzNorm = normalizeIndexes(dzRows);
      if (JSON.stringify(bootNorm) !== JSON.stringify(dzNorm)) {
        drifts.push(
          `Table "${name}" index_list drift:\n` +
            `  BOOTSTRAP: ${JSON.stringify(bootNorm)}\n` +
            `  Drizzle:   ${JSON.stringify(dzNorm)}`,
        );
      }
    }

    expect(drifts, drifts.join("\n\n")).toEqual([]);
  });

  it("PRAGMA index_info matches per non-autogenerated index (column order)", () => {
    const bootDb = openBootstrapDb();
    const drizzleDb = openDrizzleDb();

    const tables = Object.values(schema).filter(isSqliteTable);
    const drifts: string[] = [];

    for (const table of tables) {
      const name = getTableConfig(table).name;
      const bootIdxs = (bootDb
        .prepare(`PRAGMA index_list(${name})`)
        .all() as PragmaIndex[]).filter((r) => !r.name.startsWith("sqlite_autoindex_"));

      for (const idx of bootIdxs) {
        const bootCols = normalizeIndexInfo(
          bootDb.prepare(`PRAGMA index_info(${idx.name})`).all() as PragmaIndexColumn[],
        );
        const dzCols = normalizeIndexInfo(
          drizzleDb.prepare(`PRAGMA index_info(${idx.name})`).all() as PragmaIndexColumn[],
        );
        if (JSON.stringify(bootCols) !== JSON.stringify(dzCols)) {
          drifts.push(
            `Index "${idx.name}" on "${name}" column-order drift:\n` +
              `  BOOTSTRAP: ${JSON.stringify(bootCols)}\n` +
              `  Drizzle:   ${JSON.stringify(dzCols)}`,
          );
        }
      }
    }

    expect(drifts, drifts.join("\n\n")).toEqual([]);
  });

  it("FTS5 virtual tables exist on the raw-SQL side (existence-only check)", () => {
    const bootDb = openBootstrapDb();
    const virtualTables = (bootDb
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%VIRTUAL%'`,
      )
      .all() as { name: string }[])
      .map((r) => r.name)
      .sort();
    // Drizzle deliberately does not model FTS5 — verified by their absence
    // from `Object.values(schema).filter(isSqliteTable)` (the loop above
    // would surface them otherwise via the "every Drizzle-modelled table"
    // test). This assertion just confirms the raw side still produces them.
    expect(virtualTables).toEqual(["captures_fts", "prompts_fts"]);
  });
});
