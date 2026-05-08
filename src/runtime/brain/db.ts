/**
 * Brain database connection — lazy singleton per (projectRoot, dbPath).
 *
 * Default location: `~/.codi/brain.db` (zero mode). Tests pass an explicit
 * tmp path. Drizzle wraps better-sqlite3; FTS5 tables are created post-
 * migration via raw SQL.
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";

export type BrainDb = BetterSQLite3Database<typeof schema>;

export function defaultBrainPath(): string {
  return resolve(homedir(), ".codi", "brain.db");
}

export interface OpenBrainOptions {
  /** Override the database path. Default: `~/.codi/brain.db`. */
  readonly dbPath?: string;
  /** Open as readonly. Default: false. */
  readonly readonly?: boolean;
}

export interface BrainHandle {
  readonly db: BrainDb;
  readonly raw: Database.Database;
  readonly path: string;
  close(): void;
}

/**
 * Open (or create) the brain database. Caller must close the handle.
 *
 * Schema is NOT applied here — call `applyMigrations` separately. Keeping
 * the responsibilities split lets tests open an empty DB, run migrations,
 * and assert state independently.
 */
export function openBrain(opts: OpenBrainOptions = {}): BrainHandle {
  const path = opts.dbPath ?? defaultBrainPath();
  mkdirSync(dirname(path), { recursive: true });
  const raw = new Database(path, { readonly: opts.readonly ?? false });
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("synchronous = NORMAL");
  const db = drizzle(raw, { schema });
  return {
    db,
    raw,
    path,
    close: () => {
      raw.close();
    },
  };
}
