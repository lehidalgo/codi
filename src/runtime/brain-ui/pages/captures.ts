/**
 * Captures page — the most-used view. Server-side filter by type, session,
 * deletion status, and FTS5 search. Inline edit (type, content) and
 * soft-delete / restore actions via the write API.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { CAPTURE_TYPES } from "#src/runtime/capture/markers.js";
import { shell, escapeHtml, fmtRelative, fmtTs } from "./shell.js";

interface CaptureRow {
  readonly capture_id: number;
  readonly ts: number;
  readonly type: string;
  readonly content: string;
  readonly session_id: string;
  readonly file_paths: string | null;
  readonly workflow_id: string | null;
  readonly phase: string | null;
  readonly deleted_at: number | null;
}

interface ListFilters {
  readonly type: string | null;
  readonly session: string | null;
  readonly q: string | null;
  readonly trash: boolean;
  readonly limit: number;
}

function parseFilters(c: Context): ListFilters {
  const type = c.req.query("type") ?? null;
  const session = c.req.query("session") ?? null;
  const q = c.req.query("q")?.trim() ?? null;
  const trash = c.req.query("trash") === "1";
  const limitRaw = Number(c.req.query("limit") ?? "100");
  const limit = Math.min(500, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 100));
  return { type, session, q: q && q.length > 0 ? q : null, trash, limit };
}

function listCaptures(brain: BrainHandle, f: ListFilters): CaptureRow[] {
  const where: string[] = [f.trash ? "c.deleted_at IS NOT NULL" : "c.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (f.type) {
    where.push("c.type = ?");
    params.push(f.type);
  }
  if (f.session) {
    where.push("c.session_id = ?");
    params.push(f.session);
  }
  if (f.q) {
    // Use FTS5 if a search is provided. Fallback to LIKE on no-match.
    where.push(
      "c.capture_id IN (SELECT rowid FROM captures_fts WHERE captures_fts MATCH ? ORDER BY rank)",
    );
    params.push(f.q);
  }
  const sql = `
    SELECT c.capture_id, c.ts, c.type, c.content, c.session_id,
           c.file_paths, c.workflow_id, c.phase, c.deleted_at
    FROM captures c
    WHERE ${where.join(" AND ")}
    ORDER BY c.ts DESC
    LIMIT ?`;
  return brain.raw.prepare(sql).all(...params, f.limit) as CaptureRow[];
}

function distinctSessions(brain: BrainHandle): Array<{ session_id: string }> {
  return brain.raw
    .prepare(
      `SELECT DISTINCT session_id FROM captures
       ORDER BY session_id DESC LIMIT 50`,
    )
    .all() as Array<{ session_id: string }>;
}

function renderRow(cap: CaptureRow): string {
  const filePaths: string[] = cap.file_paths ? safeJsonArray(cap.file_paths) : [];
  const filesHtml = filePaths.length
    ? `<div class="mt-2 flex flex-wrap gap-1">${filePaths
        .map(
          (p) =>
            `<span class="text-xs font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">${escapeHtml(p)}</span>`,
        )
        .join("")}</div>`
    : "";
  const phaseTag =
    cap.workflow_id || cap.phase
      ? `<span class="text-xs text-slate-500 font-mono ml-2">${escapeHtml(cap.workflow_id ?? "")}${cap.phase ? `/${escapeHtml(cap.phase)}` : ""}</span>`
      : "";
  const deletedBadge = cap.deleted_at
    ? `<span class="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded ml-2">deleted ${fmtRelative(cap.deleted_at)}</span>`
    : "";
  const actions = cap.deleted_at
    ? `<button class="text-xs text-emerald-700 hover:underline"
         hx-post="/api/v1/captures/${cap.capture_id}/restore"
         hx-target="closest li"
         hx-swap="outerHTML">Restore</button>`
    : `<button class="text-xs text-slate-600 hover:underline"
         x-on:click="$dispatch('edit-capture', { id: ${cap.capture_id}, type: '${escapeHtml(cap.type)}', content: ${JSON.stringify(cap.content).replace(/'/g, "\\'")} })">
         Edit
       </button>
       <button class="text-xs text-rose-700 hover:underline ml-3"
         hx-delete="/api/v1/captures/${cap.capture_id}"
         hx-target="closest li"
         hx-swap="outerHTML"
         hx-confirm="Soft-delete this capture?">Delete</button>`;

  return `
    <li id="capture-${cap.capture_id}" class="rounded border border-slate-200 bg-white p-3 text-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center mb-1">
            <span class="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-mono">${escapeHtml(cap.type)}</span>
            <span class="ml-2 text-xs text-slate-500" title="${fmtTs(cap.ts)}">${fmtRelative(cap.ts)}</span>
            ${phaseTag}
            ${deletedBadge}
          </div>
          <p class="break-words">${escapeHtml(cap.content)}</p>
          ${filesHtml}
          <p class="mt-2 text-xs font-mono text-slate-400">session ${escapeHtml(cap.session_id)} · #${cap.capture_id}</p>
        </div>
        <div class="shrink-0 flex flex-col gap-2 items-end">${actions}</div>
      </div>
    </li>`;
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s) as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export function registerCaptures(app: Hono, brain: BrainHandle): void {
  app.get("/captures", (c: Context) => {
    const filters = parseFilters(c);
    const rows = listCaptures(brain, filters);
    const sessions = distinctSessions(brain);

    const typeOptions = [`<option value="">All types</option>`]
      .concat(
        CAPTURE_TYPES.map(
          (t) =>
            `<option value="${t}" ${filters.type === t ? "selected" : ""}>${escapeHtml(t)}</option>`,
        ),
      )
      .join("");

    const sessionOptions = [`<option value="">All sessions</option>`]
      .concat(
        sessions.map(
          (s) =>
            `<option value="${escapeHtml(s.session_id)}" ${
              filters.session === s.session_id ? "selected" : ""
            }>${escapeHtml(s.session_id.slice(0, 8))}…</option>`,
        ),
      )
      .join("");

    const trashLink = filters.trash
      ? `<a href="/captures" class="text-xs text-slate-600 hover:underline">← back to live</a>`
      : `<a href="/captures?trash=1" class="text-xs text-slate-500 hover:underline">view trash</a>`;

    const editModal = filters.trash
      ? ""
      : `
      <div x-data="{ open: false, id: null, type: '', content: '' }"
           x-on:edit-capture.window="open = true; id = $event.detail.id; type = $event.detail.type; content = $event.detail.content;"
           x-show="open"
           x-cloak
           class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 m-4" x-on:click.stop>
          <h3 class="text-lg font-semibold mb-4">Edit capture <span class="text-sm font-mono text-slate-500" x-text="'#' + id"></span></h3>
          <form x-on:submit.prevent="
              fetch('/api/v1/captures/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, content })
              }).then(() => { open = false; window.location.reload(); });
            ">
            <label class="block text-sm font-medium mb-1">Type</label>
            <select x-model="type" class="w-full mb-3 rounded border border-slate-300 px-3 py-2 text-sm">
              ${CAPTURE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
            </select>
            <label class="block text-sm font-medium mb-1">Content</label>
            <textarea x-model="content" rows="5" class="w-full mb-3 rounded border border-slate-300 px-3 py-2 text-sm font-mono"></textarea>
            <div class="flex gap-2 justify-end">
              <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300" x-on:click="open = false">Cancel</button>
              <button type="submit" class="px-3 py-1.5 text-sm rounded bg-slate-900 text-white">Save</button>
            </div>
          </form>
        </div>
      </div>`;

    const body = `
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Captures ${filters.trash ? '<span class="text-base text-amber-700">(trash)</span>' : ""}</h1>
        ${trashLink}
      </div>
      <form method="get" action="/captures" class="flex flex-wrap gap-2 mb-4">
        ${filters.trash ? `<input type="hidden" name="trash" value="1" />` : ""}
        <select name="type" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${typeOptions}</select>
        <select name="session" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${sessionOptions}</select>
        <input type="search" name="q" value="${escapeHtml(filters.q ?? "")}" placeholder="FTS search…"
          class="flex-1 min-w-[180px] rounded border border-slate-300 px-3 py-1.5 text-sm bg-white" />
        <button class="rounded bg-slate-900 text-white px-3 py-1.5 text-sm">Filter</button>
        <a href="/captures${filters.trash ? "?trash=1" : ""}" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">Reset</a>
      </form>
      <p class="text-xs text-slate-500 mb-3">Showing ${rows.length} of up to ${filters.limit} rows.</p>
      <ul class="space-y-2" id="captures-list">
        ${
          rows.length === 0
            ? '<li class="text-slate-500 text-sm">No captures match.</li>'
            : rows.map(renderRow).join("")
        }
      </ul>
      ${editModal}
    `;
    return c.html(shell({ title: "Captures", active: "/captures" }, body));
  });
}
