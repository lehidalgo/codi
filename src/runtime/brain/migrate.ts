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
];

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Apply migrations to bring the brain DB up to CURRENT_SCHEMA_VERSION.
 * Idempotent: running twice is a no-op once the version row is present.
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
  if ((versionRow.v ?? 0) < CURRENT_SCHEMA_VERSION) {
    raw
      .prepare("INSERT INTO _codi_schema_version(version, applied_at) VALUES (?, ?)")
      .run(CURRENT_SCHEMA_VERSION, Date.now());
    applied.push(CURRENT_SCHEMA_VERSION);
  }
  return { applied };
}
