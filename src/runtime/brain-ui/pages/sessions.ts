/**
 * Sessions list + detail page. Detail merges prompts / turns / tool_calls /
 * captures into a single chronological timeline so a dev can replay what
 * happened without joining tables manually.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import {
  shell,
  escapeHtml,
  fmtRelative,
  fmtTs,
  fmtDuration,
  renderMarkdown,
  prettyJson,
} from "./shell.js";

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
  readonly tokens_input: number | null;
  readonly tokens_output: number | null;
  readonly tokens_cache_create: number | null;
  readonly tokens_cache_read: number | null;
  readonly tokens_preloaded: number | null;
  readonly cost_usd: number | null;
  readonly context_window: number | null;
  readonly tokens_estimated: number | null;
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

function totalTokens(s: SessionRow): number {
  return (
    (s.tokens_input ?? 0) +
    (s.tokens_output ?? 0) +
    (s.tokens_cache_create ?? 0) +
    (s.tokens_cache_read ?? 0)
  );
}

/**
 * Render the per-session tokens + cost card. Shows a context-window fill
 * bar driven by the FIRST-message bill-equivalent footprint
 * (input + cache_create + cache_read). Estimated rows render with a `~`
 * prefix so the dev knows the numbers came from the tokenizer fallback.
 */
function renderTokensCard(s: SessionRow): string {
  const total = totalTokens(s);
  if (total === 0 && (s.cost_usd ?? 0) === 0) {
    return `<div class="rounded-lg border border-slate-200 bg-white p-4 mb-5 text-sm text-slate-500">
      No token data yet. The Stop hook aggregates usage from the transcript on the next agent reply.
    </div>`;
  }
  const estimated = (s.tokens_estimated ?? 0) === 1;
  const ctxWindow = s.context_window ?? 200_000;
  // Context fill: input + cache_create + cache_read (one full prefix).
  // Output is not part of the context budget.
  const ctxFill = (s.tokens_input ?? 0) + (s.tokens_cache_create ?? 0) + (s.tokens_cache_read ?? 0);
  // The fill bar shows the LAST-call prefix: the highest single cache_read.
  // Without per-turn breakdown we fall back to preloaded + a fraction of
  // total reads — a conservative estimate of "biggest prefix in flight".
  const lastPrefix = Math.max(s.tokens_preloaded ?? 0, Math.min(ctxFill, ctxWindow));
  const pct = Math.min(100, Math.round((lastPrefix / ctxWindow) * 1000) / 10);
  const barColor = pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";

  return `
    <section class="rounded-lg border border-slate-200 bg-white p-4 mb-5">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="text-sm font-semibold">Tokens & cost ${estimated ? '<span class="text-xs ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">estimated</span>' : ""}</h2>
        <span class="text-xs text-slate-500">window: ${ctxWindow.toLocaleString()} tokens</span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm mb-3">
        <div><p class="text-xs uppercase text-slate-500">Input</p><p class="tabular-nums" title="${(s.tokens_input ?? 0).toLocaleString()}">${estimated ? "~" : ""}${fmtTokens(s.tokens_input ?? 0)}</p></div>
        <div><p class="text-xs uppercase text-slate-500">Output</p><p class="tabular-nums" title="${(s.tokens_output ?? 0).toLocaleString()}">${estimated ? "~" : ""}${fmtTokens(s.tokens_output ?? 0)}</p></div>
        <div><p class="text-xs uppercase text-slate-500">Cache write</p><p class="tabular-nums" title="${(s.tokens_cache_create ?? 0).toLocaleString()}">${fmtTokens(s.tokens_cache_create ?? 0)}</p></div>
        <div><p class="text-xs uppercase text-slate-500">Cache read</p><p class="tabular-nums" title="${(s.tokens_cache_read ?? 0).toLocaleString()}">${fmtTokens(s.tokens_cache_read ?? 0)}</p></div>
        <div><p class="text-xs uppercase text-slate-500">Cost</p><p class="tabular-nums">${fmtUsd(s.cost_usd ?? 0)}</p></div>
      </div>
      <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>Largest prefix in window</span>
        <span class="tabular-nums">${lastPrefix.toLocaleString()} / ${ctxWindow.toLocaleString()} (${pct}%)</span>
      </div>
      <div class="h-2 bg-slate-100 rounded overflow-hidden">
        <div class="h-full ${barColor}" style="width:${pct}%"></div>
      </div>
      ${(s.tokens_preloaded ?? 0) > 0 ? `<p class="text-xs text-slate-500 mt-2">Pre-loaded at session start: <span class="tabular-nums">${s.tokens_preloaded!.toLocaleString()}</span> tokens (system prompt + skills + tools).</p>` : ""}
    </section>`;
}

