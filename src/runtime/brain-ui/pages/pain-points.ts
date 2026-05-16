/**
 * Pain-points dashboard widget (ISSUE-051).
 *
 * Renders the same ranked list `codi brain pain-points` returns, so the
 * dev can monitor recurring friction from the brain-ui without running a
 * CLI. Accepts `?since=7d|24h|30m` to scope the window.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { getPainPoints, parseSinceFlag } from "#src/runtime/brain/pain-points.js";
import { shell, escapeHtml, fmtRelative, fmtTs } from "./shell.js";

const SIGNAL_LABELS: Record<string, string> = {
  correction: "Correction",
  gate_failed: "Gate failed",
  capture_correction: "CORRECTION marker",
  capture_feedback: "FEEDBACK marker",
};

const SIGNAL_COLORS: Record<string, string> = {
  correction: "bg-rose-100 text-rose-800",
  gate_failed: "bg-amber-100 text-amber-800",
  capture_correction: "bg-fuchsia-100 text-fuchsia-800",
  capture_feedback: "bg-sky-100 text-sky-800",
};

export function registerPainPoints(app: Hono, brain: BrainHandle): void {
  app.get("/pain-points", (c: Context) => {
    const sinceFlag = c.req.query("since") ?? "7d";
    const limitFlag = c.req.query("limit") ?? "20";
    const since = parseSinceFlag(sinceFlag);
    const limit = Math.max(1, Number(limitFlag) || 20);

    const points = getPainPoints(brain.raw, since !== undefined ? { since, limit } : { limit });

    const rowsHtml = points
      .map((p) => {
        const label = SIGNAL_LABELS[p.signal] ?? p.signal;
        const color = SIGNAL_COLORS[p.signal] ?? "bg-slate-100 text-slate-800";
        return `
        <tr class="border-t border-slate-200 hover:bg-slate-50">
          <td class="px-3 py-2">
            <span class="inline-block text-xs font-medium px-2 py-0.5 rounded ${color}">${escapeHtml(label)}</span>
          </td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(p.bucket || "(empty)")}</td>
          <td class="px-3 py-2 text-right tabular-nums font-semibold">${p.hits}</td>
          <td class="px-3 py-2 text-right text-xs text-slate-500" title="${fmtTs(p.latestTs)}">${fmtRelative(p.latestTs)}</td>
        </tr>`;
      })
      .join("");

    const windowOptions = ["1d", "7d", "30d", "all"];
    const windowsHtml = windowOptions
      .map((w) => {
        const active = w === sinceFlag || (w === "all" && sinceFlag === "all");
        const href = w === "all" ? "/pain-points" : `/pain-points?since=${w}`;
        return `<a href="${href}" class="text-xs px-2 py-1 rounded ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}">${w}</a>`;
      })
      .join(" ");

    const body = `
      <div class="flex items-baseline justify-between mb-4">
        <h1 class="text-2xl font-semibold">Pain points</h1>
        <div class="flex gap-1.5">${windowsHtml}</div>
      </div>
      ${
        points.length === 0
          ? `<div class="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p class="font-semibold">No pain points in this window</p>
        <p class="mt-1">The brain has no recent corrections, failed gates, or negative captures. Widen the window or wait for more sessions.</p>
      </div>`
          : `<section class="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table class="w-full text-sm">
          <thead class="text-left text-xs uppercase text-slate-500">
            <tr>
              <th class="px-3 py-2">Signal</th>
              <th class="px-3 py-2">Bucket</th>
              <th class="px-3 py-2 text-right">Hits</th>
              <th class="px-3 py-2 text-right">Latest</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </section>`
      }`;
    return c.html(shell({ title: "Pain points", active: "/pain-points" }, body));
  });
}
