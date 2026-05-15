/**
 * Codi v3 brain — SQLite schema (11 canonical tables).
 *
 * Source of truth: master plan §4.2. SQLite is canonical in zero mode;
 * Postgres in lite/standard/full preserves the same shape (Z6.D).
 *
 * FTS5 virtual tables and the vec0 vector index live in a separate raw-SQL
 * migration (drizzle-orm does not generate FTS5/vec0 syntax natively).
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ─── 9 capture / observability tables ───────────────────────────────────────

export const projects = sqliteTable("projects", {
  projectId: text("project_id").primaryKey(),
  repoPath: text("repo_path").notNull(),
  gitRemote: text("git_remote"),
  name: text("name").notNull(),
  firstSeen: integer("first_seen").notNull(),
  lastSeen: integer("last_seen").notNull(),
  // v7 — git identity + host context columns (ALTER TABLE in migrate.ts:257-260).
  gitUserName: text("git_user_name"),
  gitUserEmail: text("git_user_email"),
  hostUser: text("host_user"),
  hostMachine: text("host_machine"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    sessionId: text("session_id").primaryKey(),
    projectId: text("project_id").notNull(),
    agentType: text("agent_type").notNull(),
    agentModel: text("agent_model"),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    branch: text("branch"),
    commitSha: text("commit_sha"),
    workingDir: text("working_dir").notNull(),
    transcriptPath: text("transcript_path"),
    workflowId: text("workflow_id"),
    totalTurns: integer("total_turns").default(0),
    totalCaptureCount: integer("total_capture_count").default(0),
    // v4 — session-level token accounting (ALTER TABLE migrate.ts:215-222).
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    tokensCacheCreate: integer("tokens_cache_create"),
    tokensCacheRead: integer("tokens_cache_read"),
    tokensPreloaded: integer("tokens_preloaded"),
    costUsd: real("cost_usd"),
    contextWindow: integer("context_window"),
    tokensEstimated: integer("tokens_estimated"),
    // v5 — workflow context-rebuild ceiling (migrate.ts:236).
    tokensMaxPrefix: integer("tokens_max_prefix"),
    // v6 — Claude Code messages count delta (migrate.ts:247).
    tokensMessagesCount: integer("tokens_messages_count"),
    // ISSUE-053 — cross-team aggregation key (ADR-005). NULL = solo / untagged.
    teamId: text("team_id"),
  },
  (t) => ({
    idxProjectStarted: index("idx_sessions_project_started").on(t.projectId, t.startedAt),
    idxTeamStarted: index("idx_sessions_team_started").on(t.teamId, t.startedAt),
  }),
);

export const prompts = sqliteTable(
  "prompts",
  {
    promptId: integer("prompt_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    turnNo: integer("turn_no").notNull(),
    ts: integer("ts").notNull(),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
  },
  (t) => ({
    idxSessionTurn: index("idx_prompts_session_turn").on(t.sessionId, t.turnNo),
    // BOOTSTRAP at migrate.ts:138 — DESC ordering encoded in raw SQL but
    // not modelled here (drizzle-orm/sqlite-core has no `.desc()` builder
    // on index columns prior to v0.50). PRAGMA index_info reports column
    // ordinals only, so the alignment guard accepts equal column lists.
    idxSessionPidDesc: index("idx_prompts_session_pid_desc").on(t.sessionId, t.promptId),
  }),
);

export const turns = sqliteTable("turns", {
  turnId: integer("turn_id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  turnNo: integer("turn_no").notNull(),
  ts: integer("ts").notNull(),
  agentText: text("agent_text"), // populated only when trace_level=full
  durationMs: integer("duration_ms"),
  promptId: integer("prompt_id").notNull(),
  // v4 — per-turn token attribution (ALTER TABLE migrate.ts:223-226).
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  tokensCacheCreate: integer("tokens_cache_create"),
  tokensCacheRead: integer("tokens_cache_read"),
});

export const captures = sqliteTable(
  "captures",
  {
    captureId: integer("capture_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    promptId: integer("prompt_id").notNull(),
    turnId: integer("turn_id").notNull(),
    ts: integer("ts").notNull(),
    type: text("type").notNull(), // 10 capture types per Iron Law 9
    content: text("content").notNull(),
    rawMarker: text("raw_marker").notNull(),
    filePaths: text("file_paths"), // JSON array
    workflowId: text("workflow_id"),
    phase: text("phase"),
    deletedAt: integer("deleted_at"), // soft delete; null = visible
    // ISSUE-053 — cross-team aggregation key (ADR-005). NULL = solo / untagged.
    teamId: text("team_id"),
  },
  (t) => ({
    idxTypeSession: index("idx_captures_type_session").on(t.type, t.sessionId),
    idxSessionTs: index("idx_captures_session_ts").on(t.sessionId, t.ts),
    idxDeletedAt: index("idx_captures_deleted_at").on(t.deletedAt),
    idxTeamTs: index("idx_captures_team_ts").on(t.teamId, t.ts),
    // BOOTSTRAP migrate.ts:136 — speeds up the (turn_id, raw_marker)
    // dedupe at marker persist time (persist.ts:46-52).
    idxTurnMarker: index("idx_captures_turn_marker").on(t.turnId, t.rawMarker),
  }),
);

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    callId: integer("call_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    turnId: integer("turn_id").notNull(),
    ts: integer("ts").notNull(),
    toolName: text("tool_name").notNull(),
    inputJson: text("input_json").notNull(),
    outputSummary: text("output_summary"),
    durationMs: integer("duration_ms"),
    status: text("status").notNull(),
    error: text("error"),
  },
  (t) => ({
    idxSessionTurn: index("idx_tool_calls_session_turn").on(t.sessionId, t.turnId),
  }),
);

export const corrections = sqliteTable(
  "corrections",
  {
    correctionId: integer("correction_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    ts: integer("ts").notNull(),
    filePath: text("file_path").notNull(),
    diffSummary: text("diff_summary").notNull(),
    sourceTurnId: integer("source_turn_id"),
    detectedVia: text("detected_via").notNull(),
    // ISSUE-049 — JSON-encoded string[] of artifact_name snapshot at the
    // exact turn this correction was captured. Populated by
    // recordCorrectionFromMarker at write-time so attribution is causal,
    // not temporal-overlap inferred via a VIEW.
    linkedArtifacts: text("linked_artifacts"),
    // ISSUE-052 / v14 — actor identity for cross-team aggregation
    // (ALTER TABLE migrate.ts:406).
    actorId: text("actor_id"),
  },
  (t) => ({
    // v12 — session+turn lookup for the captures-side dedupe queries.
    idxSessionTurn: index("idx_corrections_session_turn").on(t.sessionId, t.sourceTurnId),
    // v14 — actor leaderboard / per-team aggregation.
    idxActor: index("idx_corrections_actor").on(t.actorId),
  }),
);

export const artifactsUsed = sqliteTable(
  "artifacts_used",
  {
    usageId: integer("usage_id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull(),
    turnId: integer("turn_id"),
    ts: integer("ts").notNull(),
    artifactType: text("artifact_type").notNull(),
    artifactName: text("artifact_name").notNull(),
    event: text("event").notNull(),
    outcome: text("outcome"),
    durationMs: integer("duration_ms"),
  },
  (t) => ({
    idxNameOutcome: index("idx_artifacts_used_name_outcome").on(t.artifactName, t.outcome),
  }),
);

// ISSUE-050 — eval_runs persists every execution of an `evals.json`
// case, keyed by (project_id, skill_name, ts). Populated by the brain
// CLI subcommand `codi brain record-eval-run` so the eval harness
// (currently `dev-skill-creator/scripts/ts/run-eval.ts`) stays
// decoupled from the runtime layer.
export const evalRuns = sqliteTable(
  "eval_runs",
  {
    runId: integer("run_id").primaryKey({ autoIncrement: true }),
    ts: integer("ts").notNull(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id"),
    skillName: text("skill_name").notNull(),
    skillVersion: text("skill_version"),
    caseId: text("case_id").notNull(),
    passed: integer("passed").notNull(),
    triggerRate: real("trigger_rate"),
    runs: integer("runs").notNull().default(1),
    triggers: integer("triggers"),
    model: text("model"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    triggerSource: text("trigger_source").notNull(),
    metadata: text("metadata"),
  },
  (t) => ({
    idxSkillTs: index("idx_eval_runs_skill_ts").on(t.skillName, t.ts),
    idxProjectSkill: index("idx_eval_runs_project_skill").on(t.projectId, t.skillName),
  }),
);

export const codiSchemaVersion = sqliteTable("_codi_schema_version", {
  // INTEGER PRIMARY KEY (inline, not composite) so the column becomes
  // a rowid alias — matches the BOOTSTRAP form at migrate.ts:107.
  // Composite primaryKey() would mark the column NOT NULL and lose the
  // rowid alias semantics.
  version: integer("version").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
});

// ─── 2 workflow runtime tables ──────────────────────────────────────────────

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    workflowId: text("workflow_id").primaryKey(),
    projectId: text("project_id").notNull(),
    type: text("type").notNull(), // project | feature | bug-fix | refactor | migration
    currentPhase: text("current_phase").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    metadata: text("metadata"), // JSON: scope_files, gates_passed, flags
    // ISSUE-053 — cross-team aggregation key (ADR-005). NULL = solo / untagged.
    teamId: text("team_id"),
  },
  (t) => ({
    idxProjectStatus: index("idx_workflow_runs_project_status").on(t.projectId, t.status),
    idxTeamStatus: index("idx_workflow_runs_team_status").on(t.teamId, t.status),
    // BOOTSTRAP migrate.ts:137 — accelerates "active workflows newest-first"
    // queries used by `codi workflow status` and brain-UI.
    idxStatusStarted: index("idx_workflow_runs_status_started").on(t.status, t.startedAt),
  }),
);

export const workflowEvents = sqliteTable(
  "workflow_events",
  {
    eventId: integer("event_id").primaryKey({ autoIncrement: true }),
    workflowId: text("workflow_id").notNull(),
    eventType: text("event_type").notNull(),
    ts: integer("ts").notNull(),
    payload: text("payload"),
  },
  (t) => ({
    idxWfTs: index("idx_workflow_events_wf_ts").on(t.workflowId, t.ts),
  }),
);

// Workflow definitions (added in schema v2). Phases / gates / transitions /
// flags per workflow type, seeded from src/templates/workflows/*.yaml.
// `definition` is the JSON blob source of truth (F1 shape).
export const workflowDefinitions = sqliteTable(
  "workflow_definitions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    version: integer("version").notNull(),
    managedBy: text("managed_by").notNull(), // 'codi' | 'user'
    definition: text("definition").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    idxManagedBy: index("idx_workflow_definitions_managed_by").on(t.managedBy),
  }),
);

/**
 * CORE-005 — Drizzle model for the `runtime_state` KV table created by v11
 * ALTER (`migrate.ts:314-317`). Previously this table lived only in raw SQL,
 * causing schema drift the alignment guard now catches.
 *
 * Backing for `getCodiSession() / setCodiSession()` and other singleton
 * KV-shaped persistence inside the brain. Per ISSUE-037, this is the
 * post-v11 home for what used to live as a special row in `workflow_runs`.
 */
export const runtimeState = sqliteTable("runtime_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Raw SQL for FTS5 + vec0 virtual tables — drizzle does not generate these.
// Applied by migrate.ts after the structural migration runs.
export const FTS5_AND_VEC_SQL = sql`
CREATE VIRTUAL TABLE IF NOT EXISTS captures_fts USING fts5(
  content,
  content='captures',
  content_rowid='capture_id'
);
CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
  text,
  content='prompts',
  content_rowid='prompt_id'
);
`;
