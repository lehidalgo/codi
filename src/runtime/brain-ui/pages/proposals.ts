/**
 * Proposals page — consolidation pipeline output. List + filter +
 * accept / reject / delete with elegant icon buttons and 2-step modal
 * confirmation, mirroring the pattern used on the captures page.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { shell, escapeHtml, fmtRelative, fmtTs } from "./shell.js";

interface ProposalRow {
  readonly proposal_id: number;
  readonly pattern_code: string;
  readonly proposal_type: string;
  readonly artifact_kind: string | null;
  readonly artifact_name: string | null;
  readonly title: string;
  readonly rationale: string;
  readonly patch_json: string | null;
  readonly evidence_json: string;
  readonly status: string;
  readonly created_at: number;
  readonly decided_at: number | null;
  readonly decision_reason: string | null;
  readonly deleted_at: number | null;
}

// ─── Icon button helpers ──────────────────────────────────────────────

const ACCEPT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const REJECT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;
const RESTORE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>`;

function iconBtn(label: string, color: string, body: string, attrs: string): string {
  return `<button type="button"
    class="inline-flex items-center justify-center w-7 h-7 rounded ${color} hover:bg-slate-100 transition-colors"
    title="${escapeHtml(label)}"
    aria-label="${escapeHtml(label)}"
    ${attrs}>
    ${body}
  </button>`;
}

// ─── Status & evidence ────────────────────────────────────────────────

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function badgeForStatus(status: string): string {
  const cls =
    {
      pending: "bg-amber-100 text-amber-800",
      accepted: "bg-emerald-100 text-emerald-800",
      rejected: "bg-rose-100 text-rose-800",
    }[status] ?? "bg-slate-100 text-slate-800";
  return `<span class="text-xs px-1.5 py-0.5 rounded ${cls}">${escapeHtml(status)}</span>`;
}

// ─── Row renderer ─────────────────────────────────────────────────────

function renderProposalRow(p: ProposalRow): string {
  const evidence = safeJson(p.evidence_json);
  const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
  const previewSafe = escapeHtml(p.title.slice(0, 80));

  let actions = "";
  if (p.deleted_at !== null) {
    actions = iconBtn(
      "Restore",
      "text-emerald-700",
      RESTORE_ICON,
      `data-proposal-id="${p.proposal_id}" x-on:click="$dispatch('restore-proposal', { id: $event.currentTarget.dataset.proposalId })"`,
    );
  } else if (p.status === "pending") {
    actions = `${iconBtn(
      "Accept",
      "text-emerald-700 hover:text-emerald-800",
      ACCEPT_ICON,
      `data-proposal-id="${p.proposal_id}" data-proposal-preview="${previewSafe}" x-on:click="$dispatch('accept-proposal', { id: $event.currentTarget.dataset.proposalId, preview: $event.currentTarget.dataset.proposalPreview })"`,
    )}
       ${iconBtn(
         "Reject",
         "text-rose-600 hover:text-rose-700",
         REJECT_ICON,
         `data-proposal-id="${p.proposal_id}" data-proposal-preview="${previewSafe}" x-on:click="$dispatch('reject-proposal', { id: $event.currentTarget.dataset.proposalId, preview: $event.currentTarget.dataset.proposalPreview })"`,
       )}
       ${iconBtn(
         "Delete",
         "text-slate-500 hover:text-slate-700",
         DELETE_ICON,
         `data-proposal-id="${p.proposal_id}" data-proposal-preview="${previewSafe}" x-on:click="$dispatch('delete-proposal', { id: $event.currentTarget.dataset.proposalId, preview: $event.currentTarget.dataset.proposalPreview })"`,
       )}`;
  } else {
    actions = iconBtn(
      "Delete",
      "text-slate-500 hover:text-slate-700",
      DELETE_ICON,
      `data-proposal-id="${p.proposal_id}" data-proposal-preview="${previewSafe}" x-on:click="$dispatch('delete-proposal', { id: $event.currentTarget.dataset.proposalId, preview: $event.currentTarget.dataset.proposalPreview })"`,
    );
  }

  return `
    <li id="proposal-${p.proposal_id}" class="rounded border border-slate-200 bg-white p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 text-xs">
            <span class="font-mono px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(p.pattern_code)}</span>
            <span class="font-mono px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(p.proposal_type)}</span>
            ${badgeForStatus(p.status)}
            <span class="text-slate-400" title="${fmtTs(p.created_at)}">${fmtRelative(p.created_at)}</span>
          </div>
          <p class="font-semibold text-sm">${escapeHtml(p.title)}</p>
          <p class="text-sm text-slate-700 mt-1">${escapeHtml(p.rationale)}</p>
          ${p.artifact_name ? `<p class="text-xs font-mono text-slate-500 mt-1">${escapeHtml(p.artifact_kind ?? "")}/${escapeHtml(p.artifact_name)}</p>` : ""}
          ${p.decision_reason ? `<p class="text-xs italic text-slate-500 mt-1">decided: ${escapeHtml(p.decision_reason)}</p>` : ""}
          <details class="mt-2">
            <summary class="text-xs text-slate-500 cursor-pointer">${evidenceCount} evidence rows</summary>
            <pre class="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">${escapeHtml(JSON.stringify(evidence, null, 2))}</pre>
          </details>
          ${p.patch_json ? `<details class="mt-1"><summary class="text-xs text-slate-500 cursor-pointer">patch</summary><pre class="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">${escapeHtml(p.patch_json)}</pre></details>` : ""}
        </div>
        <div class="shrink-0 flex gap-1 items-start">${actions}</div>
      </div>
    </li>`;
}

// ─── Modals (Alpine, shared across all rows) ──────────────────────────

const DECIDE_MODAL = `
<div x-data="proposalDecider()"
     x-on:accept-proposal.window="open('accept', $event.detail.id, $event.detail.preview)"
     x-on:reject-proposal.window="open('reject', $event.detail.id, $event.detail.preview)"
     x-show="visible"
     x-cloak
     class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
  <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" x-on:click.stop>
    <div class="flex items-start gap-3 mb-4">
      <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
           :class="kind === 'accept' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" x-show="kind === 'accept'"><polyline points="20 6 9 17 4 12"/></svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" x-show="kind === 'reject'"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-base font-semibold text-slate-900"
            x-text="kind === 'accept'
              ? (step === 1 ? 'Accept this proposal?' : 'Confirm acceptance')
              : (step === 1 ? 'Reject this proposal?' : 'Confirm rejection')"></h3>
        <p class="text-sm text-slate-600 mt-1" x-show="step === 1 && kind === 'accept'">Marks the proposal as accepted. Apply the suggested patch separately if it has one.</p>
        <p class="text-sm text-slate-600 mt-1" x-show="step === 1 && kind === 'reject'">Marks the proposal as rejected. Add a reason so future runs know why.</p>
        <p class="text-sm text-slate-600 mt-1" x-show="step === 2">Last chance — this is the second confirmation.</p>
        <p class="mt-2 text-xs font-mono text-slate-500 truncate" x-text="'#' + id + ' · ' + (preview || '(no title)')"></p>
      </div>
    </div>
    <label class="block text-xs font-medium text-slate-600 mb-1">Reason (optional)</label>
    <textarea x-model="reason" rows="2" placeholder="Why?"
      class="w-full mb-4 rounded border border-slate-300 px-3 py-2 text-sm"></textarea>
    <div class="flex justify-end gap-2">
      <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50" x-on:click="cancel()">Cancel</button>
      <button type="button"
        class="px-3 py-1.5 text-sm rounded text-white"
        :class="kind === 'accept'
          ? (step === 1 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-300')
          : (step === 1 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-300')"
        :disabled="working"
        x-on:click="advance()"
        x-text="working
          ? (kind === 'accept' ? 'Accepting…' : 'Rejecting…')
          : (step === 1 ? 'Continue' : (kind === 'accept' ? 'Accept' : 'Reject'))"></button>
    </div>
  </div>
</div>
<script>
  function proposalDecider() {
    return {
      visible: false,
      kind: 'accept',
      step: 1,
      working: false,
      id: null,
      preview: '',
      reason: '',
      open(kind, id, preview) {
        this.kind = kind;
        this.id = id;
        this.preview = preview || '';
        this.step = 1;
        this.working = false;
        this.reason = '';
        this.visible = true;
      },
      cancel() {
        this.visible = false;
        this.step = 1;
      },
      async advance() {
        if (this.step === 1) { this.step = 2; return; }
        this.working = true;
        try {
          await fetch('/api/v1/proposals/' + this.id + '/' + this.kind, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.reason ? { reason: this.reason } : {}),
          });
          this.visible = false;
          window.location.reload();
        } finally {
          this.working = false;
        }
      },
    };
  }
</script>`;

const DELETE_MODAL = `
<div x-data="proposalDeleter()"
     x-on:delete-proposal.window="open($event.detail.id, $event.detail.preview)"
     x-on:restore-proposal.window="restore($event.detail.id)"
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
        <h3 class="text-base font-semibold text-slate-900" x-text="step === 1 ? 'Soft-delete this proposal?' : 'Confirm deletion'"></h3>
        <p class="text-sm text-slate-600 mt-1" x-show="step === 1">The row will be hidden but kept in the trash. You can restore it later.</p>
        <p class="text-sm text-slate-600 mt-1" x-show="step === 2">Last chance — this is the second confirmation.</p>
        <p class="mt-2 text-xs font-mono text-slate-500 truncate" x-text="'#' + id + ' · ' + (preview || '(no title)')"></p>
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
  function proposalDeleter() {
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
        if (this.step === 1) { this.step = 2; return; }
        this.working = true;
        try {
          await fetch('/api/v1/proposals/' + this.id, { method: 'DELETE' });
          this.visible = false;
          window.location.reload();
        } finally {
          this.working = false;
        }
      },
      async restore(id) {
        try {
          await fetch('/api/v1/proposals/' + id + '/restore', { method: 'POST' });
          window.location.reload();
        } catch (e) {
          // ignore — page reloads anyway on success
        }
      },
    };
  }
</script>`;

// ─── Route ────────────────────────────────────────────────────────────

export function registerProposals(app: Hono, brain: BrainHandle): void {
  app.get("/proposals", (c: Context) => {
    const status = c.req.query("status") ?? null;
    const pattern = c.req.query("pattern") ?? null;
    const trash = c.req.query("trash") === "1";
    const where: string[] = [trash ? "deleted_at IS NOT NULL" : "deleted_at IS NULL"];
    const params: unknown[] = [];
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    if (pattern) {
      where.push("pattern_code = ?");
      params.push(pattern);
    }
    const rows = brain.raw
      .prepare(
        `SELECT * FROM proposals WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 200`,
      )
      .all(...params) as ProposalRow[];

    const distinctStatus = brain.raw
      .prepare(`SELECT DISTINCT status FROM proposals WHERE deleted_at IS NULL ORDER BY status`)
      .all() as Array<{ status: string }>;
    const distinctPattern = brain.raw
      .prepare(
        `SELECT DISTINCT pattern_code FROM proposals WHERE deleted_at IS NULL ORDER BY pattern_code`,
      )
      .all() as Array<{ pattern_code: string }>;

    const statusOpts = [`<option value="">All statuses</option>`]
      .concat(
        distinctStatus.map(
          (s) =>
            `<option value="${s.status}" ${status === s.status ? "selected" : ""}>${escapeHtml(s.status)}</option>`,
        ),
      )
      .join("");
    const patternOpts = [`<option value="">All patterns</option>`]
      .concat(
        distinctPattern.map(
          (p) =>
            `<option value="${p.pattern_code}" ${pattern === p.pattern_code ? "selected" : ""}>${escapeHtml(p.pattern_code)}</option>`,
        ),
      )
      .join("");

    const rowsHtml = rows.map(renderProposalRow).join("");

    const trashLink = trash
      ? `<a href="/proposals" class="text-xs text-slate-600 hover:underline">← back to live</a>`
      : `<a href="/proposals?trash=1" class="text-xs text-slate-500 hover:underline">view trash</a>`;

    const body = `
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">Proposals ${trash ? '<span class="text-base text-amber-700">(trash)</span>' : ""}</h1>
        ${trashLink}
      </div>
      <form method="get" class="flex flex-wrap gap-2 mb-3">
        ${trash ? `<input type="hidden" name="trash" value="1" />` : ""}
        <select name="status" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${statusOpts}</select>
        <select name="pattern" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">${patternOpts}</select>
        <button class="rounded bg-slate-900 text-white px-3 py-1.5 text-sm">Filter</button>
        <a href="/proposals${trash ? "?trash=1" : ""}" class="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white">Reset</a>
      </form>
      <p class="text-xs text-slate-500 mb-3">${rows.length} proposals shown.</p>
      <div x-data="{}">
        <ul class="space-y-3">${rowsHtml || '<li class="text-sm text-slate-500">No proposals.</li>'}</ul>
        ${trash ? "" : DECIDE_MODAL}
        ${DELETE_MODAL}
      </div>`;
    return c.html(shell({ title: "Proposals", active: "/proposals" }, body));
  });
}
