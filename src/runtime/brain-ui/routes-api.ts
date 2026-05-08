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
import type { BrainHandle } from "../brain/index.js";
import {
  listProposals,
  getProposal,
  decideProposal,
  type ProposalStatus,
} from "../consolidate/index.js";

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
    const params: unknown[] = [sessionId];
    let where = "session_id = ?";
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
        `SELECT capture_id, ts, type, content, raw_marker, file_paths, workflow_id, phase
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
}

function boundedLimit(c: Context): number {
  const raw = c.req.query("limit");
  const n = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}
