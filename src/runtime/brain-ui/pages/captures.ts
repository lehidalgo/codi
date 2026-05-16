/**
 * Captures page — the most-used view. Server-side filter by type, session,
 * deletion status, and FTS5 search. Inline edit (type, content) and
 * soft-delete / restore actions via the write API.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/db.js";
import { quoteFtsPhrase } from "#src/runtime/brain/fts5.js";
import { CAPTURE_TYPES } from "#src/runtime/capture/markers.js";
import { shell, escapeHtml, fmtRelative, fmtTs, renderMarkdown } from "./shell.js";

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
    // ISSUE-060: quote-wrap user input so FTS5 treats it as a literal phrase.
    // Without this, special tokens (AND/OR/NOT, parens, *, -) either trigger
    // syntax errors or trigger unintended boolean semantics.
    where.push(
      "c.capture_id IN (SELECT rowid FROM captures_fts WHERE captures_fts MATCH ? ORDER BY rank)",
    );
    params.push(quoteFtsPhrase(f.q));
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
  const iconBtn = (label: string, color: string, body: string, attrs: string): string => `
    <button type="button"
      class="inline-flex items-center justify-center w-7 h-7 rounded ${color} hover:bg-slate-100 transition-colors"
      title="${label}"
      aria-label="${label}"
      ${attrs}>
      ${body}
    </button>`;
  const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
  const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
  const restoreIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>`;

  const actions = cap.deleted_at
    ? iconBtn(
        "Restore",
        "text-emerald-700",
        restoreIcon,
        `hx-post="/api/v1/captures/${cap.capture_id}/restore" hx-target="closest li" hx-swap="outerHTML"`,
      )
    : `${iconBtn(
        "Edit",
        "text-slate-500 hover:text-slate-900",
        editIcon,
        `data-capture-id="${cap.capture_id}" x-on:click="$dispatch('edit-capture', { id: $event.currentTarget.dataset.captureId })"`,
      )}
       ${iconBtn(
         "Delete",
         "text-rose-600 hover:text-rose-700",
         deleteIcon,
         `data-capture-id="${cap.capture_id}" data-capture-preview="${escapeHtml(cap.content.slice(0, 80))}" x-on:click="$dispatch('delete-capture', { id: $event.currentTarget.dataset.captureId, preview: $event.currentTarget.dataset.capturePreview })"`,
       )}`;

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
          ${renderMarkdown(cap.content)}
          ${filesHtml}
          <p class="mt-2 text-xs font-mono text-slate-400">
            <a class="hover:underline hover:text-slate-700" href="/capture/${cap.capture_id}">#${cap.capture_id}</a>
            · session
            <a class="hover:underline hover:text-slate-700" href="/session/${escapeHtml(cap.session_id)}#capture-${cap.capture_id}">${escapeHtml(cap.session_id.slice(0, 12))}…</a>
          </p>
        </div>
        <div class="shrink-0 flex gap-1 items-start">${actions}</div>
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

interface FullCaptureRow extends CaptureRow {
  readonly raw_marker: string;
  readonly prompt_id: number;
  readonly turn_id: number;
}

export function registerCaptures(app: Hono, brain: BrainHandle): void {
  app.get("/capture/:id", (c: Context) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) {
      return c.html(
        shell({ title: "Bad request", active: "/captures" }, "<p>Invalid id.</p>"),
        400,
      );
    }
    const cap = brain.raw
      .prepare(
        `SELECT capture_id, session_id, prompt_id, turn_id, ts, type, content,
                raw_marker, file_paths, workflow_id, phase, deleted_at
         FROM captures WHERE capture_id = ?`,
      )
      .get(id) as FullCaptureRow | undefined;
    if (!cap) {
      return c.html(
        shell({ title: "Not found", active: "/captures" }, "<p>Capture not found.</p>"),
        404,
      );
    }
    const filePaths = cap.file_paths ? safeJsonArray(cap.file_paths) : [];
    const filesHtml = filePaths.length
      ? `<div class="flex flex-wrap gap-1 mt-2">${filePaths
          .map(
            (p) =>
              `<span class="text-xs font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-700">${escapeHtml(p)}</span>`,
          )
          .join("")}</div>`
      : "";
    const body = `
      <div class="flex items-center justify-between mb-3">
        <a class="text-xs text-slate-500 hover:underline" href="/captures">← all captures</a>
        <a class="text-xs text-slate-600 hover:underline" href="/session/${escapeHtml(cap.session_id)}#capture-${cap.capture_id}">→ session timeline</a>
      </div>
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs font-mono">${escapeHtml(cap.type)}</span>
        <span class="text-xs text-slate-500" title="${fmtTs(cap.ts)}">${fmtRelative(cap.ts)}</span>
        ${cap.workflow_id ? `<span class="text-xs font-mono text-slate-500">${escapeHtml(cap.workflow_id)}${cap.phase ? `/${escapeHtml(cap.phase)}` : ""}</span>` : ""}
        ${cap.deleted_at ? `<span class="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">deleted ${fmtRelative(cap.deleted_at)}</span>` : ""}
      </div>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Content</h2>
        ${renderMarkdown(cap.content)}
        ${filesHtml}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Raw marker</h2>
        <pre class="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">${escapeHtml(cap.raw_marker)}</pre>
      </section>
      <p class="text-xs text-slate-500">
        session <a class="font-mono hover:underline" href="/session/${escapeHtml(cap.session_id)}">${escapeHtml(cap.session_id.slice(0, 12))}…</a>
        · prompt #${cap.prompt_id} · turn #${cap.turn_id} · capture #${cap.capture_id}
      </p>`;
    return c.html(shell({ title: `Capture #${cap.capture_id}`, active: "/captures" }, body));
  });

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
      <div x-data="captureEditor()"
           x-on:edit-capture.window="load($event.detail.id)"
           x-show="open"
           x-cloak
           class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 m-4 max-h-[90vh] overflow-auto" x-on:click.stop>
          <h3 class="text-lg font-semibold mb-4">Edit capture <span class="text-sm font-mono text-slate-500" x-text="'#' + id"></span></h3>
          <template x-if="loading"><p class="text-slate-500 text-sm">Loading…</p></template>
          <form x-show="!loading" x-on:submit.prevent="save()">
            <label class="block text-sm font-medium mb-1">Type</label>
            <select x-model="type" class="w-full mb-3 rounded border border-slate-300 px-3 py-2 text-sm">
              ${CAPTURE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
            </select>
            <label class="block text-sm font-medium mb-1">Content</label>
            <textarea x-model="content" rows="10" class="w-full mb-3 rounded border border-slate-300 px-3 py-2 text-sm font-mono"></textarea>
            <div class="flex gap-2 justify-end">
              <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300" x-on:click="open = false">Cancel</button>
              <button type="submit" class="px-3 py-1.5 text-sm rounded bg-slate-900 text-white" :disabled="saving" x-text="saving ? 'Saving…' : 'Save'">Save</button>
            </div>
          </form>
        </div>
      </div>
      <script>
        function captureEditor() {
          return {
            open: false,
            loading: false,
            saving: false,
            id: null,
            type: '',
            content: '',
            async load(id) {
              this.id = id;
              this.open = true;
              this.loading = true;
              try {
                const r = await fetch('/api/v1/captures/' + id);
                const j = await r.json();
                const data = j.data || j;
                this.type = data.type || '';
                this.content = data.content || '';
              } finally {
                this.loading = false;
              }
            },
            async save() {
              this.saving = true;
              try {
                await fetch('/api/v1/captures/' + this.id, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: this.type, content: this.content }),
                });
                this.open = false;
                window.location.reload();
              } finally {
                this.saving = false;
              }
            },
          };
        }
      </script>`;

    const deleteModal = filters.trash
      ? ""
      : `
      <div x-data="captureDeleter()"
           x-on:delete-capture.window="open($event.detail.id, $event.detail.preview)"
           x-show="visible"
           x-cloak
           class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" x-on:click.stop>
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-slate-900" x-text="step === 1 ? 'Soft-delete this capture?' : 'Confirm deletion'"></h3>
              <p class="text-sm text-slate-600 mt-1" x-show="step === 1">The row will be hidden but kept in the trash. You can restore it later.</p>
              <p class="text-sm text-slate-600 mt-1" x-show="step === 2">Last chance — this is the second confirmation.</p>
              <p class="mt-2 text-xs font-mono text-slate-500 truncate" x-text="'#' + id + ' · ' + (preview || '(empty)')"></p>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50" x-on:click="cancel()">Cancel</button>
            <button type="button"
              class="px-3 py-1.5 text-sm rounded text-white"
              :class="step === 1 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-300'"
              :disabled="working"
              x-on:click="advance()"
              x-text="working ? 'Deleting…' : (step === 1 ? 'Continue' : 'Delete forever')"></button>
          </div>
        </div>
      </div>
      <script>
        function captureDeleter() {
          return {
            visible: false,
            step: 1,
            working: false,
            id: null,
            preview: '',
            open(id, preview) {
              this.id = id;
              this.preview = preview || '';
              this.step = 1;
              this.working = false;
              this.visible = true;
            },
            cancel() {
              this.visible = false;
              this.step = 1;
            },
            async advance() {
              if (this.step === 1) {
                this.step = 2;
                return;
              }
              this.working = true;
              try {
                await fetch('/api/v1/captures/' + this.id, { method: 'DELETE' });
                this.visible = false;
                window.location.reload();
              } finally {
                this.working = false;
              }
            },
          };
        }
      </script>`;

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
      <div x-data="{}">
        <ul class="space-y-2" id="captures-list">
          ${
            rows.length === 0
              ? '<li class="text-slate-500 text-sm">No captures match.</li>'
              : rows.map(renderRow).join("")
          }
        </ul>
        ${editModal}
        ${deleteModal}
      </div>
    `;
    return c.html(shell({ title: "Captures", active: "/captures" }, body));
  });
}
