/**
 * Sessions list + detail page. Detail merges prompts / turns / tool_calls /
 * captures into a single chronological timeline so a dev can replay what
 * happened without joining tables manually.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { shell, escapeHtml, fmtRelative, fmtTs, fmtDuration } from "./shell.js";

interface SessionRow {
  readonly session_id: string;
  readonly project_id: string;
  readonly agent_type: string;
  readonly agent_model: string | null;
  readonly started_at: number;
  readonly ended_at: number | null;
  readonly branch: string | null;
  readonly commit_sha: string | null;
  readonly working_dir: string;
  readonly total_turns: number | null;
  readonly total_capture_count: number | null;
}

interface TimelineEvent {
  readonly ts: number;
  readonly kind: "prompt" | "turn" | "tool_call" | "capture";
  readonly text: string;
  readonly meta?: string;
  readonly type?: string;
  readonly status?: string;
}

function listSessions(brain: BrainHandle, agent: string | null): SessionRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (agent) {
    where.push("agent_type = ?");
    params.push(agent);
  }
  const sql = `SELECT * FROM sessions ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY started_at DESC LIMIT 100`;
  return brain.raw.prepare(sql).all(...params) as SessionRow[];
}

function loadSession(brain: BrainHandle, id: string): SessionRow | undefined {
  return brain.raw.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(id) as
    | SessionRow
    | undefined;
}

function loadTimeline(brain: BrainHandle, sessionId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const prompts = brain.raw
    .prepare(`SELECT ts, text FROM prompts WHERE session_id = ? ORDER BY ts ASC LIMIT 200`)
    .all(sessionId) as Array<{ ts: number; text: string }>;
  for (const p of prompts) events.push({ ts: p.ts, kind: "prompt", text: p.text });

  const turns = brain.raw
    .prepare(
      `SELECT ts, agent_text, duration_ms FROM turns WHERE session_id = ? ORDER BY ts ASC LIMIT 200`,
    )
    .all(sessionId) as Array<{ ts: number; agent_text: string | null; duration_ms: number | null }>;
  for (const t of turns) {
    events.push({
      ts: t.ts,
      kind: "turn",
      text: t.agent_text ?? "",
      meta: fmtDuration(t.duration_ms),
    });
  }

  const tools = brain.raw
    .prepare(
      `SELECT ts, tool_name, output_summary, status, duration_ms
       FROM tool_calls WHERE session_id = ? ORDER BY ts ASC LIMIT 500`,
    )
    .all(sessionId) as Array<{
    ts: number;
    tool_name: string;
    output_summary: string | null;
    status: string;
    duration_ms: number | null;
  }>;
  for (const tc of tools) {
    events.push({
      ts: tc.ts,
      kind: "tool_call",
      text: `${tc.tool_name}: ${tc.output_summary ?? ""}`,
      meta: fmtDuration(tc.duration_ms),
      status: tc.status,
    });
  }

  const captures = brain.raw
    .prepare(
      `SELECT ts, type, content FROM captures
       WHERE session_id = ? AND deleted_at IS NULL
       ORDER BY ts ASC LIMIT 500`,
    )
    .all(sessionId) as Array<{ ts: number; type: string; content: string }>;
  for (const cap of captures) {
    events.push({ ts: cap.ts, kind: "capture", text: cap.content, type: cap.type });
  }
  events.sort((a, b) => a.ts - b.ts);
  return events;
}

function renderTimelineEvent(ev: TimelineEvent): string {
  const dot = {
    prompt: "bg-sky-500",
    turn: "bg-slate-500",
    tool_call: "bg-emerald-500",
    capture: "bg-amber-500",
  }[ev.kind];
  const label = {
    prompt: "PROMPT",
    turn: "TURN",
    tool_call: "TOOL",
    capture: ev.type ?? "CAPTURE",
  }[ev.kind];
  const statusBadge =
    ev.status && ev.status !== "ok"
      ? ` <span class="ml-1 text-xs px-1 rounded ${ev.status === "error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}">${escapeHtml(ev.status)}</span>`
      : "";
  return `
    <li class="flex gap-3 text-sm">
      <span class="mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${dot}"></span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="text-xs font-mono text-slate-500">${escapeHtml(label)}</span>
          ${statusBadge}
          ${ev.meta ? `<span class="text-xs text-slate-400">${escapeHtml(ev.meta)}</span>` : ""}
          <span class="text-xs text-slate-400 ml-auto" title="${fmtTs(ev.ts)}">${fmtRelative(ev.ts)}</span>
        </div>
        <p class="text-slate-700 break-words whitespace-pre-wrap">${escapeHtml(ev.text.slice(0, 400))}${ev.text.length > 400 ? "…" : ""}</p>
      </div>
    </li>`;
}

export function registerSessions(app: Hono, brain: BrainHandle): void {
  app.get("/sessions", (c: Context) => {
    const agent = c.req.query("agent") ?? null;
    const rows = listSessions(brain, agent);
    const distinctAgents = brain.raw
      .prepare(`SELECT DISTINCT agent_type FROM sessions ORDER BY agent_type`)
      .all() as Array<{ agent_type: string }>;
    const opts = [`<option value="">All agents</option>`]
      .concat(
        distinctAgents.map(
          (a) =>
            `<option value="${a.agent_type}" ${agent === a.agent_type ? "selected" : ""}>${escapeHtml(a.agent_type)}</option>`,
        ),
      )
      .join("");

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Sessions</h1>
      <form method="get" class="flex gap-2 mb-4">
        <select name="agent" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${opts}</select>
        <button class="rounded bg-slate-900 text-white px-3 py-1.5 text-sm">Filter</button>
      </form>
      <table class="w-full text-sm border-collapse">
        <thead class="bg-slate-100 text-left">
          <tr>
            <th class="px-3 py-2">Session</th>
            <th class="px-3 py-2">Agent</th>
            <th class="px-3 py-2">Branch</th>
            <th class="px-3 py-2">Started</th>
            <th class="px-3 py-2 text-right">Turns</th>
            <th class="px-3 py-2 text-right">Captures</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr class="border-t border-slate-200 hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">
                <a class="hover:underline" href="/session/${escapeHtml(r.session_id)}">${escapeHtml(r.session_id.slice(0, 12))}…</a>
              </td>
              <td class="px-3 py-2">${escapeHtml(r.agent_type)}${r.agent_model ? ` <span class="text-xs text-slate-500">/${escapeHtml(r.agent_model)}</span>` : ""}</td>
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.branch ?? "—")}</td>
              <td class="px-3 py-2" title="${fmtTs(r.started_at)}">${fmtRelative(r.started_at)}</td>
              <td class="px-3 py-2 text-right tabular-nums">${r.total_turns ?? 0}</td>
              <td class="px-3 py-2 text-right tabular-nums">${r.total_capture_count ?? 0}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    return c.html(shell({ title: "Sessions", active: "/sessions" }, body));
  });

  app.get("/session/:id", (c: Context) => {
    const id = c.req.param("id") ?? "";
    if (!id)
      return c.html(
        shell({ title: "Bad request", active: "/sessions" }, "<p>Missing session id.</p>"),
        400,
      );
    const session = loadSession(brain, id);
    if (!session)
      return c.html(
        shell({ title: "Not found", active: "/sessions" }, "<p>Session not found.</p>"),
        404,
      );
    const timeline = loadTimeline(brain, id);

    const body = `
      <a class="text-xs text-slate-500 hover:underline" href="/sessions">← all sessions</a>
      <h1 class="text-2xl font-semibold mt-2 mb-1">Session <span class="font-mono text-base text-slate-600">${escapeHtml(id)}</span></h1>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Agent</p>
          <p class="font-mono">${escapeHtml(session.agent_type)}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Branch</p>
          <p class="font-mono">${escapeHtml(session.branch ?? "—")}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Started</p>
          <p class="font-mono text-xs" title="${fmtTs(session.started_at)}">${fmtRelative(session.started_at)}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Turns / Captures</p>
          <p class="tabular-nums">${session.total_turns ?? 0} / ${session.total_capture_count ?? 0}</p>
        </div>
      </div>
      <h2 class="text-lg font-semibold mb-2">Timeline (${timeline.length} events)</h2>
      <ul class="space-y-3 border-l-2 border-slate-200 pl-4">${timeline.map(renderTimelineEvent).join("")}</ul>`;
    return c.html(shell({ title: `Session ${id}`, active: "/sessions" }, body));
  });
}
