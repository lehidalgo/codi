/**
 * HTMX pages for the brain-ui server (Sprint 4).
 *
 * Minimal HTML + Tailwind via CDN. Server-rendered + HTMX for partial
 * updates. The pages target the same API endpoints registered in
 * routes-api.ts; they exist for human inspection of the brain DB during
 * development. Sprint 5 adds /proposals; Sprint 6 polishes styling.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "../brain/index.js";

const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const HTMX_CDN = "https://unpkg.com/htmx.org@2.0.4";

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — codi brain-ui</title>
    <script src="${TAILWIND_CDN}"></script>
    <script src="${HTMX_CDN}" defer></script>
  </head>
  <body class="bg-slate-50 text-slate-900 font-sans">
    <header class="border-b border-slate-200 bg-white">
      <nav class="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6 text-sm">
        <a href="/" class="font-semibold">codi brain-ui</a>
        <a href="/" class="hover:underline">Sessions</a>
        <a href="/live" class="hover:underline">Live</a>
        <a href="/workflows" class="hover:underline">Workflows</a>
        <a href="/findings" class="hover:underline text-slate-500">Findings (Sprint 5)</a>
      </nav>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">${body}</main>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SessionRow {
  session_id: string;
  project_id: string;
  agent_type: string;
  started_at: number;
  total_capture_count: number | null;
}

interface CaptureRow {
  capture_id: number;
  ts: number;
  type: string;
  content: string;
}

interface WorkflowRow {
  workflow_id: string;
  type: string;
  current_phase: string;
  status: string;
  started_at: number;
}

export function registerPages(app: Hono, brain: BrainHandle): void {
  app.get("/", (c: Context) => {
    const rows = brain.raw
      .prepare(
        `SELECT session_id, project_id, agent_type, started_at, total_capture_count
         FROM sessions
         ORDER BY started_at DESC
         LIMIT 20`,
      )
      .all() as SessionRow[];
    const body = `
      <h1 class="text-xl font-semibold mb-4">Recent sessions</h1>
      ${rows.length === 0 ? '<p class="text-slate-500">No sessions yet.</p>' : ""}
      <table class="w-full text-sm border-collapse">
        <thead class="bg-slate-100 text-left">
          <tr>
            <th class="px-3 py-2">Session</th>
            <th class="px-3 py-2">Project</th>
            <th class="px-3 py-2">Agent</th>
            <th class="px-3 py-2">Started</th>
            <th class="px-3 py-2 text-right">Captures</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr class="border-t border-slate-200 hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs"><a class="hover:underline" href="/session/${escapeHtml(r.session_id)}">${escapeHtml(r.session_id)}</a></td>
              <td class="px-3 py-2">${escapeHtml(r.project_id)}</td>
              <td class="px-3 py-2">${escapeHtml(r.agent_type)}</td>
              <td class="px-3 py-2">${new Date(r.started_at).toISOString()}</td>
              <td class="px-3 py-2 text-right">${r.total_capture_count ?? 0}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    return c.html(shell("Sessions", body));
  });

  app.get("/session/:id", (c: Context) => {
    const id = c.req.param("id") ?? "";
    if (!id) return c.html(shell("Bad request", "<p>Missing session id.</p>"), 400);
    const session = brain.raw.prepare(`SELECT * FROM sessions WHERE session_id = ?`).get(id) as
      | SessionRow
      | undefined;
    if (!session) return c.html(shell("Not found", "<p>Session not found.</p>"), 404);
    const captures = brain.raw
      .prepare(
        `SELECT capture_id, ts, type, content FROM captures WHERE session_id = ? ORDER BY ts DESC LIMIT 100`,
      )
      .all(id) as CaptureRow[];
    const body = `
      <h1 class="text-xl font-semibold mb-1">Session ${escapeHtml(id)}</h1>
      <p class="text-sm text-slate-500 mb-4">${escapeHtml(session.agent_type)} — started ${new Date(
        session.started_at,
      ).toISOString()}</p>
      <h2 class="text-lg font-semibold mb-2">Captures (${captures.length})</h2>
      ${captures.length === 0 ? '<p class="text-slate-500">No captures recorded.</p>' : ""}
      <ul class="space-y-2">
        ${captures
          .map(
            (cap) => `
          <li class="rounded border border-slate-200 bg-white p-3 text-sm">
            <span class="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-mono">${escapeHtml(cap.type)}</span>
            <span class="ml-2 text-slate-500 text-xs">${new Date(cap.ts).toISOString()}</span>
            <p class="mt-1">${escapeHtml(cap.content)}</p>
          </li>`,
          )
          .join("")}
      </ul>`;
    return c.html(shell(`Session ${id}`, body));
  });

  app.get("/live", (c: Context) => {
    const body = `
      <h1 class="text-xl font-semibold mb-4">Live captures</h1>
      <p class="text-sm text-slate-500 mb-4">Polling every 2s. Most recent 50 markers across all sessions.</p>
      <div hx-get="/partials/live-captures" hx-trigger="load, every 2s" hx-target="this" hx-swap="innerHTML">
        <p class="text-slate-400">Loading…</p>
      </div>`;
    return c.html(shell("Live", body));
  });

  app.get("/partials/live-captures", (c: Context) => {
    const rows = brain.raw
      .prepare(
        `SELECT c.capture_id, c.ts, c.type, c.content, c.session_id
         FROM captures c
         ORDER BY c.ts DESC
         LIMIT 50`,
      )
      .all() as (CaptureRow & { session_id: string })[];
    return c.html(`
      <table class="w-full text-sm border-collapse">
        <thead class="bg-slate-100 text-left">
          <tr>
            <th class="px-3 py-2">Type</th>
            <th class="px-3 py-2">Session</th>
            <th class="px-3 py-2">When</th>
            <th class="px-3 py-2">Content</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr class="border-t border-slate-200">
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.type)}</td>
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.session_id)}</td>
              <td class="px-3 py-2 text-xs text-slate-500">${new Date(r.ts).toISOString()}</td>
              <td class="px-3 py-2">${escapeHtml(r.content)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`);
  });

  app.get("/workflows", (c: Context) => {
    const rows = brain.raw
      .prepare(
        `SELECT workflow_id, type, current_phase, status, started_at
         FROM workflow_runs
         ORDER BY started_at DESC
         LIMIT 50`,
      )
      .all() as WorkflowRow[];
    const body = `
      <h1 class="text-xl font-semibold mb-4">Workflow runs</h1>
      ${rows.length === 0 ? '<p class="text-slate-500">No workflows recorded.</p>' : ""}
      <table class="w-full text-sm border-collapse">
        <thead class="bg-slate-100 text-left">
          <tr>
            <th class="px-3 py-2">ID</th>
            <th class="px-3 py-2">Type</th>
            <th class="px-3 py-2">Phase</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2">Started</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr class="border-t border-slate-200">
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.workflow_id)}</td>
              <td class="px-3 py-2">${escapeHtml(r.type)}</td>
              <td class="px-3 py-2">${escapeHtml(r.current_phase)}</td>
              <td class="px-3 py-2">${escapeHtml(r.status)}</td>
              <td class="px-3 py-2">${new Date(r.started_at).toISOString()}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    return c.html(shell("Workflows", body));
  });

  app.get("/findings", (c: Context) => {
    const body = `
      <h1 class="text-xl font-semibold mb-4">Findings</h1>
      <div class="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Consolidation pipeline is Sprint 5 work. This page will list pattern-detection proposals (PROMOTE_TO_RULE, MERGE_SIMILAR, etc.) once the consolidator is wired in.
      </div>`;
    return c.html(shell("Findings", body));
  });
}
