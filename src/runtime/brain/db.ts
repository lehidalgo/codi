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
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { BRAIN_DB_FILENAME, PROJECT_DIR, STATE_DIR } from "#src/constants.js";
import * as schema from "./schema.js";

export type BrainDb = BetterSQLite3Database<typeof schema>;

/**
 * Walk up from `start` looking for a directory that contains a `.codi/`
 * subdir. Returns the path to `<dir>/.codi/state/brain.db` if a `.codi/` is
 * found (regardless of whether the file exists yet — the caller may want to
 * create it). Returns null if no `.codi/` is found between start and the
 * filesystem root.
 *
 * Backwards-compat: if a legacy `<dir>/.codi/brain.db` exists at the old
 * top-level location and no `state/brain.db` is present yet, the legacy
 * path is migrated transparently.
 */
export function findProjectBrainPath(start: string): string | null {
  let current = resolve(start);
  // Bound the walk: stop at the filesystem root.
  for (let i = 0; i < 64; i += 1) {
    const codiDir = join(current, PROJECT_DIR);
    if (existsSync(codiDir)) {
      try {
        if (statSync(codiDir).isDirectory()) {
          const stateBrain = join(codiDir, STATE_DIR, BRAIN_DB_FILENAME);
          const legacyBrain = join(codiDir, BRAIN_DB_FILENAME);
          migrateLegacyBrainDb(legacyBrain, stateBrain);
          return stateBrain;
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
 * `.codi/state/brain.db`, and finally falls back to `~/.codi/state/brain.db`.
 *
 * Optional `cwd` override is exposed primarily for tests.
 */
export function defaultBrainPath(cwd: string = process.cwd()): string {
  const override = process.env["CODI_BRAIN_DB"];
  if (override && override.length > 0) return resolve(override);
  const projectBrain = findProjectBrainPath(cwd);
  if (projectBrain) return projectBrain;
  const homeCodi = resolve(homedir(), PROJECT_DIR);
  const stateBrain = join(homeCodi, STATE_DIR, BRAIN_DB_FILENAME);
  const legacyBrain = join(homeCodi, BRAIN_DB_FILENAME);
  migrateLegacyBrainDb(legacyBrain, stateBrain);
  return stateBrain;
}

/**
 * Move a legacy `<dir>/brain.db` into `<dir>/state/brain.db` once. Idempotent
 * and silent: if the destination already exists, the legacy file is left
 * alone (a previous migration ran). If neither exists, this is a no-op.
 */
function migrateLegacyBrainDb(legacyPath: string, statePath: string): void {
  if (!existsSync(legacyPath)) return;
  if (existsSync(statePath)) return;
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    renameSync(legacyPath, statePath);
    // Best-effort: move sidecar files that better-sqlite3 leaves behind in
    // WAL mode so a half-migrated DB does not surface as corruption. They
    // may not exist yet — ignore failures.
    for (const suffix of ["-wal", "-shm"]) {
      const legacySide = `${legacyPath}${suffix}`;
      const stateSide = `${statePath}${suffix}`;
      if (existsSync(legacySide) && !existsSync(stateSide)) {
        try {
          renameSync(legacySide, stateSide);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    // Migration failed (permissions, EXDEV across volumes). Caller will
    // open the new path and create a fresh DB; the legacy file stays put
    // so the user can recover it manually.
  }
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
 * Thrown when better-sqlite3's native binding cannot be loaded — typically
 * because the consumer's package manager skipped the postinstall build step
 * (pnpm v10+ does this by default unless the package is in the
 * onlyBuiltDependencies allowlist). Carries an actionable fix command for
 * each major package manager so the user does not have to interpret the
 * raw node-gyp / bindings stack trace.
 */
export class BrainBindingsError extends Error {
  constructor(cause: Error) {
    super(
      "better-sqlite3 native binding is missing.\n\n" +
        "This usually means your package manager skipped the build step.\n" +
        "Fix it with one of:\n" +
        "  pnpm:  pnpm approve-builds && pnpm rebuild better-sqlite3\n" +
        "  npm:   npm rebuild better-sqlite3\n" +
        "  yarn:  yarn rebuild better-sqlite3\n\n" +
        "Run it in the directory where codi is installed.",
    );
    this.name = "BrainBindingsError";
    this.cause = cause;
  }
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
  let raw: Database.Database;
  try {
    raw = new Database(path, { readonly: opts.readonly ?? false });
  } catch (e) {
    if (e instanceof Error && /Could not locate the bindings file/i.test(e.message)) {
      throw new BrainBindingsError(e);
    }
    throw e;
  }
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  raw.pragma("synchronous = NORMAL");
  // DEFECT-007 fix: better-sqlite3 enables SQLITE_DBCONFIG_DEFENSIVE by
  // default, which blocks the FTS5 contentless-sync command
  // (`INSERT INTO prompts_fts(prompts_fts, ...) VALUES('delete', ...)`)
  // with "unsafe use of virtual table". That command is the body of
  // AFTER UPDATE / AFTER DELETE triggers on `captures` and `prompts`
  // (see migrate.ts FTS5 trigger block), so it fires on EVERY runtime
  // write — not just migration. Scoping unsafeMode to migration only
  // (audit ISSUE-012) would re-introduce the failure on every capture
  // soft-delete / restore / bulk-delete / retention prune (verified
  // against routes-api.ts UPDATE callsites). Permanent unsafeMode is the
  // documented SQLite + better-sqlite3 + FTS5-contentless pattern.
  //
  // Safety: every SQL statement on this handle is a static
  // `raw.prepare("...")` parameterised query — no `raw.exec(<dynamic>)`,
  // no template-literal SQL composition. The defensive flag protects
  // against SQL injection that this codebase already prevents at the
  // application layer. Future contributors must preserve that invariant
  // (no dynamic SQL) or add the lint rule from the security backlog.
  if (!(opts.readonly ?? false)) raw.unsafeMode(true);
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
