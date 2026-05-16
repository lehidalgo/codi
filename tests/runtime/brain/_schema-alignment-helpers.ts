/**
 * CORE-005 — helpers for `schema-alignment.test.ts`.
 *
 * Synthesises CREATE TABLE / CREATE INDEX SQL from a Drizzle `sqliteTable`
 * definition using the public `getTableConfig` introspection API. The
 * generated SQL is then applied to a fresh `:memory:` database, whose
 * PRAGMA output can be compared byte-for-byte against a sibling DB that
 * was populated via the raw `BOOTSTRAP_STATEMENTS` path.
 *
 * Scope is deliberately narrow: PRAGMA `table_info` + `index_list` +
 * `index_info`. CHECK constraints and foreign keys are not declared
 * anywhere in `src/runtime/brain/schema.ts` today, so we skip them.
 * FTS5 virtual tables live only in raw SQL — `isSqliteTable` filters
 * them out of the comparison.
 */
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

/**
 * Type guard for the Drizzle sqliteTable shape. We pass arbitrary
 * `schema.*` exports through here and `getTableConfig` throws on the
 * non-table ones (e.g. `FTS5_AND_VEC_SQL` which is a raw `sql` template).
 */
export function isSqliteTable(x: unknown): x is SQLiteTable {
  if (x === null || typeof x !== "object") return false;
  try {
    getTableConfig(x as SQLiteTable);
    return true;
  } catch {
    return false;
  }
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatDefault(d: unknown): string {
  if (d === undefined || d === null) return "NULL";
  if (typeof d === "number") return String(d);
  if (typeof d === "boolean") return d ? "1" : "0";
  if (typeof d === "string") return `'${d.replace(/'/g, "''")}'`;
  // Drizzle stores SQL-default expressions as objects with a queryChunks array.
  // We only need a faithful textual representation for the SQLite parser; this
  // is sufficient for the constants used in schema.ts (numeric literals).
  return String(d);
}

/**
 * Build a `CREATE TABLE` statement that, when executed against a fresh
 * SQLite database, produces a table whose `PRAGMA table_info` matches
 * the equivalent BOOTSTRAP_STATEMENTS DDL. Used by the alignment guard.
 */
export function synthesizeCreateTable(table: SQLiteTable): string {
  const cfg = getTableConfig(table);
  const tableName = cfg.name;

  const columnDefs: string[] = [];
  const inlinePrimaryKey = new Set<string>();

  for (const col of cfg.columns) {
    const parts: string[] = [quoteIdent(col.name), col.getSQLType()];
    if (col.primary) {
      parts.push("PRIMARY KEY");
      inlinePrimaryKey.add(col.name);
      // `autoIncrement` is only meaningful when the column is the sole PK
      // and of type INTEGER. Drizzle exposes it as a column flag.
      const autoInc = (col as unknown as { autoIncrement?: boolean }).autoIncrement;
      if (autoInc) parts.push("AUTOINCREMENT");
    }
    if (col.notNull && !col.primary) parts.push("NOT NULL");
    if (col.default !== undefined) {
      parts.push(`DEFAULT ${formatDefault(col.default)}`);
    }
    columnDefs.push(parts.join(" "));
  }

  // Composite PRIMARY KEY: declared via `primaryKey({ columns: [...] })` in
  // Drizzle's table-extra map. Only emitted if no column already carries an
  // inline `PRIMARY KEY`.
  if (cfg.primaryKeys && cfg.primaryKeys.length > 0 && inlinePrimaryKey.size === 0) {
    for (const pk of cfg.primaryKeys) {
      const cols = pk.columns.map((c) => quoteIdent(c.name)).join(", ");
      columnDefs.push(`PRIMARY KEY (${cols})`);
    }
  }

  return `CREATE TABLE ${quoteIdent(tableName)} (${columnDefs.join(", ")})`;
}

/**
 * Build the `CREATE INDEX` statements for a Drizzle table from its
 * `getTableConfig().indexes` metadata. Returns empty array if the table
 * declares none. Ordering of returned statements is deterministic
 * (sorted by index name) so the test diff stays stable.
 */
export function indexStmtsFor(table: SQLiteTable): string[] {
  const cfg = getTableConfig(table);
  const tableName = cfg.name;
  const stmts: string[] = [];
  for (const idx of cfg.indexes) {
    const idxName = idx.config.name;
    const isUnique = idx.config.unique ?? false;
    const cols = idx.config.columns.map((c) => {
      // Drizzle index columns can be plain column refs OR sql expressions.
      // We only need .name for the comparison.
      const colName = (c as unknown as { name?: string }).name;
      if (typeof colName === "string") return quoteIdent(colName);
      // Fallback: treat as raw expression (unusual in codi today).
      return String(c);
    });
    stmts.push(
      `CREATE ${isUnique ? "UNIQUE " : ""}INDEX ${quoteIdent(idxName)} ` +
        `ON ${quoteIdent(tableName)} (${cols.join(", ")})`,
    );
  }
  return stmts.sort();
}

export interface PragmaColumn {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: number;
}

export interface PragmaIndex {
  seq: number;
  name: string;
  unique: 0 | 1;
  origin: string;
  partial: 0 | 1;
}

export interface PragmaIndexColumn {
  seqno: number;
  cid: number;
  name: string;
}

/**
 * Strip the positional `cid` (column index — diverges if column order
 * differs but we compare by name set anyway) and coerce `dflt_value` to
 * a canonical string so `0` (number from Drizzle) and `"0"` (string from
 * SQLite PRAGMA) compare equal. Type case-normalized.
 */
export function normalizeColumns(rows: PragmaColumn[]): Array<Omit<PragmaColumn, "cid">> {
  return rows
    .map((r) => ({
      name: r.name,
      type: r.type.toUpperCase(),
      notnull: r.notnull,
      dflt_value:
        r.dflt_value === null
          ? null
          : String(r.dflt_value).replace(/^'(.*)'$/, "$1"),
      pk: r.pk,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeIndexes(rows: PragmaIndex[]): Array<Pick<PragmaIndex, "name" | "unique">> {
  return rows
    .filter((r) => !r.name.startsWith("sqlite_autoindex_"))
    .map((r) => ({ name: r.name, unique: r.unique }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeIndexInfo(rows: PragmaIndexColumn[]): string[] {
  // Preserve seqno order — column order in an index is significant.
  return [...rows].sort((a, b) => a.seqno - b.seqno).map((r) => r.name);
}
