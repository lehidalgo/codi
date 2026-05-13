/**
 * Session / prompt / turn / tool_call / artifact_usage persistence helpers.
 *
 * The Stop hook, UserPromptSubmit hook, and PostToolUse hook all need to
 * write into the brain DB from the same set of primitives. This module
 * keeps that surface in one place so the hook scripts stay short.
 *
 * Idempotency:
 *   - `ensureSession` UPSERTs by session_id; safe to call from every hook.
 *   - `recordPrompt` returns the promptId + turnNo for the freshly-inserted
 *     prompt; the caller pairs it with `openTurn` to anchor captures.
 *   - `recordToolCall` inserts unconditionally (Claude Code may invoke the
 *     same tool name multiple times per turn, each with distinct input).
 *   - `recordArtifactUsage` inserts unconditionally; deduplication is the
 *     caller's responsibility because an artifact may be invoked twice.
 *
 * No business logic lives here — it's CRUD only. The hooks compose these
 * helpers into per-event flows.
 */

import type Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { hostname, userInfo } from "node:os";
import { basename } from "node:path";
import type { CapturedArtifactType } from "#src/core/artifact-types.js";
import { resolveTeamId } from "#src/core/audit/resolve-team.js";

export interface EnsureProjectInput {
  readonly projectId: string;
  readonly cwd: string;
}

interface GitIdentity {
  readonly name: string | null;
  readonly email: string | null;
  readonly remote: string | null;
}

function execGit(cwd: string, args: readonly string[]): string | null {
  // execFileSync uses argv array — no shell, no command injection vector.
  try {
    const out = execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 1000,
    });
    const v = out.trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

function readGitIdentity(cwd: string): GitIdentity {
  return {
    name: execGit(cwd, ["config", "--get", "user.name"]),
    email: execGit(cwd, ["config", "--get", "user.email"]),
    remote: execGit(cwd, ["remote", "get-url", "origin"]),
  };
}

/**
 * UPSERT the `projects` row for this cwd. First call mints the row with
 * git identity + host user; subsequent calls touch `last_seen` so we can
 * tell which project the dev actively works on. Failures are silent —
 * git not installed or not a repo simply leaves the columns null.
 */
