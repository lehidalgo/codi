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
import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";

// ─── 9 capture / observability tables ───────────────────────────────────────

export const projects = sqliteTable("projects", {
  projectId: text("project_id").primaryKey(),
  repoPath: text("repo_path").notNull(),
  gitRemote: text("git_remote"),
  name: text("name").notNull(),
  firstSeen: integer("first_seen").notNull(),
  lastSeen: integer("last_seen").notNull(),
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
  },
  (t) => ({
    idxProjectStarted: index("idx_sessions_project_started").on(t.projectId, t.startedAt),
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
  },
  (t) => ({
    idxTypeSession: index("idx_captures_type_session").on(t.type, t.sessionId),
    idxSessionTs: index("idx_captures_session_ts").on(t.sessionId, t.ts),
    idxDeletedAt: index("idx_captures_deleted_at").on(t.deletedAt),
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

export const corrections = sqliteTable("corrections", {
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
});

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

export const codiSchemaVersion = sqliteTable(
  "_codi_schema_version",
  {
    version: integer("version").notNull(),
    appliedAt: integer("applied_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.version] }),
  }),
);

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
  },
  (t) => ({
    idxProjectStatus: index("idx_workflow_runs_project_status").on(t.projectId, t.status),
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
