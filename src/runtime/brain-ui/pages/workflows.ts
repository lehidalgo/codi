/**
 * Workflows list + detail. Detail view renders the phase graph (parsed from
 * workflow_definitions.definition) as a Mermaid flowchart with the current
 * phase highlighted, plus the event log for that run.
 */

import type { Hono, Context } from "hono";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { shell, escapeHtml, fmtRelative, fmtTs } from "./shell.js";

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

interface PhaseDef {
  readonly gates?: string[];
  readonly next?: string[];
}

interface DefinitionDoc {
  readonly id?: string;
  readonly phases?: Record<string, PhaseDef>;
  readonly flags?: Record<string, unknown>;
}

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
                <a class="hover:underline" href="/workflow/${escapeHtml(r.workflow_id)}">${escapeHtml(r.workflow_id.slice(0, 12))}…</a>
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
    if (!run)
      return c.html(
        shell({ title: "Not found", active: "/workflows" }, "<p>Workflow not found.</p>"),
        404,
      );
    const events = brain.raw
      .prepare(
        `SELECT event_id, event_type, ts, payload FROM workflow_events WHERE workflow_id = ? ORDER BY ts ASC LIMIT 500`,
      )
      .all(id) as EventRow[];
    const def = loadDefinition(brain, run.type);
    const graph = renderMermaid(def, run.current_phase);

    const eventsHtml = events
      .map(
        (e) => `
        <li class="text-sm flex gap-2">
          <span class="font-mono text-xs text-slate-400 w-32 shrink-0" title="${fmtTs(e.ts)}">${fmtRelative(e.ts)}</span>
          <span class="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded">${escapeHtml(e.event_type)}</span>
          ${e.payload ? `<pre class="text-xs text-slate-600 flex-1 overflow-x-auto">${escapeHtml(e.payload.slice(0, 200))}${e.payload.length > 200 ? "…" : ""}</pre>` : ""}
        </li>`,
      )
      .join("");

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
        <h2 class="text-sm font-semibold mb-3">Phase graph</h2>
        ${graph}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="text-sm font-semibold mb-3">Events (${events.length})</h2>
        <ul class="space-y-2">${eventsHtml || '<li class="text-sm text-slate-500">No events.</li>'}</ul>
      </section>`;
    return c.html(shell({ title: `Workflow ${id}`, active: "/workflows", head }, body));
  });
}
