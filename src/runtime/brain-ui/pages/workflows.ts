/**
 * Workflows list + detail. Detail view renders the phase graph (parsed from
 * workflow_definitions.definition) as a Mermaid flowchart, a quality-metrics
 * ribbon computed from `workflow_events`, a Gantt-style phase timeline, a
 * type-aware event log (one card per event with all payload fields visible),
 * and the captures linked to this workflow_id.
 *
 * The page is structured as a small set of helpers so the file stays under
 * 700 LOC and each renderer is independently testable.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { shell, escapeHtml, fmtRelative, fmtTs, prettyJson } from "./shell.js";

// ─── Row shapes ───────────────────────────────────────────────────────

interface RunRow {
  readonly workflow_id: string;
  readonly project_id: string;
  readonly type: string;
  readonly current_phase: string;
  readonly status: string;
  readonly started_at: number;
  readonly ended_at: number | null;
  readonly metadata: string | null;
}

interface EventRow {
  readonly event_id: number;
  readonly event_type: string;
  readonly ts: number;
  readonly payload: string | null;
}

interface CaptureRow {
  readonly capture_id: number;
  readonly type: string;
  readonly content: string;
  readonly ts: number;
  readonly phase: string | null;
}

interface PhaseDef {
  readonly gates?: string[];
  readonly next?: string[];
}

interface DefinitionDoc {
  readonly id?: string;
  readonly phases?: Record<string, PhaseDef>;
  readonly flags?: Record<string, unknown>;
}

interface ParsedEvent {
  readonly row: EventRow;
  readonly envelope: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly authorType: string;
  readonly authorId: string;
}

// ─── Phase graph (Mermaid) ────────────────────────────────────────────

function loadDefinition(brain: BrainHandle, type: string): DefinitionDoc | null {
  const row = brain.raw
    .prepare(`SELECT definition FROM workflow_definitions WHERE id = ?`)
    .get(type) as { definition: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.definition) as DefinitionDoc;
  } catch {
    return null;
  }
}

function renderMermaid(def: DefinitionDoc | null, currentPhase: string): string {
  if (!def?.phases) {
    return `<p class="text-slate-500 text-sm">No phase graph available — workflow_definitions table empty for this type.</p>`;
  }
  const lines: string[] = ["flowchart LR"];
  for (const [phase, info] of Object.entries(def.phases)) {
    const safe = phase.replace(/[^A-Za-z0-9_]/g, "_");
    const style = phase === currentPhase ? `:::current` : "";
    lines.push(`  ${safe}["${phase}"]${style}`);
    for (const next of info?.next ?? []) {
      const nextSafe = next.replace(/[^A-Za-z0-9_]/g, "_");
      lines.push(`  ${safe} --> ${nextSafe}`);
    }
  }
  lines.push(`  classDef current fill:#0f172a,stroke:#0f172a,color:#fff`);
  return `<div class="mermaid">${escapeHtml(lines.join("\n"))}</div>`;
}

// ─── Event parsing + type-aware rendering ─────────────────────────────

function parseEvents(rows: readonly EventRow[]): ParsedEvent[] {
  const parsed: ParsedEvent[] = [];
  for (const row of rows) {
    let envelope: Record<string, unknown> = {};
    if (row.payload) {
      try {
        envelope = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        envelope = {};
      }
    }
    const payload = (envelope["payload"] as Record<string, unknown>) ?? {};
    const author = (envelope["author"] as Record<string, unknown>) ?? {};
    parsed.push({
      row,
      envelope,
      payload,
      authorType: String(author["type"] ?? "unknown"),
      authorId: String(author["id"] ?? "unknown"),
    });
  }
  return parsed;
}

const EVENT_TYPE_COLORS: Readonly<Record<string, string>> = {
  init: "bg-indigo-100 text-indigo-800",
  phase_started: "bg-sky-100 text-sky-800",
  phase_transition_proposed: "bg-amber-100 text-amber-800",
  phase_transition_approved: "bg-emerald-100 text-emerald-800",
  phase_transition_rejected: "bg-rose-100 text-rose-800",
  phase_completed: "bg-emerald-100 text-emerald-800",
  gate_check_started: "bg-slate-100 text-slate-700",
  gate_check_passed: "bg-emerald-100 text-emerald-800",
  gate_check_failed: "bg-rose-100 text-rose-800",
  scope_expansion_proposed: "bg-amber-100 text-amber-800",
  scope_expansion_approved: "bg-emerald-100 text-emerald-800",
  scope_expansion_rejected: "bg-rose-100 text-rose-800",
  incidental_change_recorded: "bg-yellow-100 text-yellow-800",
  subagent_dispatched: "bg-purple-100 text-purple-800",
  subagent_completed: "bg-purple-100 text-purple-800",
  abandoned: "bg-rose-100 text-rose-800",
};

const AUTHOR_COLORS: Readonly<Record<string, string>> = {
  human: "text-blue-700",
  agent: "text-purple-700",
  system: "text-slate-600",
};

function renderEventBody(ev: ParsedEvent): string {
  const t = ev.row.event_type;
  const p = ev.payload;

  if (t === "init") {
    return rows([
      ["Task", String(p["task"] ?? "—")],
      ["Workflow type", String(p["workflow_type"] ?? "—")],
      ["Working dir", String(p["cwd"] ?? "—")],
      ["Plugin version", String(p["plugin_version"] ?? "—")],
    ]);
  }
  if (t === "phase_started") {
    return rows([["Phase", String(p["phase"] ?? "—")]]);
  }
  if (t === "phase_transition_proposed" || t === "phase_completed") {
    return rows([
      ["From", String(p["from_phase"] ?? p["phase"] ?? "—")],
      ["To", String(p["to_phase"] ?? "—")],
      ...(p["gate_passed"] !== undefined
        ? [["Gate passed", boolBadge(Boolean(p["gate_passed"]))] as [string, string]]
        : []),
    ]);
  }
  if (t === "phase_transition_approved") {
    return rows([
      ["From", String(p["from_phase"] ?? "—")],
      ["To", String(p["to_phase"] ?? "—")],
      ...(p["reason"] ? [["Reason", String(p["reason"])] as [string, string]] : []),
    ]);
  }
  if (t === "phase_transition_rejected") {
    return rows([
      ["From", String(p["from_phase"] ?? "—")],
      ["To", String(p["to_phase"] ?? "—")],
      ["Reason", String(p["reason"] ?? "—")],
    ]);
  }
  if (t === "gate_check_started" || t === "gate_check_passed" || t === "gate_check_failed") {
    const checks = (p["results"] ?? p["checks"]) as Array<Record<string, unknown>> | undefined;
    const checksHtml = checks
      ? `<ul class="mt-1 space-y-1">${checks
          .map((c) => {
            const verdict = String(c["verdict"] ?? "—");
            const color =
              verdict === "pass"
                ? "text-emerald-700"
                : verdict === "fail"
                  ? "text-rose-700"
                  : "text-slate-600";
            return `<li class="text-xs"><span class="font-mono ${color}">${escapeHtml(verdict)}</span> · <span class="font-mono">${escapeHtml(String(c["gate"] ?? "—"))}</span> — ${escapeHtml(String(c["detail"] ?? ""))}</li>`;
          })
          .join("")}</ul>`
      : "";
    return (
      rows([
        ["Phase", String(p["phase"] ?? "—")],
        ...(p["gate_name"] ? [["Gate", String(p["gate_name"])] as [string, string]] : []),
        ...(p["duration_ms"] !== undefined
          ? [["Duration", `${p["duration_ms"]}ms`] as [string, string]]
          : []),
      ]) + checksHtml
    );
  }
  if (
    t === "scope_expansion_proposed" ||
    t === "scope_expansion_approved" ||
    t === "scope_expansion_rejected"
  ) {
    return rows([
      ["File", String(p["file"] ?? "—")],
      ...(p["reason"] ? [["Reason", String(p["reason"])] as [string, string]] : []),
    ]);
  }
  if (t === "incidental_change_recorded") {
    return rows([
      ["File", String(p["file"] ?? p["file_path"] ?? "—")],
      ["Phase at edit", String(p["phase"] ?? "—")],
      ...(p["classifier_reason"]
        ? [["Reason", String(p["classifier_reason"])] as [string, string]]
        : p["reason"]
          ? [["Reason", String(p["reason"])] as [string, string]]
          : []),
    ]);
  }
  if (t === "subagent_dispatched" || t === "subagent_completed") {
    return rows([
      ["Agent type", String(p["agent_type"] ?? "—")],
      ["Sub-id", String(p["subagent_id"] ?? "—")],
      ...(p["tokens"] !== undefined ? [["Tokens", String(p["tokens"])] as [string, string]] : []),
      ...(p["status"] ? [["Status", String(p["status"])] as [string, string]] : []),
    ]);
  }
  if (t === "abandoned") {
    return rows([
      ["Phase at abandon", String(p["phase"] ?? "—")],
      ["Reason", String(p["reason"] ?? "—")],
    ]);
  }
  // Fallback: list all top-level payload fields verbatim.
  const entries = Object.entries(p);
  if (entries.length === 0) {
    return `<p class="text-xs text-slate-500">No payload fields.</p>`;
  }
  return rows(entries.map(([k, v]) => [k, stringify(v)]));
}

function rows(items: ReadonlyArray<[string, string]>): string {
  return `<dl class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
    ${items
      .map(
        ([k, v]) =>
          `<dt class="text-slate-500 uppercase tracking-wide">${escapeHtml(k)}</dt><dd class="text-slate-800 font-mono break-all">${v.startsWith("<") ? v : escapeHtml(v)}</dd>`,
      )
      .join("")}
  </dl>`;
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function boolBadge(ok: boolean): string {
  return ok
    ? `<span class="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-medium">pass</span>`
    : `<span class="inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-medium">fail</span>`;
}

function authorBadge(authorType: string, authorId: string): string {
  const color = AUTHOR_COLORS[authorType] ?? "text-slate-600";
  return `<span class="text-[10px] font-medium ${color}" title="author">${escapeHtml(authorType)}:${escapeHtml(authorId)}</span>`;
}

function eventTypeBadge(t: string): string {
  const color = EVENT_TYPE_COLORS[t] ?? "bg-slate-100 text-slate-700";
  return `<span class="font-mono text-[11px] px-2 py-0.5 rounded ${color}">${escapeHtml(t)}</span>`;
}

function renderEventCard(ev: ParsedEvent, idx: number): string {
  const t = ev.row.event_type;
  const eventId = String(ev.envelope["event_id"] ?? "");
  const fullJson = ev.row.payload ?? "";
  const pretty = prettyJson(fullJson);
  return `<li class="rounded border border-slate-200 bg-white"
       x-data="{ open:false }">
    <header class="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs text-slate-400 font-mono shrink-0" title="${fmtTs(ev.row.ts)}">#${idx + 1} · ${fmtRelative(ev.row.ts)}</span>
        ${eventTypeBadge(t)}
        ${authorBadge(ev.authorType, ev.authorId)}
      </div>
      <button class="text-[10px] text-slate-500 hover:text-slate-800 underline shrink-0"
              x-on:click="open=!open" type="button"
              x-text="open ? 'hide raw' : 'raw json'"></button>
    </header>
    <div class="px-3 py-2">${renderEventBody(ev)}</div>
    <div x-cloak x-show="open" class="border-t border-slate-100 bg-slate-50">
      <pre class="text-[11px] text-slate-700 p-3 overflow-x-auto">${escapeHtml(pretty.text || fullJson)}</pre>
      ${eventId ? `<p class="text-[10px] text-slate-400 px-3 pb-2 font-mono">event_id ${escapeHtml(eventId)}</p>` : ""}
    </div>
  </li>`;
}

// ─── Quality metrics ──────────────────────────────────────────────────

interface QualityMetrics {
  readonly totalDurationMs: number | null;
  readonly phasesVisited: number;
  readonly transitionsProposed: number;
  readonly transitionsApproved: number;
  readonly transitionsRejected: number;
  readonly gatesPassed: number;
  readonly gatesFailed: number;
  readonly scopeProposed: number;
  readonly scopeApproved: number;
  readonly scopeRejected: number;
  readonly incidentalChanges: number;
  readonly subagentsDispatched: number;
  readonly subagentTokens: number;
  readonly perPhaseDurationMs: ReadonlyArray<{ phase: string; ms: number }>;
}

function computeMetrics(run: RunRow, events: readonly ParsedEvent[]): QualityMetrics {
  const endTs = run.ended_at ?? Date.now();
  let phasesVisited = 0;
  let transitionsProposed = 0;
  let transitionsApproved = 0;
  let transitionsRejected = 0;
  let gatesPassed = 0;
  let gatesFailed = 0;
  let scopeProposed = 0;
  let scopeApproved = 0;
  let scopeRejected = 0;
  let incidentalChanges = 0;
  let subagentsDispatched = 0;
  let subagentTokens = 0;

  const phaseStartTs: Map<string, number> = new Map();
  const phaseDurations: Array<{ phase: string; ms: number }> = [];
  let currentPhaseStart: { phase: string; ts: number } | null = null;

  for (const ev of events) {
    const t = ev.row.event_type;
    const p = ev.payload;
    if (t === "phase_started") {
      const phase = String(p["phase"] ?? "");
      if (phase) {
        if (currentPhaseStart) {
          phaseDurations.push({
            phase: currentPhaseStart.phase,
            ms: ev.row.ts - currentPhaseStart.ts,
          });
        }
        if (!phaseStartTs.has(phase)) {
          phaseStartTs.set(phase, ev.row.ts);
          phasesVisited += 1;
        }
        currentPhaseStart = { phase, ts: ev.row.ts };
      }
    }
    if (t === "phase_transition_proposed") transitionsProposed += 1;
    if (t === "phase_transition_approved") transitionsApproved += 1;
    if (t === "phase_transition_rejected") transitionsRejected += 1;
    if (t === "gate_check_passed") gatesPassed += 1;
    if (t === "gate_check_failed") gatesFailed += 1;
    if (t === "scope_expansion_proposed") scopeProposed += 1;
    if (t === "scope_expansion_approved") scopeApproved += 1;
    if (t === "scope_expansion_rejected") scopeRejected += 1;
    if (t === "incidental_change_recorded") incidentalChanges += 1;
    if (t === "subagent_dispatched") subagentsDispatched += 1;
    if (t === "subagent_completed") {
      const tokens = Number(p["tokens"] ?? 0);
      if (Number.isFinite(tokens)) subagentTokens += tokens;
    }
  }
  if (currentPhaseStart) {
    phaseDurations.push({
      phase: currentPhaseStart.phase,
      ms: endTs - currentPhaseStart.ts,
    });
  }
  return {
    totalDurationMs: endTs - run.started_at,
    phasesVisited,
    transitionsProposed,
    transitionsApproved,
    transitionsRejected,
    gatesPassed,
    gatesFailed,
    scopeProposed,
    scopeApproved,
    scopeRejected,
    incidentalChanges,
    subagentsDispatched,
    subagentTokens,
    perPhaseDurationMs: phaseDurations,
  };
}

function fmtDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) return remSec > 0 ? `${minutes}m ${remSec}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return `${hours}h ${remMin}m`;
}

function tile(label: string, value: string, sub?: string): string {
  return `<div class="rounded border border-slate-200 bg-white p-3">
    <p class="text-[10px] uppercase text-slate-500 tracking-wide">${escapeHtml(label)}</p>
    <p class="text-base font-semibold">${value}</p>
    ${sub ? `<p class="text-[11px] text-slate-500 mt-0.5">${sub}</p>` : ""}
  </div>`;
}

function renderMetricsRibbon(m: QualityMetrics, capturesCount: number): string {
  const transitionRatio =
    m.transitionsProposed > 0
      ? `${Math.round((m.transitionsApproved / m.transitionsProposed) * 100)}% approved`
      : "no transitions";
  const gateRatio =
    m.gatesPassed + m.gatesFailed > 0
      ? `${m.gatesPassed}/${m.gatesPassed + m.gatesFailed} passed`
      : "no gates run";
  const scopeText =
    m.scopeProposed + m.incidentalChanges > 0
      ? `${m.scopeApproved} approved · ${m.incidentalChanges} incidental`
      : "no scope changes";
  return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
    ${tile("Duration", fmtDuration(m.totalDurationMs))}
    ${tile("Phases visited", String(m.phasesVisited))}
    ${tile("Transitions", String(m.transitionsApproved + m.transitionsRejected), transitionRatio)}
    ${tile("Gate health", String(m.gatesPassed + m.gatesFailed), gateRatio)}
    ${tile("Scope changes", String(m.scopeProposed + m.incidentalChanges), scopeText)}
    ${tile("Subagents", String(m.subagentsDispatched), m.subagentTokens > 0 ? `${m.subagentTokens.toLocaleString()} tokens` : "no tokens")}
    ${tile("Captures linked", String(capturesCount))}
    ${tile("Rejections", String(m.transitionsRejected + m.scopeRejected + m.gatesFailed), "transitions + scope + gates")}
  </div>`;
}

function renderPhaseTimeline(m: QualityMetrics): string {
  if (m.perPhaseDurationMs.length === 0) {
    return `<p class="text-sm text-slate-500">No phase timing data.</p>`;
  }
  const total = m.perPhaseDurationMs.reduce((a, b) => a + b.ms, 0) || 1;
  const palette = [
    "bg-sky-400",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-purple-400",
    "bg-rose-400",
    "bg-indigo-400",
    "bg-teal-400",
  ];
  const bars = m.perPhaseDurationMs
    .map((seg, i) => {
      const pct = (seg.ms / total) * 100;
      const color = palette[i % palette.length];
      return `<div class="${color} h-6 flex items-center justify-center text-[10px] text-white font-medium" style="width:${pct.toFixed(2)}%"
                title="${escapeHtml(seg.phase)} · ${fmtDuration(seg.ms)}">${pct > 8 ? escapeHtml(seg.phase) : ""}</div>`;
    })
    .join("");
  const legend = m.perPhaseDurationMs
    .map(
      (seg, i) =>
        `<li class="flex items-center gap-2 text-xs"><span class="inline-block w-3 h-3 rounded ${palette[i % palette.length]}"></span><span class="font-mono">${escapeHtml(seg.phase)}</span><span class="text-slate-500">${fmtDuration(seg.ms)}</span></li>`,
    )
    .join("");
  return `<div class="flex w-full overflow-hidden rounded border border-slate-200">${bars}</div>
    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1">${legend}</ul>`;
}

// ─── Linked captures ──────────────────────────────────────────────────

function renderLinkedCaptures(brain: BrainHandle, workflowId: string): string {
  const rows = brain.raw
    .prepare(
      `SELECT capture_id, type, content, ts, phase
       FROM captures
       WHERE workflow_id = ? AND deleted_at IS NULL
       ORDER BY ts DESC LIMIT 50`,
    )
    .all(workflowId) as CaptureRow[];
  if (rows.length === 0) {
    return `<p class="text-sm text-slate-500">No captures linked to this workflow.</p>`;
  }
  const byType: Map<string, number> = new Map();
  for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? 0) + 1);
  const summary = Array.from(byType.entries())
    .map(
      ([type, count]) =>
        `<span class="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono mr-1">${escapeHtml(type)} · ${count}</span>`,
    )
    .join("");
  const list = rows
    .map(
      (
        r,
      ) => `<li class="border-t border-slate-100 px-3 py-2 text-sm hover:bg-slate-50 flex gap-3 items-baseline">
        <span class="font-mono text-[10px] text-slate-500 w-20 shrink-0">${escapeHtml(r.type)}</span>
        <span class="font-mono text-[10px] text-slate-400 w-24 shrink-0">${r.phase ? escapeHtml(r.phase) : "—"}</span>
        <a href="/capture/${r.capture_id}" class="flex-1 truncate hover:underline">${escapeHtml(r.content.slice(0, 200))}</a>
        <span class="text-[10px] text-slate-400 shrink-0" title="${fmtTs(r.ts)}">${fmtRelative(r.ts)}</span>
      </li>`,
    )
    .join("");
  return `<div class="mb-2 text-sm">${summary}</div>
    <ul class="rounded border border-slate-200 bg-white divide-y divide-slate-100">${list}</ul>`;
}

// ─── Routes ───────────────────────────────────────────────────────────

export function registerWorkflows(app: Hono, brain: BrainHandle): void {
  app.get("/workflows", (c: Context) => {
    const status = c.req.query("status") ?? null;
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const rows = brain.raw
      .prepare(
        `SELECT * FROM workflow_runs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY started_at DESC LIMIT 50`,
      )
      .all(...params) as RunRow[];
    const distinctStatus = brain.raw
      .prepare(`SELECT DISTINCT status FROM workflow_runs ORDER BY status`)
      .all() as Array<{ status: string }>;
    const opts = [`<option value="">All statuses</option>`]
      .concat(
        distinctStatus.map(
          (s) =>
            `<option value="${s.status}" ${status === s.status ? "selected" : ""}>${escapeHtml(s.status)}</option>`,
        ),
      )
      .join("");
    const body = `
      <h1 class="text-2xl font-semibold mb-4">Workflows</h1>
      <form method="get" class="flex gap-2 mb-3">
        <select name="status" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${opts}</select>
        <button class="rounded bg-slate-900 text-white px-3 py-1.5 text-sm">Filter</button>
      </form>
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
            <tr class="border-t border-slate-200 hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">
                <a class="hover:underline" href="/workflow/${escapeHtml(r.workflow_id)}">${escapeHtml(r.workflow_id.slice(0, 32))}…</a>
              </td>
              <td class="px-3 py-2">${escapeHtml(r.type)}</td>
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.current_phase)}</td>
              <td class="px-3 py-2">${escapeHtml(r.status)}</td>
              <td class="px-3 py-2" title="${fmtTs(r.started_at)}">${fmtRelative(r.started_at)}</td>
            </tr>`,
            )
            .join("")}
          ${rows.length === 0 ? '<tr><td colspan="5" class="px-3 py-4 text-slate-500">No workflow runs.</td></tr>' : ""}
        </tbody>
      </table>`;
    return c.html(shell({ title: "Workflows", active: "/workflows" }, body));
  });

  app.get("/workflow/:id", (c: Context) => {
    const id = c.req.param("id") ?? "";
    const run = brain.raw.prepare(`SELECT * FROM workflow_runs WHERE workflow_id = ?`).get(id) as
      | RunRow
      | undefined;
    if (!run) {
      return c.html(
        shell({ title: "Not found", active: "/workflows" }, "<p>Workflow not found.</p>"),
        404,
      );
    }
    const eventRows = brain.raw
      .prepare(
        `SELECT event_id, event_type, ts, payload FROM workflow_events WHERE workflow_id = ? ORDER BY ts ASC LIMIT 1000`,
      )
      .all(id) as EventRow[];
    const events = parseEvents(eventRows);
    const def = loadDefinition(brain, run.type);
    const graph = renderMermaid(def, run.current_phase);
    const metrics = computeMetrics(run, events);
    const captureCount = (
      brain.raw
        .prepare(`SELECT count(*) as n FROM captures WHERE workflow_id = ? AND deleted_at IS NULL`)
        .get(id) as { n: number }
    ).n;

    const eventsHtml = events.map((ev, i) => renderEventCard(ev, i)).join("");

    const head = `
      <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
      </script>`;
    const body = `
      <a class="text-xs text-slate-500 hover:underline" href="/workflows">← all workflows</a>
      <h1 class="text-2xl font-semibold mt-2 mb-4">Workflow <span class="font-mono text-base text-slate-600">${escapeHtml(id)}</span></h1>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Type</p><p>${escapeHtml(run.type)}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Phase</p><p class="font-mono text-xs">${escapeHtml(run.current_phase)}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Status</p><p>${escapeHtml(run.status)}</p>
        </div>
        <div class="rounded border border-slate-200 bg-white p-3 text-sm">
          <p class="text-xs uppercase text-slate-500">Started</p><p>${fmtRelative(run.started_at)}</p>
        </div>
      </div>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Quality metrics</h2>
        ${renderMetricsRibbon(metrics, captureCount)}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Phase timeline</h2>
        ${renderPhaseTimeline(metrics)}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Phase graph</h2>
        ${graph}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Linked captures (${captureCount})</h2>
        ${renderLinkedCaptures(brain, id)}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="text-sm font-semibold mb-3">Events (${events.length})</h2>
        <ul class="space-y-2">${eventsHtml || '<li class="text-sm text-slate-500">No events.</li>'}</ul>
      </section>`;
    return c.html(shell({ title: `Workflow ${id}`, active: "/workflows", head }, body));
  });
}
