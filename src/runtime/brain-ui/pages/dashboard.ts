/**
 * Dashboard — overview of every brain table. Counts cards, captures-by-type
 * pie, tool-calls-by-tool top 10 bar, latest activity feed.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { shell, escapeHtml, fmtRelative } from "./shell.js";

interface CountRow {
  readonly label: string;
  readonly value: number | string;
  readonly href?: string;
  readonly muted?: boolean;
}

function fmtTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(0)}`;
}

function counts(brain: BrainHandle): CountRow[] {
  const c = (sql: string): number => {
    return (brain.raw.prepare(sql).get() as { n: number }).n;
  };
  const totals = brain.raw
    .prepare(
      `SELECT
         COALESCE(SUM(tokens_input + tokens_output + tokens_cache_create + tokens_cache_read), 0) AS total_tokens,
         COALESCE(SUM(cost_usd), 0) AS total_cost
       FROM sessions`,
    )
    .get() as { total_tokens: number; total_cost: number };
  return [
    { label: "Sessions", value: c("SELECT COUNT(*) as n FROM sessions"), href: "/sessions" },
    {
      label: "Captures",
      value: c("SELECT COUNT(*) as n FROM captures WHERE deleted_at IS NULL"),
      href: "/captures",
    },
    { label: "Tool calls", value: c("SELECT COUNT(*) as n FROM tool_calls"), href: "/tool-calls" },
    {
      label: "Workflows",
      value: c("SELECT COUNT(*) as n FROM workflow_runs"),
      href: "/workflows",
    },
    {
      label: "Proposals",
      value: c("SELECT COUNT(*) as n FROM proposals WHERE deleted_at IS NULL"),
      href: "/proposals",
    },
    { label: "Prompts", value: c("SELECT COUNT(*) as n FROM prompts"), muted: true },
    { label: "Turns", value: c("SELECT COUNT(*) as n FROM turns"), muted: true },
    {
      label: "Trash",
      value: c("SELECT COUNT(*) as n FROM captures WHERE deleted_at IS NOT NULL"),
      href: "/captures?trash=1",
      muted: true,
    },
    { label: "Tokens", value: fmtTokens(totals.total_tokens), href: "/sessions" },
    { label: "Cost", value: fmtUsd(totals.total_cost), href: "/sessions" },
  ];
}

interface TypeRow {
  readonly type: string;
  readonly n: number;
}

interface ToolRow {
  readonly tool_name: string;
  readonly n: number;
}

interface RecentCapture {
  readonly capture_id: number;
  readonly ts: number;
  readonly type: string;
  readonly content: string;
  readonly session_id: string;
}

export function registerDashboard(app: Hono, brain: BrainHandle): void {
  app.get("/", (c: Context) => {
    const cards = counts(brain);
    const typeRows = brain.raw
      .prepare(
        `SELECT type, COUNT(*) as n FROM captures
         WHERE deleted_at IS NULL
         GROUP BY type ORDER BY n DESC`,
      )
      .all() as TypeRow[];
    const toolRows = brain.raw
      .prepare(
        `SELECT tool_name, COUNT(*) as n FROM tool_calls
         GROUP BY tool_name ORDER BY n DESC LIMIT 10`,
      )
      .all() as ToolRow[];
    const recent = brain.raw
      .prepare(
        `SELECT capture_id, ts, type, content, session_id FROM captures
         WHERE deleted_at IS NULL
         ORDER BY ts DESC LIMIT 10`,
      )
      .all() as RecentCapture[];

    const cardsHtml = cards
      .map(
        (card) => `
        <a class="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400 transition-colors${card.muted ? " opacity-70" : ""}" href="${card.href ?? "#"}">
          <p class="text-xs uppercase tracking-wide text-slate-500">${escapeHtml(card.label)}</p>
          <p class="text-2xl font-semibold mt-1 tabular-nums">${typeof card.value === "number" ? card.value.toLocaleString() : escapeHtml(card.value)}</p>
        </a>`,
      )
      .join("");

    const typeMax = Math.max(1, ...typeRows.map((r) => r.n));
    const typeHtml = typeRows
      .map(
        (r) => `
        <li class="flex items-center gap-3 text-sm">
          <span class="font-mono text-xs w-28 shrink-0">${escapeHtml(r.type)}</span>
          <span class="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
            <span class="block h-full bg-slate-700" style="width:${((r.n / typeMax) * 100).toFixed(1)}%"></span>
          </span>
          <span class="tabular-nums text-slate-500 w-10 text-right">${r.n}</span>
        </li>`,
      )
      .join("");

    const toolMax = Math.max(1, ...toolRows.map((r) => r.n));
    const toolHtml = toolRows
      .map(
        (r) => `
        <li class="flex items-center gap-3 text-sm">
          <span class="font-mono text-xs w-32 shrink-0 truncate" title="${escapeHtml(r.tool_name)}">${escapeHtml(r.tool_name)}</span>
          <span class="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
            <span class="block h-full bg-emerald-600" style="width:${((r.n / toolMax) * 100).toFixed(1)}%"></span>
          </span>
          <span class="tabular-nums text-slate-500 w-12 text-right">${r.n}</span>
        </li>`,
      )
      .join("");

    const recentHtml = recent.length
      ? recent
          .map(
            (cap) => `
            <li class="rounded border border-slate-200 bg-white p-3 text-sm">
              <div class="flex items-center justify-between mb-1">
                <span class="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-mono">${escapeHtml(cap.type)}</span>
                <span class="text-xs text-slate-500">${fmtRelative(cap.ts)}</span>
              </div>
              <p class="text-slate-700">${escapeHtml(cap.content)}</p>
              <p class="mt-1 text-xs font-mono text-slate-400">session ${escapeHtml(cap.session_id)}</p>
            </li>`,
          )
          .join("")
      : '<p class="text-slate-500 text-sm">No captures yet.</p>';

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Dashboard</h1>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">${cardsHtml}</div>
      <div class="grid md:grid-cols-2 gap-6">
        <section class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold mb-3">Captures by type</h2>
          ${typeRows.length ? `<ul class="space-y-2">${typeHtml}</ul>` : '<p class="text-slate-500 text-sm">No captures yet.</p>'}
        </section>
        <section class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold mb-3">Top tool calls</h2>
          ${toolRows.length ? `<ul class="space-y-2">${toolHtml}</ul>` : '<p class="text-slate-500 text-sm">No tool calls yet.</p>'}
        </section>
      </div>
      <section class="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold">Recent captures</h2>
          <a class="text-xs text-slate-500 hover:underline" href="/captures">view all →</a>
        </div>
        <ul class="space-y-2">${recentHtml}</ul>
      </section>`;
    return c.html(shell({ title: "Dashboard", active: "/" }, body));
  });
}
