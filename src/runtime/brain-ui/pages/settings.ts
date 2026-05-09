/**
 * Settings panel — project metadata, brain DB info, backups list with
 * restore links into the external archive at ~/.codi/archive/.
 */

import type { Hono, Context } from "hono";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BrainHandle } from "#src/runtime/brain/index.js";
import { PROJECT_DIR, EXTERNAL_ARCHIVE_DIR, BACKUPS_DIR } from "#src/constants.js";
import { shell, escapeHtml, fmtRelative, fmtTs } from "./shell.js";

interface ProjectRow {
  readonly project_id: string;
  readonly repo_path: string;
  readonly git_remote: string | null;
  readonly name: string;
  readonly first_seen: number;
  readonly last_seen: number;
}

interface ArchiveEntry {
  readonly hash: string;
  readonly timestamp: string;
  readonly path: string;
  readonly size: number;
  readonly trigger: string;
}

function listProjectArchives(): ArchiveEntry[] {
  const root = join(homedir(), PROJECT_DIR, EXTERNAL_ARCHIVE_DIR);
  if (!existsSync(root)) return [];
  const out: ArchiveEntry[] = [];
  for (const hashDir of readdirSync(root)) {
    const hashPath = join(root, hashDir);
    if (!statSync(hashPath).isDirectory()) continue;
    for (const tsDir of readdirSync(hashPath)) {
      const dir = join(hashPath, tsDir);
      if (!statSync(dir).isDirectory()) continue;
      const manifestPath = join(dir, "backup-manifest.json");
      let trigger = "unknown";
      let size = 0;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          trigger?: string;
          files?: Array<{ path: string }>;
        };
        trigger = manifest.trigger ?? "unknown";
        for (const f of manifest.files ?? []) {
          try {
            size += statSync(join(dir, f.path)).size;
          } catch {
            /* missing files are tolerated */
          }
        }
      } catch {
        /* manifest unreadable — keep entry as best-effort */
      }
      out.push({ hash: hashDir, timestamp: tsDir, path: dir, size, trigger });
    }
  }
  out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return out;
}

function listLocalBackups(brain: BrainHandle): Array<{ ts: string; trigger: string }> {
  const root = brain.path
    .replace(/\/state\/brain\.db$/, `/${BACKUPS_DIR}`)
    .replace(/\/brain\.db$/, `/${BACKUPS_DIR}`);
  if (!existsSync(root)) return [];
  const out: Array<{ ts: string; trigger: string }> = [];
  for (const tsDir of readdirSync(root)) {
    const dir = join(root, tsDir);
    if (!statSync(dir).isDirectory()) continue;
    let trigger = "unknown";
    try {
      const manifest = JSON.parse(readFileSync(join(dir, "backup-manifest.json"), "utf8")) as {
        trigger?: string;
      };
      trigger = manifest.trigger ?? "unknown";
    } catch {
      /* unsealed backup */
    }
    out.push({ ts: tsDir, trigger });
  }
  out.sort((a, b) => b.ts.localeCompare(a.ts));
  return out;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function registerSettings(app: Hono, brain: BrainHandle): void {
  app.get("/settings", (c: Context) => {
    const project = brain.raw.prepare(`SELECT * FROM projects LIMIT 1`).get() as
      | ProjectRow
      | undefined;
    const versionRow = brain.raw
      .prepare(`SELECT MAX(version) as v FROM _codi_schema_version`)
      .get() as { v: number | null };
    let dbSize = 0;
    try {
      dbSize = statSync(brain.path).size;
    } catch {
      /* brand-new db */
    }
    const archives = listProjectArchives();
    const local = listLocalBackups(brain);

    const projectHtml = project
      ? `
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <dt class="text-slate-500">Name</dt><dd class="font-mono">${escapeHtml(project.name)}</dd>
          <dt class="text-slate-500">Repo path</dt><dd class="font-mono text-xs">${escapeHtml(project.repo_path)}</dd>
          <dt class="text-slate-500">Git remote</dt><dd class="font-mono text-xs">${escapeHtml(project.git_remote ?? "—")}</dd>
          <dt class="text-slate-500">First seen</dt><dd>${fmtRelative(project.first_seen)}</dd>
          <dt class="text-slate-500">Last seen</dt><dd>${fmtRelative(project.last_seen)}</dd>
        </dl>`
      : `<p class="text-sm text-slate-500">No project row yet.</p>`;

    const archivesHtml = archives.length
      ? `<ul class="space-y-2">${archives
          .map(
            (a) => `
          <li class="text-sm flex items-center gap-3">
            <span class="text-xs font-mono text-slate-400 w-32 shrink-0">${escapeHtml(a.hash.slice(0, 16))}</span>
            <span class="font-mono text-xs flex-1 truncate">${escapeHtml(a.timestamp)}</span>
            <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(a.trigger)}</span>
            <span class="text-xs text-slate-500 tabular-nums w-20 text-right">${fmtBytes(a.size)}</span>
          </li>`,
          )
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No external archives yet. <code>codi clean --all</code> creates one before wiping.</p>`;

    const localHtml = local.length
      ? `<ul class="space-y-1.5 text-sm">${local
          .map(
            (b) =>
              `<li class="flex gap-3"><span class="font-mono text-xs flex-1">${escapeHtml(b.ts)}</span><span class="text-xs px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(b.trigger)}</span></li>`,
          )
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No local backups.</p>`;

    const body = `
      <h1 class="text-2xl font-semibold mb-4">Settings</h1>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Project</h2>
        ${projectHtml}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Brain DB</h2>
        <dl class="grid grid-cols-2 gap-2 text-sm">
          <dt class="text-slate-500">Path</dt><dd class="font-mono text-xs break-all">${escapeHtml(brain.path)}</dd>
          <dt class="text-slate-500">Schema version</dt><dd class="tabular-nums">${versionRow.v ?? 0}</dd>
          <dt class="text-slate-500">Size</dt><dd class="tabular-nums">${fmtBytes(dbSize)}</dd>
          <dt class="text-slate-500">Last access</dt><dd>${fmtTs(Date.now())}</dd>
        </dl>
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
        <h2 class="text-sm font-semibold mb-3">Local backups (.codi/backups/)</h2>
        ${localHtml}
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="text-sm font-semibold mb-3">External archives (~/.codi/archive/)</h2>
        ${archivesHtml}
      </section>`;
    return c.html(shell({ title: "Settings", active: "/settings" }, body));
  });
}
