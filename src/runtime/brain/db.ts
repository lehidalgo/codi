/**
 * Brain database connection — lazy singleton per (projectRoot, dbPath).
 *
 * Default location resolution chain (DEFECT-008 fix — cwd-based):
 *   1. `CODI_BRAIN_DB` env var (explicit override; used by tests + scripts)
 *   2. The nearest project-local brain — walk up from cwd looking for a
 *      `.codi/` directory; if found, use `<that-dir>/.codi/brain.db`.
 *      This means agents that exec `codi` inside a project automatically
 *      hit the project's brain, not the user's home brain (which used to
 *      surface phantom workflows from sibling projects' tests/runs).
 *   3. `~/.codi/brain.db` — global fallback when no project context
 *      exists (e.g. scripts run from /tmp with no .codi dir on the path).
 *
 * Drizzle wraps better-sqlite3; FTS5 tables are created post-migration
 * via raw SQL.
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import * as schema from "./schema.js";

export type BrainDb = BetterSQLite3Database<typeof schema>;

/**
 * Walk up from `start` looking for a directory that contains a `.codi/`
 * subdir. Returns the path to `<dir>/.codi/brain.db` (regardless of
 * whether the file exists yet — the caller may want to create it).
 * Returns null if no `.codi/` is found between start and filesystem root.
 */
export function findProjectBrainPath(start: string): string | null {
  let current = resolve(start);
  // Bound the walk: stop at the filesystem root.
  for (let i = 0; i < 64; i += 1) {
    const codiDir = join(current, ".codi");
    if (existsSync(codiDir)) {
      try {
        if (statSync(codiDir).isDirectory()) {
          return join(codiDir, "brain.db");
        }
      } catch {
        // permission / race — keep walking
      }
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

/**
 * Path to the brain database. Honors `CODI_BRAIN_DB` first (tests + scripts
 * that need isolation), then walks up from cwd looking for a project-local
 * `.codi/brain.db`, and finally falls back to `~/.codi/brain.db`.
 *
 * Optional `cwd` override is exposed primarily for tests.
 */
export function defaultBrainPath(cwd: string = process.cwd()): string {
  const override = process.env["CODI_BRAIN_DB"];
  if (override && override.length > 0) return resolve(override);
  const projectBrain = findProjectBrainPath(cwd);
  if (projectBrain) return projectBrain;
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
