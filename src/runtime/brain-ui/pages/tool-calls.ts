/**
 * Tool calls telemetry. List + filter by tool / status; aggregate top tools
 * and error rate at the top so the dev sees signal without scrolling.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { shell, escapeHtml, fmtRelative, fmtTs, fmtDuration } from "./shell.js";

interface ToolCallRow {
  readonly call_id: number;
  readonly session_id: string;
  readonly turn_id: number;
  readonly ts: number;
  readonly tool_name: string;
  readonly output_summary: string | null;
  readonly duration_ms: number | null;
  readonly status: string;
  readonly error: string | null;
}

interface ToolAgg {
  readonly tool_name: string;
  readonly n: number;
  readonly errors: number;
  readonly avg_ms: number | null;
}

export function registerToolCalls(app: Hono, brain: BrainHandle): void {
  app.get("/tool-calls", (c: Context) => {
    const tool = c.req.query("tool") ?? null;
    const status = c.req.query("status") ?? null;
    const limit = Math.min(500, Math.max(20, Number(c.req.query("limit") ?? "100")));

    const where: string[] = [];
    const params: unknown[] = [];
    if (tool) {
      where.push("tool_name = ?");
      params.push(tool);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const rows = brain.raw
      .prepare(
        `SELECT call_id, session_id, turn_id, ts, tool_name, output_summary,
                duration_ms, status, error
         FROM tool_calls
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY ts DESC LIMIT ?`,
      )
      .all(...params, limit) as ToolCallRow[];

    const aggs = brain.raw
      .prepare(
        `SELECT tool_name, COUNT(*) as n,
                SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) as errors,
                AVG(duration_ms) as avg_ms
         FROM tool_calls
         GROUP BY tool_name
         ORDER BY n DESC LIMIT 12`,
      )
      .all() as ToolAgg[];

    const distinctTools = brain.raw
      .prepare(`SELECT DISTINCT tool_name FROM tool_calls ORDER BY tool_name`)
      .all() as Array<{ tool_name: string }>;
    const distinctStatus = brain.raw
      .prepare(`SELECT DISTINCT status FROM tool_calls ORDER BY status`)
      .all() as Array<{ status: string }>;

    const toolOpts = [`<option value="">All tools</option>`]
      .concat(
        distinctTools.map(
          (t) =>
            `<option value="${t.tool_name}" ${tool === t.tool_name ? "selected" : ""}>${escapeHtml(t.tool_name)}</option>`,
        ),
      )
      .join("");
    const statusOpts = [`<option value="">All statuses</option>`]
      .concat(
        distinctStatus.map(
          (s) =>
            `<option value="${s.status}" ${status === s.status ? "selected" : ""}>${escapeHtml(s.status)}</option>`,
        ),
      )
      .join("");

    const aggHtml = aggs
      .map((a) => {
        const errPct = a.n > 0 ? ((a.errors / a.n) * 100).toFixed(1) : "0";
        return `
        <li class="flex items-center gap-3 text-sm">
          <span class="font-mono text-xs w-32 shrink-0 truncate" title="${escapeHtml(a.tool_name)}">${escapeHtml(a.tool_name)}</span>
          <span class="tabular-nums w-12 text-right">${a.n}</span>
          <span class="tabular-nums w-14 text-right ${a.errors > 0 ? "text-rose-700" : "text-slate-400"}">${a.errors} (${errPct}%)</span>
          <span class="tabular-nums text-slate-500 w-16 text-right">${a.avg_ms ? fmtDuration(Math.round(a.avg_ms)) : "—"}</span>
        </li>`;
      })
      .join("");

    const rowHtml = rows
      .map((r) => {
        const statusBadge =
          r.status === "ok"
            ? `<span class="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ok</span>`
            : `<span class="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">${escapeHtml(r.status)}</span>`;
        return `
        <li class="rounded border border-slate-200 bg-white p-3 text-sm">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs">${escapeHtml(r.tool_name)}</span>
              ${statusBadge}
              <span class="text-xs text-slate-500">${fmtDuration(r.duration_ms)}</span>
            </div>
            <span class="text-xs text-slate-400" title="${fmtTs(r.ts)}">${fmtRelative(r.ts)}</span>
          </div>
          ${r.output_summary ? `<p class="text-slate-700 break-words">${escapeHtml(r.output_summary.slice(0, 220))}${r.output_summary.length > 220 ? "…" : ""}</p>` : ""}
          ${r.error ? `<pre class="mt-2 text-xs text-rose-800 bg-rose-50 p-2 rounded overflow-x-auto">${escapeHtml(r.error)}</pre>` : ""}
          <p class="mt-1 text-xs font-mono text-slate-400">session ${escapeHtml(r.session_id)} · turn ${r.turn_id} · #${r.call_id}</p>
        </li>`;
      })
      .join("");

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Tool calls</h1>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">By tool</h2>
        <div class="grid grid-cols-4 text-xs uppercase text-slate-500 mb-1 px-3">
          <span>tool</span><span class="text-right">count</span><span class="text-right">errors</span><span class="text-right">avg</span>
        </div>
        <ul class="space-y-1.5 px-3">${aggHtml || '<li class="text-sm text-slate-500">No tool calls.</li>'}</ul>
      </section>
      <form method="get" class="flex flex-wrap gap-2 mb-3">
        <select name="tool" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${toolOpts}</select>
        <select name="status" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${statusOpts}</select>
        <button class="rounded bg-slate-900 text-white px-3 py-1.5 text-sm">Filter</button>
        <a href="/tool-calls" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">Reset</a>
      </form>
      <p class="text-xs text-slate-500 mb-3">Showing ${rows.length} of up to ${limit} rows.</p>
      <ul class="space-y-2">${rowHtml || '<li class="text-sm text-slate-500">No tool calls.</li>'}</ul>`;
    return c.html(shell({ title: "Tool calls", active: "/tool-calls" }, body));
  });
}
