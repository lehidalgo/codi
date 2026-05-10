/**
 * Idempotent schema bootstrap for the brain DB.
 *
 * For Sprint 2 proper we ship a single 0001 migration that creates the 11
 * canonical tables, the FTS5 mirrors, and all indexes via raw SQL. Sprint 3+
 * will switch to drizzle-kit generated migrations once the schema stabilizes
 * and we need fine-grained alters; for now the all-in-one bootstrap is
 * simpler to reason about and sidesteps drizzle-kit's lack of FTS5 support.
 */

import type Database from "better-sqlite3";

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
  // Sprint 5: consolidation pipeline output. Proposals are reviewer-facing
  // diffs against existing artifacts (or new artifact suggestions). Status
  // transitions: pending -> accepted | rejected. evidence_json is a JSON
  // array of capture_ids / artifact_usage_ids that justified the proposal.
  `CREATE TABLE IF NOT EXISTS proposals (
    proposal_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_code    TEXT NOT NULL,
    proposal_type   TEXT NOT NULL,
    artifact_kind   TEXT,
    artifact_name   TEXT,
    title           TEXT NOT NULL,
    rationale       TEXT NOT NULL,
    patch_json      TEXT,
    evidence_json   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      INTEGER NOT NULL,
    decided_at      INTEGER,
    decision_reason TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_proposals_status_created
   ON proposals(status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_proposals_pattern
   ON proposals(pattern_code)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_project_started   ON sessions(project_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_type_session      ON captures(type, session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_session_ts        ON captures(session_id, ts)`,
  `CREATE INDEX IF NOT EXISTS idx_prompts_session_turn       ON prompts(session_id, turn_no)`,
  `CREATE INDEX IF NOT EXISTS idx_tool_calls_session_turn    ON tool_calls(session_id, turn_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artifacts_used_name_outcome ON artifacts_used(artifact_name, outcome)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_runs_project_status ON workflow_runs(project_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_workflow_events_wf_ts      ON workflow_events(workflow_id, ts)`,
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

export const CURRENT_SCHEMA_VERSION = 6;

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
      `ALTER TABLE proposals ADD COLUMN deleted_at INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_captures_deleted_at ON captures(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_proposals_deleted_at ON proposals(deleted_at)`,
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
 * Idempotent: a second invocation reads the recorded version and short-
 * circuits.
 */
export function applyMigrations(raw: Database.Database): { applied: number[] } {
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
  if (lastVersion >= CURRENT_SCHEMA_VERSION) return { applied };

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
  return { applied };
}