// Match the strict canonical capture marker so we can strip it from
// agent_text without false positives. Keep in sync with markers.ts.
const STRIP_MARKER_RE =
  /\|(?:RULE|PROHIBITION|PREFERENCE|FEEDBACK|INSIGHT|OBSERVATION|DECISION|QUESTION|PROMPT|CORRECTION|DEFECT):\s+"(?:\\"|[^"])*"\|/g;

function stripMarkers(text: string): string {
  return text
    .replace(STRIP_MARKER_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

interface PromptRow {
  prompt_id: number;
  turn_no: number;
  ts: number;
  text: string;
}

interface TurnRow {
  turn_id: number;
  turn_no: number;
  ts: number;
  agent_text: string | null;
  duration_ms: number | null;
  prompt_id: number;
}

interface ToolRow {
  call_id: number;
  turn_id: number;
  ts: number;
  tool_name: string;
  input_json: string;
  output_summary: string | null;
  status: string;
  duration_ms: number | null;
  error: string | null;
}

interface CaptureRow {
  capture_id: number;
  turn_id: number;
  ts: number;
  type: string;
  content: string;
}

interface TurnGroup {
  readonly prompt: PromptRow | null;
  readonly turn: TurnRow | null;
  readonly tools: ToolRow[];
  readonly captures: CaptureRow[];
}

/**
 * Load every event for a session and group by turn_no. Each group has a
 * single Human prompt + a single Agent turn, plus all the tool calls and
 * captures that happened during that turn. The prompt that triggered a
 * turn lives in `prompts.turn_no = turns.turn_no` (foreign-key by row
 * shape, not enforced).
 */
function loadTimeline(brain: BrainHandle, sessionId: string): TurnGroup[] {
  const prompts = brain.raw
    .prepare(
      `SELECT prompt_id, turn_no, ts, text FROM prompts
       WHERE session_id = ? ORDER BY turn_no ASC LIMIT 500`,
    )
    .all(sessionId) as PromptRow[];
  const turns = brain.raw
    .prepare(
      `SELECT turn_id, turn_no, ts, agent_text, duration_ms, prompt_id FROM turns
       WHERE session_id = ? ORDER BY turn_no ASC LIMIT 500`,
    )
    .all(sessionId) as TurnRow[];
  const tools = brain.raw
    .prepare(
      `SELECT call_id, turn_id, ts, tool_name, input_json, output_summary,
              status, duration_ms, error
       FROM tool_calls WHERE session_id = ? ORDER BY ts ASC LIMIT 5000`,
    )
    .all(sessionId) as ToolRow[];
  const captures = brain.raw
    .prepare(
      `SELECT capture_id, turn_id, ts, type, content FROM captures
       WHERE session_id = ? AND deleted_at IS NULL
       ORDER BY ts ASC LIMIT 5000`,
    )
    .all(sessionId) as CaptureRow[];

  // Index turns by turn_no so each prompt finds its agent reply quickly.
  const turnByNo = new Map<number, TurnRow>();
  for (const t of turns) turnByNo.set(t.turn_no, t);
  const promptByNo = new Map<number, PromptRow>();
  for (const p of prompts) promptByNo.set(p.turn_no, p);
  const toolsByTurn = new Map<number, ToolRow[]>();
  for (const tc of tools) {
    const list = toolsByTurn.get(tc.turn_id) ?? [];
    list.push(tc);
    toolsByTurn.set(tc.turn_id, list);
  }
  const capturesByTurn = new Map<number, CaptureRow[]>();
  for (const cap of captures) {
    const list = capturesByTurn.get(cap.turn_id) ?? [];
    list.push(cap);
    capturesByTurn.set(cap.turn_id, list);
  }

  const turnNos = new Set<number>();
  for (const p of prompts) turnNos.add(p.turn_no);
  for (const t of turns) turnNos.add(t.turn_no);
  const sortedTurnNos = [...turnNos].sort((a, b) => a - b);

  const groups: TurnGroup[] = [];
  const consumedTurnIds = new Set<number>();
  for (const turnNo of sortedTurnNos) {
    const turn = turnByNo.get(turnNo) ?? null;
    const prompt = promptByNo.get(turnNo) ?? null;
    const turnTools = turn ? (toolsByTurn.get(turn.turn_id) ?? []) : [];
    const turnCaptures = turn ? (capturesByTurn.get(turn.turn_id) ?? []) : [];
    if (turn) consumedTurnIds.add(turn.turn_id);
    groups.push({ prompt, turn, tools: turnTools, captures: turnCaptures });
  }

  // Orphans: tools / captures whose turn_id has no matching turn row (can
  // happen with seed fixtures or partial sessions). Bucket them under a
  // synthetic group so they still surface in the UI.
  const orphanTools: ToolRow[] = [];
  const orphanCaptures: CaptureRow[] = [];
  for (const [turnId, list] of toolsByTurn) {
    if (!consumedTurnIds.has(turnId)) orphanTools.push(...list);
  }
  for (const [turnId, list] of capturesByTurn) {
    if (!consumedTurnIds.has(turnId)) orphanCaptures.push(...list);
  }
  if (orphanTools.length > 0 || orphanCaptures.length > 0) {
    groups.push({
      prompt: null,
      turn: null,
      tools: orphanTools.sort((a, b) => a.ts - b.ts),
      captures: orphanCaptures.sort((a, b) => a.ts - b.ts),
    });
  }
  return groups;
}

let blockCounter = 0;
function nextBlockId(): string {
  blockCounter += 1;
  return `tb${blockCounter}`;
}

/**
 * Render a tool-call output payload into a collapsible card with both
 * formatted and raw views. Reused by sessions timeline and the tool-calls
 * page — same pattern, no JSON re-escape gotchas.
 */
export function renderToolPayload(prefix: string, payload: string): string {
  const pretty = prettyJson(payload);
  const id = nextBlockId();
  const header = (extras: string): string => `
    <div class="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
      <span class="font-mono text-xs text-slate-600">${escapeHtml(prefix || "output")}</span>
      <div class="flex gap-2 text-xs items-center">${extras}
        <button type="button" class="text-slate-500 hover:text-slate-900"
          x-on:click="open = !open" x-text="open ? 'collapse' : 'expand'">collapse</button>
      </div>
    </div>`;

  if (!pretty.isJson) {
    // Plain text payload — single block, expand/collapse only.
    return `
      <div x-data="{ open: true }" id="${id}" class="rounded border border-slate-200 bg-slate-50 p-2">
        ${header("")}
        <pre x-show="open" class="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-96">${escapeHtml(payload)}</pre>
      </div>`;
  }

  const obj = JSON.parse(payload) as Record<string, unknown>;
  const known = ["stdout", "stderr", "error", "output", "result"] as const;
  const fields: Array<{ key: string; value: string }> = [];
  for (const key of known) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) {
      fields.push({ key, value: v });
      delete obj[key];
    }
  }
  const fieldsHtml = fields
    .map(
      (f) => `
      <div class="mt-1.5">
        <p class="text-xs uppercase tracking-wide text-slate-500 mb-1">${escapeHtml(f.key)}</p>
        <pre class="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-96">${escapeHtml(f.value)}</pre>
      </div>`,
    )
    .join("");
  const remaining =
    Object.keys(obj).length > 0
      ? `<details class="mt-2"><summary class="text-xs text-slate-500 cursor-pointer">other fields (${Object.keys(obj).length})</summary><pre class="mt-1 text-xs bg-slate-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(obj, null, 2))}</pre></details>`
      : "";
  const rawJson = pretty.text;
  const rawHtml = `<pre x-show="mode === 'raw'" class="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-96">${escapeHtml(rawJson)}</pre>`;
  const formattedHtml = `<div x-show="mode === 'formatted'">${fieldsHtml || `<pre class="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words max-h-96">${escapeHtml(rawJson)}</pre>`}${remaining}</div>`;

  const toggleBtn = (label: string, mode: string) => `
    <button type="button"
      x-on:click="mode = '${mode}'"
      :class="mode === '${mode}' ? 'text-slate-900 underline' : 'text-slate-500'"
      class="hover:text-slate-900">${label}</button>`;

  return `
    <div x-data="{ open: true, mode: 'formatted' }" id="${id}" class="rounded border border-slate-200 bg-slate-50 p-2">
      ${header(`${toggleBtn("formatted", "formatted")}${toggleBtn("raw", "raw")}`)}
      <div x-show="open">
        ${formattedHtml}
        ${rawHtml}
      </div>
    </div>`;
}

function isLikelyOldTruncated(s: string | null): boolean {
  // Detect content that was truncated by the historical 200-char cap so
  // the UI can flag it to the dev (they cannot recover it without a
  // re-run).
  if (!s) return false;
  return s.length <= 220 && s.endsWith("…");
}

/**
 * Build a one-line description for a tool call from its input JSON. Each
 * tool exposes a different shape; we cover the common ones (Bash, Read,
 * Write, Edit, Glob, Grep, Task, WebFetch, TodoWrite) and fall back to
 * the raw command-like field most tools ship.
 */
export function describeToolInput(toolName: string, inputJson: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(inputJson) as Record<string, unknown>;
  } catch {
    return inputJson.slice(0, 200);
  }
  const get = (k: string): string | null => {
    const v = parsed[k];
    return typeof v === "string" ? v : null;
  };
  switch (toolName) {
    case "Bash":
      return get("command") ?? "";
    case "Read":
    case "Write":
    case "NotebookEdit":
      return get("file_path") ?? "";
    case "Edit":
      return get("file_path") ?? "";
    case "MultiEdit": {
      const fp = get("file_path");
      const edits = Array.isArray(parsed["edits"]) ? (parsed["edits"] as unknown[]).length : 0;
      return fp ? `${fp} (${edits} edits)` : `${edits} edits`;
    }
    case "Glob":
      return [get("pattern"), get("path")].filter(Boolean).join(" in ");
    case "Grep": {
      const pattern = get("pattern");
      const path = get("path") ?? get("glob");
      return path ? `${pattern} in ${path}` : (pattern ?? "");
    }
    case "Task": {
      const desc = get("description");
      const subagent = get("subagent_type");
      return subagent ? `[${subagent}] ${desc ?? ""}` : (desc ?? "");
    }
    case "WebFetch":
    case "WebSearch":
      return get("url") ?? get("query") ?? "";
    case "TodoWrite": {
      const todos = parsed["todos"];
      if (Array.isArray(todos)) {
        const inProgress = todos.find(
          (t) =>
            typeof t === "object" &&
            t !== null &&
            (t as Record<string, unknown>)["status"] === "in_progress",
        ) as Record<string, unknown> | undefined;
        const label = inProgress ? (inProgress["content"] as string) : `${todos.length} items`;
        return label;
      }
      return "todos updated";
    }
    case "ExitPlanMode":
      return "exit plan mode";
    default: {
      // Generic best-effort: pick the first short string field we find.
      for (const key of [
        "command",
        "url",
        "query",
        "path",
        "file_path",
        "pattern",
        "description",
      ]) {
        const v = get(key);
        if (v) return v;
      }
      return "";
    }
  }
}

