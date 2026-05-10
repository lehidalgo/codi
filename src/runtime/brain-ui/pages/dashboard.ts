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

interface AggregateMetrics {
  readonly total_messages: number;
  readonly total_input: number;
  readonly total_output: number;
  readonly total_cache_create: number;
  readonly total_cache_read: number;
  readonly total_cost: number;
  readonly total_tool_calls: number;
  readonly total_tool_errors: number;
  readonly avg_input_per_call: number;
  readonly avg_output_per_call: number;
  readonly avg_cache_read_per_call: number;
  readonly avg_cost_per_call: number;
  readonly cache_hit_rate: number;
  readonly tool_error_rate: number;
}

function aggregateMetrics(brain: BrainHandle): AggregateMetrics {
  const tokens = brain.raw
    .prepare(
      `SELECT COALESCE(SUM(tokens_messages_count), 0) AS msgs,
              COALESCE(SUM(tokens_input), 0) AS input,
              COALESCE(SUM(tokens_output), 0) AS output,
              COALESCE(SUM(tokens_cache_create), 0) AS cw,
              COALESCE(SUM(tokens_cache_read), 0) AS cr,
              COALESCE(SUM(cost_usd), 0) AS cost
       FROM sessions`,
    )
    .get() as { msgs: number; input: number; output: number; cw: number; cr: number; cost: number };
  const tools = brain.raw
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS errs
       FROM tool_calls`,
    )
    .get() as { total: number; errs: number | null };
  const msgs = tokens.msgs;
  const denom = tokens.cr + tokens.cw + tokens.input;
  return {
    total_messages: msgs,
    total_input: tokens.input,
    total_output: tokens.output,
    total_cache_create: tokens.cw,
    total_cache_read: tokens.cr,
    total_cost: tokens.cost,
    total_tool_calls: tools.total,
    total_tool_errors: tools.errs ?? 0,
    avg_input_per_call: msgs > 0 ? tokens.input / msgs : 0,
    avg_output_per_call: msgs > 0 ? tokens.output / msgs : 0,
    avg_cache_read_per_call: msgs > 0 ? tokens.cr / msgs : 0,
    avg_cost_per_call: msgs > 0 ? tokens.cost / msgs : 0,
    cache_hit_rate: denom > 0 ? tokens.cr / denom : 0,
    tool_error_rate: tools.total > 0 ? (tools.errs ?? 0) / tools.total : 0,
  };
}

interface TopSpenderRow {
  readonly session_id: string;
  readonly agent_type: string;
  readonly cost_usd: number;
  readonly tokens_messages_count: number | null;
  readonly started_at: number;
}

function topSpenders(brain: BrainHandle): TopSpenderRow[] {
  return brain.raw
    .prepare(
      `SELECT session_id, agent_type, cost_usd, tokens_messages_count, started_at
       FROM sessions WHERE cost_usd > 0 ORDER BY cost_usd DESC LIMIT 5`,
    )
    .all() as TopSpenderRow[];
}

interface ProjectRow {
  readonly project_id: string;
  readonly name: string;
  readonly repo_path: string;
  readonly git_user_name: string | null;
  readonly git_user_email: string | null;
  readonly host_user: string | null;
  readonly host_machine: string | null;
  readonly first_seen: number;
  readonly last_seen: number;
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

    const agg = aggregateMetrics(brain);
    const top = topSpenders(brain);
    const projects = brain.raw
      .prepare(`SELECT * FROM projects ORDER BY last_seen DESC LIMIT 10`)
      .all() as ProjectRow[];

    const fmtPct = (v: number): string => `${(v * 100).toFixed(1)}%`;
    const fmtChars = (v: number): string =>
      v < 1000 ? String(Math.round(v)) : `${(v / 1000).toFixed(1)}k`;
    const aggStat = (label: string, value: string, hint?: string): string => `
      <div class="rounded border border-slate-200 bg-slate-50 p-2.5">
        <p class="text-xs uppercase text-slate-500">${escapeHtml(label)}</p>
        <p class="tabular-nums text-base mt-0.5">${value}</p>
        ${hint ? `<p class="text-xs text-slate-400 mt-0.5">${hint}</p>` : ""}
      </div>`;

    const aggregatesHtml = `
      <section x-data="{ open: false }" class="rounded-lg border border-slate-200 bg-white p-4 mb-6">
        <header class="flex items-center justify-between cursor-pointer" x-on:click="open = !open">
          <h2 class="text-sm font-semibold">Aggregate metrics (all sessions)</h2>
          <span class="text-xs text-slate-500" x-text="open ? '▾ collapse' : '▸ expand'">▸ expand</span>
        </header>
        <div x-show="open" x-cloak class="mt-3 space-y-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">Volume</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${aggStat("Total API calls", agg.total_messages.toLocaleString())}
              ${aggStat("Total tool calls", agg.total_tool_calls.toLocaleString())}
              ${aggStat("Total tokens", fmtTokens(agg.total_input + agg.total_output + agg.total_cache_create + agg.total_cache_read))}
              ${aggStat("Total cost", fmtUsd(agg.total_cost))}
            </div>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">Per-call averages</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${aggStat("Avg input / call", fmtChars(agg.avg_input_per_call))}
              ${aggStat("Avg output / call", fmtChars(agg.avg_output_per_call))}
              ${aggStat("Avg cache read / call", fmtChars(agg.avg_cache_read_per_call))}
              ${aggStat("Avg cost / call", `$${agg.avg_cost_per_call.toFixed(4)}`)}
            </div>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 mb-2">Quality</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${aggStat("Cache hit rate", fmtPct(agg.cache_hit_rate))}
              ${aggStat("Tool error rate", fmtPct(agg.tool_error_rate))}
              ${aggStat("Verbosity ratio", agg.avg_input_per_call > 0 ? `${(agg.avg_output_per_call / agg.avg_input_per_call).toFixed(1)}x` : "—", "agent / human output")}
              ${aggStat("Tool calls / call", agg.total_messages > 0 ? (agg.total_tool_calls / agg.total_messages).toFixed(2) : "—")}
            </div>
          </div>
        </div>
      </section>`;

    const topHtml = top.length
      ? `<ul class="space-y-1.5 text-sm">${top
          .map(
            (s) => `
          <li class="flex items-center gap-3">
            <a class="font-mono text-xs flex-1 truncate hover:underline" href="/session/${escapeHtml(s.session_id)}">${escapeHtml(s.session_id.slice(0, 12))}…</a>
            <span class="text-xs text-slate-500">${escapeHtml(s.agent_type)}</span>
            <span class="text-xs text-slate-400 tabular-nums w-16 text-right">${(s.tokens_messages_count ?? 0).toLocaleString()} calls</span>
            <span class="tabular-nums w-20 text-right font-medium">${fmtUsd(s.cost_usd)}</span>
          </li>`,
          )
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No sessions with cost yet.</p>`;

    const projectsHtml = projects.length
      ? `<ul class="space-y-1.5 text-sm">${projects
          .map(
            (p) => `
          <li class="flex items-center gap-3">
            <span class="font-mono text-xs flex-1 truncate" title="${escapeHtml(p.repo_path)}">${escapeHtml(p.name)}</span>
            <span class="text-xs text-slate-500 truncate" title="${escapeHtml(p.git_user_email ?? "")}">${escapeHtml(p.git_user_name ?? p.host_user ?? "—")}</span>
            <span class="text-xs text-slate-400">${fmtRelative(p.last_seen)}</span>
          </li>`,
          )
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No projects tracked yet.</p>`;

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Dashboard</h1>
      <div x-data="{}" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">${cardsHtml}</div>
      <div x-data="{}">${aggregatesHtml}</div>
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
      </section>
      <div class="grid md:grid-cols-2 gap-6 mt-6">
        <section class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold mb-3">Top spenders</h2>
          ${topHtml}
        </section>
        <section class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold mb-3">Projects</h2>
          ${projectsHtml}
        </section>
      </div>`;
    return c.html(shell({ title: "Dashboard", active: "/" }, body));
  });
}
