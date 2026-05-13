/**
 * Artifacts usage telemetry. Aggregates `artifacts_used` by name + outcome
 * and lets the dev see which skill / rule / agent fires the most and how
 * often each succeeds.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { shell, escapeHtml, fmtRelative, fmtTs, fmtDuration } from "./shell.js";

interface AggRow {
  readonly artifact_type: string;
  readonly artifact_name: string;
  readonly n: number;
  readonly successes: number;
  readonly failures: number;
  readonly avg_ms: number | null;
}

interface UsageRow {
  readonly usage_id: number;
  readonly session_id: string;
  readonly turn_id: number | null;
  readonly ts: number;
  readonly artifact_type: string;
  readonly artifact_name: string;
  readonly event: string;
  readonly outcome: string | null;
  readonly duration_ms: number | null;
}

export function registerArtifacts(app: Hono, brain: BrainHandle): void {
  app.get("/artifacts", (c: Context) => {
    const aggs = brain.raw
      .prepare(
        `SELECT artifact_type, artifact_name,
                COUNT(*) as n,
                SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
                SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failures,
                AVG(duration_ms) as avg_ms
         FROM artifacts_used
         GROUP BY artifact_type, artifact_name
         ORDER BY n DESC LIMIT 100`,
      )
      .all() as AggRow[];

    const recent = brain.raw
      .prepare(
        `SELECT usage_id, session_id, turn_id, ts, artifact_type, artifact_name,
                event, outcome, duration_ms
         FROM artifacts_used
         ORDER BY ts DESC LIMIT 50`,
      )
      .all() as UsageRow[];

    const aggHtml = aggs
      .map((a) => {
        const successPct = a.n > 0 ? ((a.successes / a.n) * 100).toFixed(0) : "—";
        return `
        <tr class="border-t border-slate-200 hover:bg-slate-50">
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(a.artifact_type)}</td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(a.artifact_name)}</td>
          <td class="px-3 py-2 text-right tabular-nums">${a.n}</td>
          <td class="px-3 py-2 text-right tabular-nums text-emerald-700">${a.successes}</td>
          <td class="px-3 py-2 text-right tabular-nums ${a.failures > 0 ? "text-rose-700" : "text-slate-400"}">${a.failures}</td>
          <td class="px-3 py-2 text-right tabular-nums">${successPct}${successPct !== "—" ? "%" : ""}</td>
          <td class="px-3 py-2 text-right tabular-nums text-slate-500">${a.avg_ms ? fmtDuration(Math.round(a.avg_ms)) : "—"}</td>
        </tr>`;
      })
      .join("");

    const recentHtml = recent
      .map(
        (r) => `
        <li class="text-sm flex items-center gap-3">
          <span class="text-xs text-slate-400 w-24" title="${fmtTs(r.ts)}">${fmtRelative(r.ts)}</span>
          <span class="font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded">${escapeHtml(r.artifact_type)}</span>
          <span class="font-mono text-xs">${escapeHtml(r.artifact_name)}</span>
          <span class="text-xs text-slate-500">${escapeHtml(r.event)}</span>
          ${r.outcome ? `<span class="text-xs ${r.outcome === "success" ? "text-emerald-700" : "text-rose-700"}">${escapeHtml(r.outcome)}</span>` : ""}
        </li>`,
      )
      .join("");

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Artifacts usage</h1>
      ${
        aggs.length === 0
          ? `<div class="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 mb-5">
        <p class="font-semibold">artifacts_used is empty</p>
        <p class="mt-1">No skill / rule / agent invocation has been recorded yet. Adapter hooks must call <code>recordArtifactUsage</code> for this view to fill.</p>
      </div>`
          : ""
      }
      <section class="rounded-lg border border-slate-200 bg-white overflow-hidden mb-5">
        <h2 class="text-sm font-semibold px-4 py-3 bg-slate-50 border-b">Aggregate</h2>
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2">Type</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2 text-right">Total</th>
              <th class="px-3 py-2 text-right">OK</th>
              <th class="px-3 py-2 text-right">Fail</th>
              <th class="px-3 py-2 text-right">%</th>
              <th class="px-3 py-2 text-right">Avg</th>
            </tr>
          </thead>
          <tbody>${aggHtml || `<tr><td colspan="7" class="px-3 py-4 text-slate-500">No data.</td></tr>`}</tbody>
        </table>
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="text-sm font-semibold mb-3">Recent invocations</h2>
        <ul class="space-y-1.5">${recentHtml || '<li class="text-sm text-slate-500">No invocations.</li>'}</ul>
      </section>`;
    return c.html(shell({ title: "Artifacts", active: "/artifacts" }, body));
  });
}