function renderToolBlock(tc: ToolRow): string {
  const statusBadge =
    tc.status === "ok"
      ? `<span class="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ok</span>`
      : `<span class="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">${escapeHtml(tc.status)}</span>`;
  const truncatedBadge = isLikelyOldTruncated(tc.output_summary)
    ? ` <span class="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800" title="Captured before the storage cap was raised — output was cut at 200 chars; not recoverable.">truncated@storage</span>`
    : "";
  const errorBlock = tc.error
    ? `<div class="mt-2"><p class="text-xs uppercase tracking-wide text-rose-700 mb-1">error</p><pre class="text-xs text-rose-900 bg-rose-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">${escapeHtml(tc.error)}</pre></div>`
    : "";
  const description = describeToolInput(tc.tool_name, tc.input_json);
  const descriptionHtml = description
    ? `<p class="text-xs text-slate-700 font-mono mb-2 break-all" title="${escapeHtml(description)}">${escapeHtml(description.slice(0, 240))}${description.length > 240 ? "…" : ""}</p>`
    : "";
  return `
    <article id="tool-${tc.call_id}" class="rounded-lg border border-slate-200 bg-white p-3 scroll-mt-6">
      <header class="flex items-center gap-2 flex-wrap mb-2">
        <a href="/tool-call/${tc.call_id}" class="font-mono text-xs text-emerald-700 hover:underline">${escapeHtml(tc.tool_name)}</a>
        ${statusBadge}
        <span class="text-xs text-slate-500">${fmtDuration(tc.duration_ms)}</span>
        ${truncatedBadge}
        <span class="text-xs text-slate-400 ml-auto" title="${fmtTs(tc.ts)}">${fmtRelative(tc.ts)}</span>
      </header>
      ${descriptionHtml}
      <details class="mb-2">
        <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-900">input</summary>
        <div class="mt-2">${renderToolPayload("", tc.input_json)}</div>
      </details>
      ${tc.output_summary ? `<div>${renderToolPayload("", tc.output_summary)}</div>` : '<p class="text-xs text-slate-400">no output</p>'}
      ${errorBlock}
    </article>`;
}

