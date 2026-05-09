/**
 * Proposals page — consolidation pipeline output. List + filter + bulk
 * accept / reject. Detail panel shows rationale, evidence, and patch
 * preview when present.
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

    const rowsHtml = rows
      .map((p) => {
        const evidence = safeJson(p.evidence_json);
        const evidenceCount = Array.isArray(evidence) ? evidence.length : 0;
        const statusBadge = badgeForStatus(p.status);
        const actions =
          p.deleted_at !== null
            ? `<button class="text-xs text-emerald-700 hover:underline"
                 hx-post="/api/v1/proposals/${p.proposal_id}/restore"
                 hx-target="closest li" hx-swap="outerHTML">Restore</button>`
            : p.status === "pending"
              ? `<button class="text-xs text-emerald-700 hover:underline"
                   hx-post="/api/v1/proposals/${p.proposal_id}/accept"
                   hx-target="closest li" hx-swap="outerHTML"
                   hx-confirm="Accept this proposal?">Accept</button>
                 <button class="text-xs text-rose-700 hover:underline ml-3"
                   hx-post="/api/v1/proposals/${p.proposal_id}/reject"
                   hx-target="closest li" hx-swap="outerHTML"
                   hx-confirm="Reject this proposal?">Reject</button>
                 <button class="text-xs text-slate-500 hover:underline ml-3"
                   hx-delete="/api/v1/proposals/${p.proposal_id}"
                   hx-target="closest li" hx-swap="outerHTML"
                   hx-confirm="Soft-delete?">Delete</button>`
              : `<button class="text-xs text-slate-500 hover:underline"
                   hx-delete="/api/v1/proposals/${p.proposal_id}"
                   hx-target="closest li" hx-swap="outerHTML"
                   hx-confirm="Soft-delete?">Delete</button>`;

        return `
        <li class="rounded border border-slate-200 bg-white p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 text-xs">
                <span class="font-mono px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(p.pattern_code)}</span>
                <span class="font-mono px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(p.proposal_type)}</span>
                ${statusBadge}
                <span class="text-slate-400" title="${fmtTs(p.created_at)}">${fmtRelative(p.created_at)}</span>
              </div>
              <p class="font-semibold text-sm">${escapeHtml(p.title)}</p>
              <p class="text-sm text-slate-700 mt-1">${escapeHtml(p.rationale)}</p>
              ${p.artifact_name ? `<p class="text-xs font-mono text-slate-500 mt-1">${escapeHtml(p.artifact_kind ?? "")}/${escapeHtml(p.artifact_name)}</p>` : ""}
              <details class="mt-2">
                <summary class="text-xs text-slate-500 cursor-pointer">${evidenceCount} evidence rows</summary>
                <pre class="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">${escapeHtml(JSON.stringify(evidence, null, 2))}</pre>
              </details>
              ${p.patch_json ? `<details class="mt-1"><summary class="text-xs text-slate-500 cursor-pointer">patch</summary><pre class="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">${escapeHtml(p.patch_json)}</pre></details>` : ""}
            </div>
            <div class="shrink-0 flex flex-col gap-1 items-end">${actions}</div>
          </div>
        </li>`;
      })
      .join("");

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
      <ul class="space-y-3">${rowsHtml || '<li class="text-sm text-slate-500">No proposals.</li>'}</ul>`;
    return c.html(shell({ title: "Proposals", active: "/proposals" }, body));
  });
}

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
