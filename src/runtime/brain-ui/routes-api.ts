/**
 * Read-only HTTP API for the brain DB (Sprint 4).
 *
 * Endpoints (per master plan §11):
 *   GET /api/v1/projects                       list known projects
 *   GET /api/v1/projects/:id/sessions          sessions for a project
 *   GET /api/v1/sessions/:id                   single session detail
 *   GET /api/v1/sessions/:id/captures          captures of a session (?type=&since=)
 *   GET /api/v1/sessions/:id/turns             turns of a session
 *   GET /api/v1/sessions/:id/tool-calls        tool_calls of a session
 *   GET /api/v1/captures/search                FTS5 search (?q=&limit=)
 *   GET /api/v1/workflows                      active workflow_runs
 *   GET /api/v1/workflows/:id/events           events of a workflow
 *
 * Sprint 5 will add /proposals, /redact, /consolidation/run-with-*.
 */

import type { Hono, Context } from "hono";
import path from "node:path";
import { homedir } from "node:os";
import type { BrainHandle } from "../brain/index.js";
import {
  listProposals,
  getProposal,
  decideProposal,
  generatePackage,
  runConsolidation,
  type ProposalStatus,
  type RunContext,
} from "../consolidate/index.js";
import { getProvider, LlmConfigError } from "../llm/index.js";
import { restoreBackup, restoreFromBackupDir } from "#src/core/backup/backup-manager.js";
import { PROJECT_DIR, EXTERNAL_ARCHIVE_DIR } from "#src/constants.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const VALID_PROPOSAL_STATUSES: readonly ProposalStatus[] = ["pending", "accepted", "rejected"];