function renderCaptureBlock(cap: CaptureRow): string {
  const typeColor =
    {
      RULE: "bg-blue-100 text-blue-800",
      PROHIBITION: "bg-rose-100 text-rose-800",
      PREFERENCE: "bg-violet-100 text-violet-800",
      FEEDBACK: "bg-pink-100 text-pink-800",
      INSIGHT: "bg-cyan-100 text-cyan-800",
      OBSERVATION: "bg-amber-100 text-amber-800",
      DECISION: "bg-emerald-100 text-emerald-800",
      QUESTION: "bg-yellow-100 text-yellow-800",
      PROMPT: "bg-indigo-100 text-indigo-800",
      CORRECTION: "bg-orange-100 text-orange-800",
      DEFECT: "bg-red-100 text-red-800",
    }[cap.type] ?? "bg-slate-100 text-slate-800";
  return `
    <article id="capture-${cap.capture_id}" class="rounded-lg border border-slate-200 bg-white p-3 scroll-mt-6">
      <header class="flex items-center gap-2 mb-2">
        <a href="/capture/${cap.capture_id}" class="text-xs font-mono px-1.5 py-0.5 rounded ${typeColor} hover:underline">${escapeHtml(cap.type)}</a>
        <span class="text-xs text-slate-400 ml-auto" title="${fmtTs(cap.ts)}">${fmtRelative(cap.ts)}</span>
      </header>
      <div class="text-sm">${renderMarkdown(cap.content)}</div>
    </article>`;
}

