/**
 * Idempotent schema bootstrap for the brain DB.
 *
 * For Sprint 2 proper we ship a single 0001 migration that creates the 12
 * canonical tables, the FTS5 mirrors, and all indexes via raw SQL. Sprint 3+
 * will switch to drizzle-kit generated migrations once the schema stabilizes
 * and we need fine-grained alters; for now the all-in-one bootstrap is
 * simpler to reason about and sidesteps drizzle-kit's lack of FTS5 support.
 *
 * After schema migrations, `applyMigrations` invokes
 * `seedWorkflowDefinitions` so the `workflow_definitions` table is always
 * populated from `src/templates/workflows/*.yaml` on every brain open. This
 * is what makes the DB-backed half of the workflow engine (workflow-graph)
 * a viable single source of truth — without this seed step, the table was
 * empty in production and every DB-backed gate lookup silently fell back.
 */

import type Database from "better-sqlite3";
import { seedWorkflowDefinitions } from "./seed-workflows.js";

const BOOTSTRAP_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    repo_path  TEXT NOT NULL,
    git_remote TEXT,
    name       TEXT NOT NULL,
    first_seen INTEGER NOT NULL,
    last_seen  INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    session_id          TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL,
    agent_type          TEXT NOT NULL,
    agent_model         TEXT,
    started_at          INTEGER NOT NULL,
    ended_at            INTEGER,
    branch              TEXT,
    commit_sha          TEXT,
    working_dir         TEXT NOT NULL,
    transcript_path     TEXT,
    workflow_id         TEXT,
    total_turns         INTEGER DEFAULT 0,
    total_capture_count INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS prompts (
    prompt_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    turn_no    INTEGER NOT NULL,
    ts         INTEGER NOT NULL,
    text       TEXT NOT NULL,
    char_count INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS turns (
    turn_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    turn_no     INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    agent_text  TEXT,
    duration_ms INTEGER,
    prompt_id   INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS captures (
    capture_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL,
    prompt_id   INTEGER NOT NULL,
    turn_id     INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    type        TEXT NOT NULL,
    content     TEXT NOT NULL,
    raw_marker  TEXT NOT NULL,
    file_paths  TEXT,
    workflow_id TEXT,
    phase       TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tool_calls (
    call_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     TEXT NOT NULL,
    turn_id        INTEGER NOT NULL,
    ts             INTEGER NOT NULL,
    tool_name      TEXT NOT NULL,
    input_json     TEXT NOT NULL,
    output_summary TEXT,
    duration_ms    INTEGER,
    status         TEXT NOT NULL,
    error          TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS corrections (
    correction_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     TEXT NOT NULL,
    ts             INTEGER NOT NULL,
    file_path      TEXT NOT NULL,
    diff_summary   TEXT NOT NULL,
    source_turn_id INTEGER,
    detected_via   TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS artifacts_used (
    usage_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL,
    turn_id       INTEGER,
    ts            INTEGER NOT NULL,
    artifact_type TEXT NOT NULL,
    artifact_name TEXT NOT NULL,
    event         TEXT NOT NULL,
    outcome       TEXT,
    duration_ms   INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS _codi_schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
    workflow_id   TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL,
    type          TEXT NOT NULL,
    current_phase TEXT NOT NULL,
    status        TEXT NOT NULL,
    started_at    INTEGER NOT NULL,
    ended_at      INTEGER,
    metadata      TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS workflow_events (
    event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    ts          INTEGER NOT NULL,
    payload     TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_project_started   ON sessions(project_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_type_session      ON captures(type, session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_session_ts        ON captures(session_id, ts)`,
  `CREATE INDEX IF NOT EXISTS idx_prompts_session_turn       ON prompts(session_id, turn_no)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_calls_session_turn    ON tool_calls(session_id, turn_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_used_name_outcome ON artifacts_used(artifact_name, outcome)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_status ON workflow_runs(project_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_events_wf_ts      ON workflow_events(workflow_id, ts)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_turn_marker       ON captures(turn_id, raw_marker)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_started ON workflow_runs(status, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_prompts_session_pid_desc   ON prompts(session_id, prompt_id DESC)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS captures_fts USING fts5(
    content,
    content='captures',
    content_rowid='capture_id'
  )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
    text,
    content='prompts',
    content_rowid='prompt_id'
  )`,
  `CREATE TRIGGER IF NOT EXISTS captures_fts_ai AFTER INSERT ON captures BEGIN
    INSERT INTO captures_fts(rowid, content) VALUES (new.capture_id, new.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS captures_fts_ad AFTER DELETE ON captures BEGIN
    INSERT INTO captures_fts(captures_fts, rowid, content) VALUES('delete', old.capture_id, old.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS captures_fts_au AFTER UPDATE ON captures BEGIN
    INSERT INTO captures_fts(captures_fts, rowid, content) VALUES('delete', old.capture_id, old.content);
    INSERT INTO captures_fts(rowid, content) VALUES (new.capture_id, new.content);
  END`,
  `CREATE TRIGGER IF NOT EXISTS prompts_fts_ai AFTER INSERT ON prompts BEGIN
    INSERT INTO prompts_fts(rowid, text) VALUES (new.prompt_id, new.text);
  END`,
  `CREATE TRIGGER IF NOT EXISTS prompts_fts_ad AFTER DELETE ON prompts BEGIN
    INSERT INTO prompts_fts(prompts_fts, rowid, text) VALUES('delete', old.prompt_id, old.text);
  END`,
  `CREATE TRIGGER IF NOT EXISTS prompts_fts_au AFTER UPDATE ON prompts BEGIN
    INSERT INTO prompts_fts(prompts_fts, rowid, text) VALUES('delete', old.prompt_id, old.text);
    INSERT INTO prompts_fts(rowid, text) VALUES (new.prompt_id, new.text);
  END`,
  // Workflow definitions — phases, gates, transitions, flags per workflow type.
  // Seeded at codi init from src/templates/workflows/*.yaml; user-extensible
  // via `codi workflow create`. The `definition` blob is the canonical
  // structure; runtime reads it for phase enforcement and gate selection.
  `CREATE TABLE IF NOT EXISTS workflow_definitions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    version     INTEGER NOT NULL,
    managed_by  TEXT NOT NULL,
    definition  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_definitions_managed_by ON workflow_definitions(managed_by)`,
];

export const CURRENT_SCHEMA_VERSION = 15;

/**
 * Per-version ALTER statements applied on top of BOOTSTRAP_STATEMENTS for
 * databases that already exist at an older version. Each migration is a
 * tuple `[version, statements]`. The runner picks every migration whose
 * version is greater than the last applied row.
 *
 * v3 introduces soft-delete on captures and proposals so the brain UI can
 * remove rows without losing history. Reads filter `deleted_at IS NULL`
 * by default; the trash view drops the filter.
 *
 * v4 adds per-session and per-turn token usage + cost columns so the UI
 * can render context-window utilization and cumulative spend without
 * re-parsing the transcript on every page load.
 */
const VERSIONED_MIGRATIONS: ReadonlyArray<readonly [number, readonly string[]]> = [
  [
    3,
    [
      `ALTER TABLE captures ADD COLUMN deleted_at INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_captures_deleted_at ON captures(deleted_at)`,
      // proposals.deleted_at + idx_proposals_deleted_at intentionally omitted —
      // the proposals table is dropped entirely in v10.
    ],
  ],
  [
    4,
    [
      `ALTER TABLE sessions ADD COLUMN tokens_input INTEGER`,
      `ALTER TABLE sessions ADD COLUMN tokens_output INTEGER`,
      `ALTER TABLE sessions ADD COLUMN tokens_cache_create INTEGER`,
      `ALTER TABLE sessions ADD COLUMN tokens_cache_read INTEGER`,
      `ALTER TABLE sessions ADD COLUMN tokens_preloaded INTEGER`,
      `ALTER TABLE sessions ADD COLUMN cost_usd REAL`,
      `ALTER TABLE sessions ADD COLUMN context_window INTEGER`,
      `ALTER TABLE sessions ADD COLUMN tokens_estimated INTEGER`,
      `ALTER TABLE turns ADD COLUMN tokens_input INTEGER`,
      `ALTER TABLE turns ADD COLUMN tokens_output INTEGER`,
      `ALTER TABLE turns ADD COLUMN tokens_cache_create INTEGER`,
      `ALTER TABLE turns ADD COLUMN tokens_cache_read INTEGER`,
    ],
  ],
  [
    5,
    [
      // Track the largest single-message prefix observed in the
      // transcript. The fill bar reads this column instead of summing
      // `cache_read` across every turn (which produces meaningless
      // multi-million totals over long sessions).
      `ALTER TABLE sessions ADD COLUMN tokens_max_prefix INTEGER`,
    ],
  ],
  [
    6,
    [
      // Count of assistant API calls observed in the transcript. May be
      // higher than `total_turns` when the codi Stop hook missed rounds
      // (only the agent's own captures bump total_turns; the transcript
      // sees every Anthropic call). UI exposes the gap so the dev can
      // reconcile billing vs codi telemetry.
      `ALTER TABLE sessions ADD COLUMN tokens_messages_count INTEGER`,
    ],
  ],
  [
    7,
    [
      // Identify the developer who owns the brain DB. Read at session
      // start from `git config user.name/email` and `os.userInfo()`.
      // Multiple devs sharing one machine still get distinct rows
      // because the project_id derives from cwd, not from user.
      `ALTER TABLE projects ADD COLUMN git_user_name TEXT`,
      `ALTER TABLE projects ADD COLUMN git_user_email TEXT`,
      `ALTER TABLE projects ADD COLUMN host_user TEXT`,
      `ALTER TABLE projects ADD COLUMN host_machine TEXT`,
    ],
  ],
  [
    8,
    [
      // Cover dedup probe in persistMarkers — without this index the query
      // does a full SCAN of captures, which becomes O(N) as the table grows.
      `CREATE INDEX IF NOT EXISTS idx_captures_turn_marker ON captures(turn_id, raw_marker)`,
    ],
  ],
  [
    9,
    [
      // Cover readGateState (status + started_at DESC) and readRecentPrompts
      // (session_id + prompt_id DESC) — both run on every UserPromptSubmit
      // hook. Without these indexes both queries fall back to TEMP B-TREE
      // sorts that scale with table size.
      `CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_started ON workflow_runs(status, started_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_prompts_session_pid_desc ON prompts(session_id, prompt_id DESC)`,
    ],
  ],
  [
    10,
    [
      // Drop the legacy consolidation pipeline storage. The auto-detection
      // P1-P9 runner + proposals table + /proposals UI page were retired
      // in favor of the agent-driven team-consolidation workflow that
      // produces a markdown report consumed by existing meta-skills.
      // Idempotent via DROP IF EXISTS.
      `DROP INDEX IF EXISTS idx_proposals_status_created`,
      `DROP INDEX IF EXISTS idx_proposals_pattern`,
      `DROP INDEX IF EXISTS idx_proposals_deleted_at`,
      `DROP TABLE IF EXISTS proposals`,
    ],
  ],
  [
    11,
    [
      // ISSUE-037 — lift the `__codi_session__` singleton out of workflow_runs.
      //
      // Pre-v11: the active-workflow pointer + single-process lock lived in
      //   workflow_runs as a fake row with workflow_id='__codi_session__',
      //   type='session', metadata=JSON({ active_id, lock_held_pid,
      //   lock_acquired_at }). Every aggregation over workflow_runs had to
      //   add `AND type != 'session'` to skip the singleton — 4 production
      //   sites + 2 test fixtures.
      //
      // Post-v11: a dedicated runtime_state(key, value) KV table owns the
      //   metadata. The singleton row is migrated then deleted in this same
      //   transaction so an aborted upgrade leaves no orphan.
      //
      // INSERT…SELECT is idempotent on fresh DBs (no singleton exists, so
      // 0 rows inserted). DELETE on a non-existent row is a no-op.
      `CREATE TABLE IF NOT EXISTS runtime_state (
         key   TEXT PRIMARY KEY,
         value TEXT NOT NULL
       )`,
      `INSERT OR REPLACE INTO runtime_state(key, value)
         SELECT 'session', metadata
         FROM workflow_runs
         WHERE workflow_id = '__codi_session__' AND metadata IS NOT NULL`,
      `DELETE FROM workflow_runs WHERE workflow_id = '__codi_session__'`,
    ],
  ],
  [
    12,
    [
      // ISSUE-049 — write-time artifact attribution for corrections.
      //
      // Pre-v12: the `corrections` table existed in schema but had no
      // writer. The audit proposed a SQL VIEW that JOINed corrections to
      // artifacts_used by (session_id, turn_id) — but turn-overlap is
      // correlation, not causation, and a VIEW would calcify a flawed
      // attribution heuristic.
      //
      // Post-v12: corrections gain a `linked_artifacts` TEXT column
      // populated at write-time by `recordCorrectionFromMarker` in
      // runtime/capture/persist.ts. When a CORRECTION marker is
      // persisted by the Stop hook, we snapshot the artifacts active in
      // that exact turn and store the list as a JSON array. This makes
      // the attribution explicit at the moment the correction was
      // captured, instead of inferring it later from temporal overlap.
      //
      // The index covers the (session_id, source_turn_id) lookup
      // performed during snapshot resolution.
      `ALTER TABLE corrections ADD COLUMN linked_artifacts TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_corrections_session_turn
         ON corrections(session_id, source_turn_id)`,
    ],
  ],
  [
    13,
    [
      // ISSUE-050 — persisted history of `evals.json` trigger evaluations.
      //
      // Background: every Codi skill ships `evals/evals.json`, run by
      // `dev-skill-creator/scripts/ts/run-eval.ts` to verify the skill's
      // description actually causes the agent to trigger. The runner has
      // been writing to stdout only — no history, no trend analysis.
      //
      // This table is the persistence target for that runner (and any
      // future eval harness, e.g. CI sweeps). Indexed for the two most
      // likely queries: "show the last N runs of skill X" and
      // "show recent runs across a whole project". A nullable `metadata`
      // JSON column hosts forward-compatible extras so new eval harnesses
      // do not force a v14 ALTER for every new dimension.
      `CREATE TABLE IF NOT EXISTS eval_runs (
         run_id          INTEGER PRIMARY KEY AUTOINCREMENT,
         ts              INTEGER NOT NULL,
         project_id      TEXT NOT NULL,
         session_id      TEXT,
         skill_name      TEXT NOT NULL,
         skill_version   TEXT,
         case_id         TEXT NOT NULL,
         passed          INTEGER NOT NULL,
         trigger_rate    REAL,
         runs            INTEGER NOT NULL DEFAULT 1,
         triggers        INTEGER,
         model           TEXT,
         duration_ms     INTEGER,
         error           TEXT,
         trigger_source  TEXT NOT NULL,
         metadata        TEXT
       )`,
      `CREATE INDEX IF NOT EXISTS idx_eval_runs_skill_ts
         ON eval_runs(skill_name, ts DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_eval_runs_project_skill
         ON eval_runs(project_id, skill_name)`,
    ],
  ],
  [
    14,
    [
      // ISSUE-052 — actor attribution on corrections.
      //
      // The audit asked for actor_id on corrections and the
      // operations-ledger so team-brain aggregation (ADR-005) can join
      // events to the human or agent that produced them. The ledger is
      // a JSON file and gains its `actor` field without a SQL migration
      // (handled by the ledger writer + a schema version bump from "1"
      // to "2"). corrections is SQL, so it gets an ALTER + index here.
      //
      // Format: `actor_id` stores `"<type>:<id>"` e.g. "human:user@x.com"
      // or "agent:claude-code". Existing rows are NULL (pre-ISSUE-049
      // they were also empty); aggregators must COALESCE.
      `ALTER TABLE corrections ADD COLUMN actor_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_corrections_actor ON corrections(actor_id)`,
    ],
  ],
  [
    15,
    [
      // ISSUE-053 — cross-team aggregation key on the three audit-trail
      // tables. Source of the slug: `.codi/codi.yaml` team_id, CODI_TEAM_ID
      // env, or null. Resolution happens at write-time via
      // `src/core/audit/resolve-team.ts`. Indexes cover the two common
      // team-scoped queries: "all sessions for team X by recency" and
      // "captures for team X over time".
      `ALTER TABLE sessions ADD COLUMN team_id TEXT`,
      `ALTER TABLE captures ADD COLUMN team_id TEXT`,
      `ALTER TABLE workflow_runs ADD COLUMN team_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_team_started ON sessions(team_id, started_at)`,
      `CREATE INDEX IF NOT EXISTS idx_captures_team_ts ON captures(team_id, ts)`,
      `CREATE INDEX IF NOT EXISTS idx_workflow_runs_team_status ON workflow_runs(team_id, status)`,
    ],
  ],
];

function columnExists(raw: Database.Database, table: string, column: string): boolean {
  const rows = raw.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function safeRun(raw: Database.Database, stmt: string): void {
  // ALTER TABLE ADD COLUMN is the only stmt SQLite cannot make idempotent
  // by itself. Inspect the schema first; CREATE INDEX IF NOT EXISTS handles
  // its own idempotency.
  const addColMatch = stmt.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
  if (addColMatch && columnExists(raw, addColMatch[1]!, addColMatch[2]!)) return;
  raw.prepare(stmt).run();
}

/**
 * Apply migrations to bring the brain DB up to CURRENT_SCHEMA_VERSION.
 *
 * Strategy:
 *   - BOOTSTRAP_STATEMENTS create the canonical v2 schema with `IF NOT
 *     EXISTS` so they are safe on every call.
 *   - On a fresh DB, after bootstrap, jump straight to CURRENT_SCHEMA_VERSION
 *     (running every VERSIONED_MIGRATIONS over the freshly bootstrapped
 *     tables) so the version row reflects the live schema after a single
 *     `applyMigrations` call.
 *   - On an existing DB at v < CURRENT_SCHEMA_VERSION, run only the missing
 *     versioned migrations.
 *
/**
 * Per-process memoisation of handles that have already had their schema
 * applied. Keyed by the live `better-sqlite3.Database` instance (WeakSet
 * permits GC when the handle closes). Skips both BOOTSTRAP_STATEMENTS and
 * `seedWorkflowDefinitions` on subsequent calls in the same process.
 *
 * Why per-handle rather than per-path:
 *   - Tests open many in-memory DBs at `:memory:`; a path-keyed cache
 *     would skip migration on the second test in the same Vitest worker.
 *   - Hooks spawn a fresh Node process per fire — there is no prior cache
 *     to consult, so they pay the cost once per fire regardless. This
 *     cache helps long-lived consumers (CLI loop, brain-ui server) that
 *     open one handle and reuse it.
 */
const MIGRATED_HANDLES = new WeakSet<Database.Database>();

/**
 * Idempotent: a second invocation on the same `raw` handle short-circuits
 * via the per-process WeakSet. A fresh handle re-runs the migration path
 * (and the on-disk SQL is itself idempotent — every statement uses
 * `CREATE … IF NOT EXISTS` and the versioned section gates on
 * `_codi_schema_version`).
 */
export function applyMigrations(raw: Database.Database): { applied: number[] } {
  if (MIGRATED_HANDLES.has(raw)) return { applied: [] };

  // ISSUE-083 — guarantee busy_timeout is in effect before any migration
  // transaction. Callers that go through openBrain already set this
  // (ISSUE-060), but tests and migration scripts sometimes open a raw
  // better-sqlite3 Database directly. Without busy_timeout, a concurrent
  // writer holding the WAL causes the migration BEGIN IMMEDIATE to fail
  // with SQLITE_BUSY rather than wait. The pragma is idempotent.
  raw.pragma("busy_timeout = 5000");

  const applied: number[] = [];
  const txn = raw.transaction(() => {
    for (const stmt of BOOTSTRAP_STATEMENTS) {
      raw.prepare(stmt).run();
    }
  });
  txn();
  const versionRow = raw.prepare("SELECT MAX(version) as v FROM _codi_schema_version").get() as {
    v: number | null;
  };
  const lastVersion = versionRow.v ?? 0;
  if (lastVersion < CURRENT_SCHEMA_VERSION) {
    const versionTxn = raw.transaction(() => {
      for (const [version, statements] of VERSIONED_MIGRATIONS) {
        if (version <= lastVersion) continue;
        for (const stmt of statements) {
          safeRun(raw, stmt);
        }
      }
      raw
        .prepare("INSERT INTO _codi_schema_version(version, applied_at) VALUES (?, ?)")
        .run(CURRENT_SCHEMA_VERSION, Date.now());
    });
    versionTxn();
    applied.push(CURRENT_SCHEMA_VERSION);
  }

  // Seed workflow_definitions from src/templates/workflows/*.yaml ONLY when
  // we actually applied a new schema version (first migration of this DB)
  // OR when this is a fresh handle the cache has not seen yet. Both
  // conditions are true on entry here. Re-seeding on every call previously
  // hit the hot hook path with file I/O + YAML parse + N upserts on every
  // PostToolUse / Stop fire. Idempotent: managed_by='codi' rows are
  // upserted, managed_by='user' rows are preserved. Defensive: built-in
  // YAML lookup may fail in a test harness without `src/templates/` on
  // disk — swallow and continue.
  try {
    seedWorkflowDefinitions(raw);
  } catch {
    /* best-effort seed — never block migration */
  }

  MIGRATED_HANDLES.add(raw);
  return { applied };
}

/**
 * Test-only: clear the per-process migration cache. Vitest workers may
 * reuse module state across files; tests that intentionally exercise the
 * "second applyMigrations call is a no-op" assertion (or recover from a
 * mid-test schema reset) call this to drop the WeakSet entry for a handle.
 */
export function _resetMigrationCacheForTests(): void {
  // WeakSet has no .clear(); the cheapest reset is to swap the reference.
  // Cast through unknown because `MIGRATED_HANDLES` is declared `const`
  // intentionally — production code MUST NOT mutate it.
  (MIGRATED_HANDLES as unknown as { _store?: never })._store = undefined;
}