export function ensureProject(raw: Database.Database, input: EnsureProjectInput): void {
  const now = Date.now();
  const exists = raw
    .prepare(`SELECT project_id FROM projects WHERE project_id = ?`)
    .get(input.projectId);
  if (exists) {
    raw.prepare(`UPDATE projects SET last_seen = ? WHERE project_id = ?`).run(now, input.projectId);
    return;
  }
  const git = readGitIdentity(input.cwd);
  const host = userInfo().username;
  const machine = hostname();
  const name = basename(input.cwd) || input.projectId;
  raw
    .prepare(
      `INSERT INTO projects(project_id, repo_path, git_remote, name, first_seen, last_seen,
                             git_user_name, git_user_email, host_user, host_machine)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.projectId,
      input.cwd,
      git.remote,
      name,
      now,
      now,
      git.name,
      git.email,
      host,
      machine,
    );
}

export interface EnsureSessionInput {
  readonly sessionId: string;
  readonly projectId: string;
  readonly agentType: string;
  readonly agentModel?: string;
  readonly workingDir: string;
  readonly transcriptPath?: string;
  readonly branch?: string;
  readonly commitSha?: string;
  readonly workflowId?: string;
}

/**
 * Insert or update the sessions row. Mints a fresh started_at on first
 * insert; preserves it on subsequent calls (so the hook can fire from
 * many events without rewinding the clock).
 */
export function ensureSession(raw: Database.Database, input: EnsureSessionInput): void {
  const now = Date.now();
  const exists = raw
    .prepare(`SELECT session_id FROM sessions WHERE session_id = ?`)
    .get(input.sessionId);
  if (exists) {
    raw
      .prepare(
        `UPDATE sessions
            SET working_dir     = ?,
                transcript_path = COALESCE(?, transcript_path),
                branch          = COALESCE(?, branch),
                commit_sha      = COALESCE(?, commit_sha),
                workflow_id     = COALESCE(?, workflow_id)
          WHERE session_id = ?`,
      )
      .run(
        input.workingDir,
        input.transcriptPath ?? null,
        input.branch ?? null,
        input.commitSha ?? null,
        input.workflowId ?? null,
        input.sessionId,
      );
    return;
  }
  // ISSUE-053: stamp team_id at write-time so cross-team brain
  // aggregation (ADR-005, ISSUE-055) can demux this row. Resolved from
  // .codi/codi.yaml `team_id`, CODI_TEAM_ID env, or null (untagged).
  const teamId = resolveTeamId({ cwd: input.workingDir });
  raw
    .prepare(
      `INSERT INTO sessions(session_id, project_id, agent_type, agent_model, started_at,
                            working_dir, transcript_path, branch, commit_sha, workflow_id,
                            total_turns, total_capture_count, team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    )
    .run(
      input.sessionId,
      input.projectId,
      input.agentType,
      input.agentModel ?? null,
      now,
      input.workingDir,
      input.transcriptPath ?? null,
      input.branch ?? null,
      input.commitSha ?? null,
      input.workflowId ?? null,
      teamId,
    );
}

/** Mark a session as ended. Idempotent — keeps the earliest non-null end. */
export function endSession(
  raw: Database.Database,
  sessionId: string,
  ts: number = Date.now(),
): void {
  raw
    .prepare(
      `UPDATE sessions
          SET ended_at = COALESCE(ended_at, ?)
        WHERE session_id = ?`,
    )
    .run(ts, sessionId);
}

export interface RecordPromptInput {
  readonly sessionId: string;
  readonly text: string;
}

export interface RecordPromptResult {
  readonly promptId: number;
  readonly turnNo: number;
}

/**
 * Insert a row in `prompts`. The next turn_no is derived as
 * `MAX(turn_no) + 1` for the session — starting at 1.
 */
export function recordPrompt(raw: Database.Database, input: RecordPromptInput): RecordPromptResult {
  const row = raw
    .prepare(`SELECT COALESCE(MAX(turn_no), 0) + 1 AS next_turn FROM prompts WHERE session_id = ?`)
    .get(input.sessionId) as { next_turn: number };
  const turnNo = row.next_turn;
  const result = raw
    .prepare(
      `INSERT INTO prompts(session_id, turn_no, ts, text, char_count)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.sessionId, turnNo, Date.now(), input.text, input.text.length);
  return { promptId: Number(result.lastInsertRowid), turnNo };
}

export interface OpenTurnInput {
  readonly sessionId: string;
  readonly promptId: number;
  readonly turnNo: number;
}

/**
 * Insert a row in `turns` with no agent_text yet. The Stop hook updates
 * `agent_text` and `duration_ms` once the agent has finished.
 */
export function openTurn(raw: Database.Database, input: OpenTurnInput): number {
  const result = raw
    .prepare(
      `INSERT INTO turns(session_id, turn_no, ts, agent_text, duration_ms, prompt_id)
       VALUES (?, ?, ?, NULL, NULL, ?)`,
    )
    .run(input.sessionId, input.turnNo, Date.now(), input.promptId);
  return Number(result.lastInsertRowid);
}

/**
 * Find the turn_id for the most recent turn in a session — used by the
 * Stop hook + PostToolUse hook to attach data to the in-flight turn.
 * Returns null when the session has no turns yet (UserPromptSubmit hook
 * has not run).
 */
export function latestTurnId(raw: Database.Database, sessionId: string): number | null {
  const row = raw
    .prepare(`SELECT turn_id FROM turns WHERE session_id = ? ORDER BY turn_id DESC LIMIT 1`)
    .get(sessionId) as { turn_id?: number } | undefined;
  return row?.turn_id ?? null;
}

export interface CloseTurnInput {
  readonly turnId: number;
  readonly agentText?: string;
  /** Wall-clock duration in ms from openTurn to the Stop hook firing. */
  readonly durationMs?: number;
}

/**
 * Update an in-flight turn with the agent's response text + duration.
 * Also bumps `sessions.total_turns` so dashboards can read it cheaply.
 */
export function closeTurn(raw: Database.Database, input: CloseTurnInput): void {
  raw
    .prepare(
      `UPDATE turns
          SET agent_text  = COALESCE(?, agent_text),
              duration_ms = COALESCE(?, duration_ms)
        WHERE turn_id = ?`,
    )
    .run(input.agentText ?? null, input.durationMs ?? null, input.turnId);

  // Bump total_turns. We re-derive from rowcount instead of incrementing so
  // the value stays correct even if hooks fire out of order.
  raw
    .prepare(
      `UPDATE sessions
          SET total_turns = (SELECT COUNT(*) FROM turns WHERE session_id = sessions.session_id)
        WHERE session_id = (SELECT session_id FROM turns WHERE turn_id = ?)`,
    )
    .run(input.turnId);
}

export interface RecordToolCallInput {
  readonly sessionId: string;
  readonly turnId: number;
  readonly toolName: string;
  readonly input: unknown;
  readonly outputSummary?: string;
  readonly durationMs?: number;
  readonly status: "ok" | "error" | "blocked";
  readonly error?: string;
}

export function recordToolCall(raw: Database.Database, input: RecordToolCallInput): number {
  const result = raw
    .prepare(
      `INSERT INTO tool_calls(session_id, turn_id, ts, tool_name, input_json,
                              output_summary, duration_ms, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.turnId,
      Date.now(),
      input.toolName,
      JSON.stringify(input.input ?? null),
      input.outputSummary ?? null,
      input.durationMs ?? null,
      input.status,
      input.error ?? null,
    );
  return Number(result.lastInsertRowid);
}

export interface RecordArtifactUsageInput {
  readonly sessionId: string;
  readonly turnId?: number;
  readonly artifactType: CapturedArtifactType;
  readonly artifactName: string;
  /** invoked | completed | failed | skipped */
  readonly event: string;
  readonly outcome?: string;
  readonly durationMs?: number;
}

export function recordArtifactUsage(
  raw: Database.Database,
  input: RecordArtifactUsageInput,
): number {
  const result = raw
    .prepare(
      `INSERT INTO artifacts_used(session_id, turn_id, ts, artifact_type, artifact_name,
                                  event, outcome, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sessionId,
      input.turnId ?? null,
      Date.now(),
      input.artifactType,
      input.artifactName,
      input.event,
      input.outcome ?? null,
      input.durationMs ?? null,
    );
  return Number(result.lastInsertRowid);
}

/**
 * After captures are persisted, bump the cached counter on sessions so
 * dashboards do not have to count every time. Idempotent: re-derives from
 * the captures table.
 */
export function refreshCaptureCount(raw: Database.Database, sessionId: string): void {
  raw
    .prepare(
      `UPDATE sessions
          SET total_capture_count = (SELECT COUNT(*) FROM captures WHERE session_id = ?)
        WHERE session_id = ?`,
    )
    .run(sessionId, sessionId);
}