export function registerApiRoutes(app: Hono, brain: BrainHandle): void {
  app.get("/api/v1/projects", (c: Context) => {
    const rows = brain.raw
      .prepare(
        `SELECT project_id, name, repo_path, git_remote, first_seen, last_seen
         FROM projects
         ORDER BY last_seen DESC
         LIMIT ?`,
      )
      .all(boundedLimit(c)) as unknown[];
    return c.json({ data: rows });
  });

  app.get("/api/v1/projects/:id/sessions", (c: Context) => {
    const projectId = c.req.param("id");
    const rows = brain.raw
      .prepare(
        `SELECT session_id, agent_type, agent_model, started_at, ended_at, branch,
                commit_sha, workflow_id, total_turns, total_capture_count
         FROM sessions
         WHERE project_id = ?
         ORDER BY started_at DESC
         LIMIT ?`,
      )
      .all(projectId, boundedLimit(c)) as unknown[];
    return c.json({ data: rows });
  });

  app.get("/api/v1/sessions/:id", (c: Context) => {
    const sessionId = c.req.param("id");
    const row = brain.raw.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(sessionId);
    if (!row) {
      return c.json({ error: { code: "not_found", message: "session not found" } }, 404);
    }
    return c.json({ data: row });
  });

  app.get("/api/v1/sessions/:id/captures", (c: Context) => {
    const sessionId = c.req.param("id");
    const type = c.req.query("type");
    const since = c.req.query("since");
    const includeTrashed = c.req.query("trash") === "1";
    const params: unknown[] = [sessionId];
    let where = "session_id = ?";
    if (!includeTrashed) where += " AND deleted_at IS NULL";
    if (type) {
      where += " AND type = ?";
      params.push(type);
    }
    if (since) {
      where += " AND ts >= ?";
      params.push(Number(since));
    }
    params.push(boundedLimit(c));
    const rows = brain.raw
      .prepare(
        `SELECT capture_id, ts, type, content, raw_marker, file_paths, workflow_id, phase, deleted_at
         FROM captures
         WHERE ${where}
         ORDER BY ts DESC
         LIMIT ?`,
      )
      .all(...params) as unknown[];
    return c.json({ data: rows });
  });

  app.get("/api/v1/sessions/:id/turns", (c: Context) => {
    const sessionId = c.req.param("id");
    const rows = brain.raw
      .prepare(
        `SELECT turn_id, turn_no, ts, duration_ms, prompt_id
         FROM turns
         WHERE session_id = ?
         ORDER BY turn_no ASC
         LIMIT ?`,
      )
      .all(sessionId, boundedLimit(c)) as unknown[];
    return c.json({ data: rows });
  });

  app.get("/api/v1/sessions/:id/tool-calls", (c: Context) => {
    const sessionId = c.req.param("id");
    const rows = brain.raw
      .prepare(
        `SELECT call_id, turn_id, ts, tool_name, status, duration_ms, error
         FROM tool_calls
         WHERE session_id = ?
         ORDER BY ts ASC
         LIMIT ?`,
      )
      .all(sessionId, boundedLimit(c)) as unknown[];
    return c.json({ data: rows });
  });

  app.get("/api/v1/captures/search", (c: Context) => {
    const q = c.req.query("q");
    if (!q || q.trim().length === 0) {
      return c.json({ error: { code: "missing_query", message: "?q= required" } }, 400);
    }
    const rows = brain.raw
      .prepare(
        `SELECT c.capture_id, c.session_id, c.ts, c.type, c.content,
                snippet(captures_fts, 0, '<mark>', '</mark>', '…', 12) AS snippet
         FROM captures_fts
           JOIN captures c ON c.capture_id = captures_fts.rowid
         WHERE captures_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
      )
      .all(q, boundedLimit(c)) as unknown[];
    return c.json({ data: rows, query: q });
  });

  app.get("/api/v1/workflows", (c: Context) => {
    const status = c.req.query("status");
    const rows = status
      ? (brain.raw
          .prepare(`SELECT * FROM workflow_runs WHERE status = ? ORDER BY started_at DESC LIMIT ?`)
          .all(status, boundedLimit(c)) as unknown[])
      : (brain.raw
          .prepare(`SELECT * FROM workflow_runs ORDER BY started_at DESC LIMIT ?`)
          .all(boundedLimit(c)) as unknown[]);
    return c.json({ data: rows });
  });

  app.get("/api/v1/workflows/:id/events", (c: Context) => {
    const workflowId = c.req.param("id");
    const rows = brain.raw
      .prepare(
        `SELECT event_id, event_type, ts, payload
         FROM workflow_events
         WHERE workflow_id = ?
         ORDER BY ts ASC
         LIMIT ?`,
      )
      .all(workflowId, boundedLimit(c)) as unknown[];
    return c.json({ data: rows });
  });

  // ─── Sprint 5 — proposals ────────────────────────────────────────────────

  app.get("/api/v1/proposals", (c: Context) => {
    const status = c.req.query("status");
    const filter =
      status && (VALID_PROPOSAL_STATUSES as readonly string[]).includes(status)
        ? (status as ProposalStatus)
        : undefined;
    const data = listProposals(brain.raw, {
      status: filter,
      limit: boundedLimit(c),
    });
    return c.json({ data });
  });

  app.get("/api/v1/proposals/:id", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id", message: "id must be a number" } }, 400);
    }
    const p = getProposal(brain.raw, id);
    if (!p) {
      return c.json({ error: { code: "not_found", message: "proposal not found" } }, 404);
    }
    return c.json({ data: p });
  });

  app.post("/api/v1/proposals/:id/accept", async (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id", message: "id must be a number" } }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
    const result = decideProposal(brain.raw, {
      proposalId: id,
      status: "accepted",
      reason: body.reason,
    });
    if (!result.ok && result.error === "not_found") {
      return c.json({ error: { code: "not_found", message: "proposal not found" } }, 404);
    }
    if (!result.ok && result.error === "already_decided") {
      return c.json(
        { error: { code: "already_decided", message: "proposal already decided" } },
        409,
      );
    }
    return c.json({ data: result.proposal });
  });

  app.post("/api/v1/proposals/:id/reject", async (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id", message: "id must be a number" } }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
    const result = decideProposal(brain.raw, {
      proposalId: id,
      status: "rejected",
      reason: body.reason,
    });
    if (!result.ok && result.error === "not_found") {
      return c.json({ error: { code: "not_found", message: "proposal not found" } }, 404);
    }
    if (!result.ok && result.error === "already_decided") {
      return c.json(
        { error: { code: "already_decided", message: "proposal already decided" } },
        409,
      );
    }
    return c.json({ data: result.proposal });
  });

  // ─── Stage 5 — package + consolidation runner (Sprint 5.b) ───────────────

  app.get("/api/v1/consolidation/package", (c: Context) => {
    const manifest = generatePackage(brain.raw);
    return c.json({ data: manifest });
  });

  app.post("/api/v1/consolidation/run", async (c: Context) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<RunContext>;
    const ctx: RunContext = {
      installedSkills: body.installedSkills ?? [],
      installedRules: body.installedRules ?? [],
      existingRuleKeywords: body.existingRuleKeywords ?? [],
      knownContradictions: body.knownContradictions,
      sinceTs: body.sinceTs,
      minEvidence: body.minEvidence,
    };
    const result = await runConsolidation(brain.raw, ctx);
    return c.json({ data: result });
  });

  // Mode A — agent-driven: server returns prompt+data; agent runs LLM
  // externally and POSTs back the structured response.
  app.post("/api/v1/consolidation/run-with-agent", async (c: Context) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<RunContext>;
    const ctx: RunContext = {
      installedSkills: body.installedSkills ?? [],
      installedRules: body.installedRules ?? [],
      existingRuleKeywords: body.existingRuleKeywords ?? [],
      sinceTs: body.sinceTs,
      minEvidence: body.minEvidence,
    };
    const result = await runConsolidation(brain.raw, ctx);
    return c.json({
      data: result,
      mode: "agent",
      next: "GET /api/v1/proposals?status=pending — review and POST accept/reject decisions",
    });
  });

  // Mode B — server-side LLM (Item 6): requires CODI_LLM_PROVIDER + the
  // matching API key env var. The selector throws LlmConfigError when no
  // key is configured; surfaced as 400 so the caller can fall back to
  // /run-with-agent without crashing.
  // ─── Captures CRUD (Sprint 1 — UI editor) ─────────────────────────────────

  app.get("/api/v1/captures/:id", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const row = brain.raw
      .prepare(
        `SELECT capture_id, session_id, prompt_id, turn_id, ts, type, content,
                raw_marker, file_paths, workflow_id, phase, deleted_at
         FROM captures WHERE capture_id = ?`,
      )
      .get(id) as unknown;
    if (!row) {
      return c.json({ error: { code: "not_found" } }, 404);
    }
    return c.json({ data: row });
  });

  app.patch("/api/v1/captures/:id", async (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      type?: string;
      content?: string;
    };
    const updates: string[] = [];
    const params: unknown[] = [];
    if (typeof body.type === "string" && body.type.length > 0) {
      updates.push("type = ?");
      params.push(body.type);
    }
    if (typeof body.content === "string") {
      updates.push("content = ?");
      params.push(body.content);
    }
    if (updates.length === 0) {
      return c.json({ error: { code: "no_fields" } }, 400);
    }
    params.push(id);
    const result = brain.raw
      .prepare(`UPDATE captures SET ${updates.join(", ")} WHERE capture_id = ?`)
      .run(...params);
    if (result.changes === 0) {
      return c.json({ error: { code: "not_found" } }, 404);
    }
    return c.json({ data: { updated: id } });
  });

  app.delete("/api/v1/captures/:id", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const result = brain.raw
      .prepare(`UPDATE captures SET deleted_at = ? WHERE capture_id = ? AND deleted_at IS NULL`)
      .run(Date.now(), id);
    if (result.changes === 0) {
      return c.json({ error: { code: "not_found_or_already_deleted" } }, 404);
    }
    // HTMX swap: empty body removes the element.
    return c.body("", 200, { "content-type": "text/html" });
  });

  app.post("/api/v1/captures/:id/restore", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const result = brain.raw
      .prepare(
        `UPDATE captures SET deleted_at = NULL WHERE capture_id = ? AND deleted_at IS NOT NULL`,
      )
      .run(id);
    if (result.changes === 0) {
      return c.json({ error: { code: "not_found_or_not_deleted" } }, 404);
    }
    return c.body("", 200, { "content-type": "text/html" });
  });

  app.post("/api/v1/captures/bulk-delete", async (c: Context) => {
    const body = (await c.req.json().catch(() => ({}))) as { ids?: number[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return c.json({ error: { code: "no_ids" } }, 400);
    }
    const placeholders = body.ids.map(() => "?").join(",");
    const result = brain.raw
      .prepare(
        `UPDATE captures SET deleted_at = ? WHERE capture_id IN (${placeholders}) AND deleted_at IS NULL`,
      )
      .run(Date.now(), ...body.ids);
    return c.json({ data: { deleted: result.changes } });
  });

  // ─── Proposals soft-delete (Sprint 1) ─────────────────────────────────────

  app.delete("/api/v1/proposals/:id", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const result = brain.raw
      .prepare(`UPDATE proposals SET deleted_at = ? WHERE proposal_id = ? AND deleted_at IS NULL`)
      .run(Date.now(), id);
    if (result.changes === 0) {
      return c.json({ error: { code: "not_found_or_already_deleted" } }, 404);
    }
    return c.body("", 200, { "content-type": "text/html" });
  });

  app.post("/api/v1/proposals/:id/restore", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.json({ error: { code: "bad_id" } }, 400);
    }
    const result = brain.raw
      .prepare(
        `UPDATE proposals SET deleted_at = NULL WHERE proposal_id = ? AND deleted_at IS NOT NULL`,
      )
      .run(id);
    if (result.changes === 0) {
      return c.json({ error: { code: "not_found_or_not_deleted" } }, 404);
    }
    return c.body("", 200, { "content-type": "text/html" });
  });

  // ─── Dashboard metrics + CSV export ───────────────────────────────────────

  app.get("/api/v1/dashboard/metrics", (c: Context) => {
    const count = (sql: string): number => (brain.raw.prepare(sql).get() as { n: number }).n;
    const types = brain.raw
      .prepare(`SELECT type, COUNT(*) as n FROM captures WHERE deleted_at IS NULL GROUP BY type`)
      .all() as Array<{ type: string; n: number }>;
    const tools = brain.raw
      .prepare(
        `SELECT tool_name, COUNT(*) as n FROM tool_calls GROUP BY tool_name ORDER BY n DESC LIMIT 10`,
      )
      .all() as Array<{ tool_name: string; n: number }>;
    return c.json({
      data: {
        sessions: count("SELECT COUNT(*) as n FROM sessions"),
        captures: count("SELECT COUNT(*) as n FROM captures WHERE deleted_at IS NULL"),
        captures_trashed: count("SELECT COUNT(*) as n FROM captures WHERE deleted_at IS NOT NULL"),
        tool_calls: count("SELECT COUNT(*) as n FROM tool_calls"),
        workflow_runs: count("SELECT COUNT(*) as n FROM workflow_runs"),
        proposals: count("SELECT COUNT(*) as n FROM proposals WHERE deleted_at IS NULL"),
        prompts: count("SELECT COUNT(*) as n FROM prompts"),
        turns: count("SELECT COUNT(*) as n FROM turns"),
        captures_by_type: types,
        top_tools: tools,
      },
    });
  });

  app.get("/api/v1/captures.csv", (c: Context) => {
    const includeTrashed = c.req.query("trash") === "1";
    const where = includeTrashed ? "deleted_at IS NOT NULL" : "deleted_at IS NULL";
    const rows = brain.raw
      .prepare(
        `SELECT capture_id, session_id, ts, type, content, file_paths, workflow_id, phase, deleted_at
         FROM captures WHERE ${where} ORDER BY ts DESC LIMIT 10000`,
      )
      .all() as Array<{
      capture_id: number;
      session_id: string;
      ts: number;
      type: string;
      content: string;
      file_paths: string | null;
      workflow_id: string | null;
      phase: string | null;
      deleted_at: number | null;
    }>;
    const header =
      "capture_id,session_id,ts,type,content,file_paths,workflow_id,phase,deleted_at\n";
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const body =
      header +
      rows
        .map((r) =>
          [
            r.capture_id,
            r.session_id,
            r.ts,
            r.type,
            r.content,
            r.file_paths ?? "",
            r.workflow_id ?? "",
            r.phase ?? "",
            r.deleted_at ?? "",
          ]
            .map(escape)
            .join(","),
        )
        .join("\n");
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="captures-${Date.now()}.csv"`,
      },
    });
  });

  // ─── Backup restore ────────────────────────────────────────────────────────

  app.post("/api/v1/backups/local/:ts/restore", async (c: Context) => {
    const ts = c.req.param("ts");
    const projectRoot = path.dirname(path.dirname(path.dirname(brain.path))); // .codi/state/brain.db → projectRoot
    const configDir = path.dirname(path.dirname(brain.path)); // .codi/state → .codi
    try {
      const restored = await restoreBackup(projectRoot, configDir, ts);
      return c.json({ data: { restored, count: restored.length } });
    } catch (cause) {
      return c.json({ error: { code: "restore_failed", message: String(cause) } }, 400);
    }
  });

  app.post("/api/v1/backups/archive/:hash/:ts/restore", async (c: Context) => {
    const hash = c.req.param("hash");
    const ts = c.req.param("ts");
    const projectRoot = path.dirname(path.dirname(path.dirname(brain.path)));
    const archiveDir = path.join(homedir(), PROJECT_DIR, EXTERNAL_ARCHIVE_DIR, hash, ts);
    try {
      const restored = await restoreFromBackupDir(projectRoot, archiveDir);
      return c.json({ data: { restored, count: restored.length } });
    } catch (cause) {
      return c.json({ error: { code: "restore_failed", message: String(cause) } }, 400);
    }
  });

  // ─── Server-side LLM consolidation (existing) ─────────────────────────────

  app.post("/api/v1/consolidation/run-with-llm", async (c: Context) => {
    let provider;
    try {
      provider = getProvider();
    } catch (e) {
      if (e instanceof LlmConfigError) {
        return c.json(
          {
            error: {
              code: "llm_not_configured",
              message: e.message,
              hint: "set CODI_LLM_PROVIDER + the matching API key, or POST /run-with-agent instead",
            },
          },
          400,
        );
      }
      throw e;
    }
    const body = (await c.req.json().catch(() => ({}))) as Partial<RunContext>;
    const ctx: RunContext = {
      installedSkills: body.installedSkills ?? [],
      installedRules: body.installedRules ?? [],
      existingRuleKeywords: body.existingRuleKeywords ?? [],
      knownContradictions: body.knownContradictions,
      sinceTs: body.sinceTs,
      minEvidence: body.minEvidence,
      llmProvider: provider,
      dryRun: body.dryRun,
    };
    const result = await runConsolidation(brain.raw, ctx);
    return c.json({
      data: result,
      mode: "llm",
      provider: provider.id,
      model: provider.defaultModel,
    });
  });
}

function boundedLimit(c: Context): number {
  const raw = c.req.query("limit");
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}