/**
 * Render a single turn group. Two top-level cards: HUMAN (the prompt) and
 * AGENT (the response). Inside the agent card we layer the ordered
 * sub-blocks: agent text, then tool calls and captures interleaved
 * chronologically.
 */
function renderTurnGroup(group: TurnGroup): string {
  const turnNo = group.turn?.turn_no ?? group.prompt?.turn_no ?? 0;
  const turnId = group.turn?.turn_id;
  const humanCard = group.prompt
    ? `
      <section class="rounded-xl border border-sky-200 bg-sky-50/40 p-4 mb-3">
        <header class="flex items-center gap-2 mb-2">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
            <span class="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
            HUMAN
          </span>
          <span class="text-xs text-slate-500">turn ${turnNo}</span>
          <span class="text-xs text-slate-400 ml-auto" title="${fmtTs(group.prompt.ts)}">${fmtRelative(group.prompt.ts)}</span>
        </header>
        <div class="text-sm">${renderMarkdown(group.prompt.text)}</div>
      </section>`
    : "";

  const agentText = group.turn ? stripMarkers(group.turn.agent_text ?? "") : "";
  const merged: Array<{ ts: number; html: string }> = [];
  for (const tc of group.tools) merged.push({ ts: tc.ts, html: renderToolBlock(tc) });
  for (const cap of group.captures) merged.push({ ts: cap.ts, html: renderCaptureBlock(cap) });
  merged.sort((a, b) => a.ts - b.ts);
  const subBlocks = merged.map((m) => m.html).join("");

  const agentCard = group.turn
    ? `
      <section class="rounded-xl border border-slate-200 bg-white p-4 mb-6">
        <header class="flex items-center gap-2 mb-3">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span class="inline-block w-2 h-2 rounded-full bg-slate-500"></span>
            AGENT
          </span>
          <span class="text-xs text-slate-500">turn ${turnNo}${turnId !== undefined ? ` · #${turnId}` : ""}</span>
          ${group.turn.duration_ms !== null ? `<span class="text-xs text-slate-500">${fmtDuration(group.turn.duration_ms)}</span>` : ""}
          <span class="text-xs text-slate-400 ml-auto" title="${fmtTs(group.turn.ts)}">${fmtRelative(group.turn.ts)}</span>
        </header>
        ${agentText ? `<div class="text-sm mb-3">${renderMarkdown(agentText)}</div>` : ""}
        ${subBlocks ? `<div class="space-y-2">${subBlocks}</div>` : ""}
      </section>`
    : subBlocks
      ? `
      <section class="rounded-xl border border-amber-200 bg-amber-50/30 p-4 mb-6">
        <header class="flex items-center gap-2 mb-3">
          <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <span class="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            ORPHANS
          </span>
          <span class="text-xs text-slate-500">tools / captures with no matching turn row</span>
        </header>
        <div class="space-y-2">${subBlocks}</div>
      </section>`
      : "";

  return humanCard + agentCard;
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
            <th class="px-3 py-2 text-right">Tokens</th>
            <th class="px-3 py-2 text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((r) => {
              const tt = totalTokens(r);
              const estimated = (r.tokens_estimated ?? 0) === 1;
              return `
            <tr class="border-t border-slate-200 hover:bg-slate-50">
              <td class="px-3 py-2 font-mono text-xs">
                <a class="hover:underline" href="/session/${escapeHtml(r.session_id)}">${escapeHtml(r.session_id.slice(0, 12))}…</a>
              </td>
              <td class="px-3 py-2">${escapeHtml(r.agent_type)}${r.agent_model ? ` <span class="text-xs text-slate-500">/${escapeHtml(r.agent_model)}</span>` : ""}</td>
              <td class="px-3 py-2 font-mono text-xs">${escapeHtml(r.branch ?? "—")}</td>
              <td class="px-3 py-2" title="${fmtTs(r.started_at)}">${fmtRelative(r.started_at)}</td>
              <td class="px-3 py-2 text-right tabular-nums">${r.total_turns ?? 0}</td>
              <td class="px-3 py-2 text-right tabular-nums">${r.total_capture_count ?? 0}</td>
              <td class="px-3 py-2 text-right tabular-nums" title="${tt.toLocaleString()} total">${tt > 0 ? `${estimated ? "~" : ""}${fmtTokens(tt)}` : "—"}</td>
              <td class="px-3 py-2 text-right tabular-nums">${(r.cost_usd ?? 0) > 0 ? fmtUsd(r.cost_usd!) : "—"}</td>
            </tr>`;
            })
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
          ${session.agent_model ? `<p class="text-xs font-mono text-slate-500 mt-0.5">${escapeHtml(session.agent_model)}</p>` : ""}
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
      ${renderTokensCard(session)}
      <h2 class="text-lg font-semibold mb-3">Timeline (${timeline.length} turns)</h2>
      <div>${timeline.map(renderTurnGroup).join("")}</div>`;
    return c.html(shell({ title: `Session ${id}`, active: "/sessions" }, body));
  });
}
