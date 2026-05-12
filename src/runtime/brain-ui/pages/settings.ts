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

// Backup ID validators — duplicated from routes-api.ts (intentional; 2 callsites do not warrant a shared module).
// Must match backup-manager.ts formats: timestamp = ISO with `:` and `.` replaced by `-`; hash = 16-hex + slug.
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
const HASH_RE = /^[a-f0-9]{16}-[A-Za-z0-9._-]+$/;

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

    const restoreIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>`;
    const inspectIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    const restoreBtn = (scope: string, id: string, ts: string): string => `
      <button type="button"
        class="inline-flex items-center justify-center w-7 h-7 rounded text-emerald-700 hover:bg-emerald-50 transition-colors"
        title="Restore this backup"
        aria-label="Restore"
        x-on:click.stop="$dispatch('restore-backup', { scope: '${scope}', id: '${escapeHtml(id)}', ts: '${escapeHtml(ts)}' })">
        ${restoreIcon}
      </button>`;

    const archivesHtml = archives.length
      ? `<ul class="divide-y divide-slate-100">${archives
          .map((a) => {
            const href = `/backup/archive/${encodeURIComponent(a.hash)}/${encodeURIComponent(a.timestamp)}`;
            return `
          <li class="text-sm flex items-center gap-3 hover:bg-slate-50 px-2 py-2 rounded transition-colors">
            <a class="flex-1 min-w-0 flex items-center gap-3" href="${href}">
              <span class="text-xs font-mono text-slate-400 w-32 shrink-0 truncate">${escapeHtml(a.hash.slice(0, 16))}</span>
              <span class="font-mono text-xs flex-1 truncate">${escapeHtml(a.timestamp)}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(a.trigger)}</span>
              <span class="text-xs text-slate-500 tabular-nums w-20 text-right">${fmtBytes(a.size)}</span>
            </a>
            <a class="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100" href="${href}" title="Inspect" aria-label="Inspect">${inspectIcon}</a>
            ${restoreBtn("archive", a.hash, a.timestamp)}
          </li>`;
          })
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No external archives yet. <code>codi clean --all</code> creates one before wiping.</p>`;

    const localHtml = local.length
      ? `<ul class="divide-y divide-slate-100">${local
          .map((b) => {
            const href = `/backup/local/${encodeURIComponent(b.ts)}`;
            return `
          <li class="flex items-center gap-3 hover:bg-slate-50 px-2 py-2 rounded transition-colors">
            <a class="flex-1 min-w-0 flex items-center gap-3" href="${href}">
              <span class="font-mono text-xs flex-1 truncate">${escapeHtml(b.ts)}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100">${escapeHtml(b.trigger)}</span>
            </a>
            <a class="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-slate-100" href="${href}" title="Inspect" aria-label="Inspect">${inspectIcon}</a>
            ${restoreBtn("local", "", b.ts)}
          </li>`;
          })
          .join("")}</ul>`
      : `<p class="text-sm text-slate-500">No local backups.</p>`;

    const restoreModal = `
      <div x-data="restorer()"
           x-on:restore-backup.window="open($event.detail.scope, $event.detail.id, $event.detail.ts)"
           x-show="visible"
           x-cloak
           class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" x-on:click.stop>
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-slate-900" x-text="step === 1 ? 'Restore from this checkpoint?' : 'Confirm restore'"></h3>
              <p class="text-sm text-slate-600 mt-1" x-show="step === 1">Files in the snapshot will be copied back over the current project state. Existing files NOT in the snapshot are kept intact.</p>
              <p class="text-sm text-slate-600 mt-1" x-show="step === 2">Last chance — second confirmation. Brain UI will be unresponsive briefly while the copy runs.</p>
              <p class="mt-2 text-xs font-mono text-slate-500 truncate" x-text="scope + ' · ' + (id ? id.slice(0,16) + '/' : '') + ts"></p>
            </div>
          </div>
          <div x-show="result" class="rounded bg-emerald-50 text-emerald-900 text-sm p-3 mb-3" x-text="result"></div>
          <div x-show="error" class="rounded bg-rose-50 text-rose-900 text-sm p-3 mb-3" x-text="error"></div>
          <div class="flex justify-end gap-2">
            <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50" x-on:click="cancel()" x-text="result ? 'Close' : 'Cancel'">Cancel</button>
            <button type="button"
              class="px-3 py-1.5 text-sm rounded text-white"
              :class="step === 1 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-300'"
              :disabled="working || result"
              x-show="!result"
              x-on:click="advance()"
              x-text="working ? 'Restoring…' : (step === 1 ? 'Continue' : 'Restore now')"></button>
          </div>
        </div>
      </div>
      <script>
        function restorer() {
          return {
            visible: false, step: 1, working: false, result: null, error: null,
            scope: '', id: '', ts: '',
            open(scope, id, ts) {
              this.scope = scope; this.id = id; this.ts = ts;
              this.step = 1; this.working = false; this.result = null; this.error = null;
              this.visible = true;
            },
            cancel() { this.visible = false; },
            async advance() {
              if (this.step === 1) { this.step = 2; return; }
              this.working = true; this.error = null;
              try {
                const url = this.scope === 'archive'
                  ? '/api/v1/backups/archive/' + encodeURIComponent(this.id) + '/' + encodeURIComponent(this.ts) + '/restore'
                  : '/api/v1/backups/local/' + encodeURIComponent(this.ts) + '/restore';
                const r = await fetch(url, { method: 'POST' });
                const j = await r.json();
                if (!r.ok) { this.error = j.error?.message || 'Restore failed'; return; }
                this.result = 'Restored ' + (j.data?.restored?.length || 0) + ' files. Reload pages that read .codi/.';
              } catch (e) {
                this.error = String(e);
              } finally {
                this.working = false;
              }
            },
          };
        }
      </script>`;

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
      <div x-data="{}">
        <section class="rounded-lg border border-slate-200 bg-white p-5 mb-5">
          <h2 class="text-sm font-semibold mb-3">Local backups (.codi/backups/)</h2>
          ${localHtml}
        </section>
        <section class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold mb-3">External archives (~/.codi/archive/)</h2>
          ${archivesHtml}
        </section>
        ${restoreModal}
      </div>`;
    return c.html(shell({ title: "Settings", active: "/settings" }, body));
  });

  app.get("/backup/local/:ts", (c: Context) => {
    const ts = decodeURIComponent(c.req.param("ts") ?? "");
    if (!TS_RE.test(ts)) {
      return c.html(renderInvalidBackupId(), 400);
    }
    const dir = brain.path
      .replace(/\/state\/brain\.db$/, `/${BACKUPS_DIR}/${ts}`)
      .replace(/\/brain\.db$/, `/${BACKUPS_DIR}/${ts}`);
    return c.html(renderBackupDetail("local", { ts }, dir));
  });

  app.get("/backup/archive/:hash/:ts", (c: Context) => {
    const hash = decodeURIComponent(c.req.param("hash") ?? "");
    const ts = decodeURIComponent(c.req.param("ts") ?? "");
    if (!HASH_RE.test(hash) || !TS_RE.test(ts)) {
      return c.html(renderInvalidBackupId(), 400);
    }
    const dir = join(homedir(), PROJECT_DIR, EXTERNAL_ARCHIVE_DIR, hash, ts);
    return c.html(renderBackupDetail("archive", { hash, ts }, dir));
  });
}

function renderInvalidBackupId(): string {
  return shell(
    { title: "Invalid backup ID", active: "/settings" },
    `<a class="text-xs text-slate-500 hover:underline" href="/settings">← settings</a>
     <h1 class="text-2xl font-semibold mt-2 mb-2">Invalid backup ID</h1>
     <p class="text-sm text-slate-500">The requested backup identifier is not in the expected format.</p>`,
  );
}

interface BackupKey {
  readonly hash?: string;
  readonly ts: string;
}

function renderBackupDetail(scope: "local" | "archive", key: BackupKey, dir: string): string {
  if (!existsSync(dir)) {
    return shell(
      { title: "Backup not found", active: "/settings" },
      `<a class="text-xs text-slate-500 hover:underline" href="/settings">← settings</a>
       <h1 class="text-2xl font-semibold mt-2 mb-2">Backup not found</h1>
       <p class="text-sm text-slate-500">No directory at <code class="text-xs">${escapeHtml(dir)}</code>.</p>`,
    );
  }
  const manifestPath = join(dir, "backup-manifest.json");
  let trigger = "unknown";
  let codiVersion = "?";
  let timestamp = key.ts;
  let files: Array<{ path: string; scope?: string; size: number; deleted?: boolean }> = [];
  let totalSize = 0;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      trigger?: string;
      codiVersion?: string;
      timestamp?: string;
      files?: Array<{ path: string; scope?: string; deleted?: boolean }>;
    };
    trigger = manifest.trigger ?? "unknown";
    codiVersion = manifest.codiVersion ?? "?";
    if (manifest.timestamp) timestamp = manifest.timestamp;
    files = (manifest.files ?? []).map((f) => {
      let size = 0;
      try {
        size = statSync(join(dir, f.path)).size;
      } catch {
        /* missing file */
      }
      totalSize += size;
      return { path: f.path, scope: f.scope, size, deleted: f.deleted };
    });
  } catch {
    /* manifest unreadable — show what we have */
  }

  const restoreUrl =
    scope === "archive" && key.hash
      ? `/api/v1/backups/archive/${encodeURIComponent(key.hash)}/${encodeURIComponent(timestamp)}/restore`
      : `/api/v1/backups/local/${encodeURIComponent(timestamp)}/restore`;

  const filesHtml = files.length
    ? `<table class="w-full text-sm border-collapse">
        <thead class="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr><th class="px-3 py-2">Path</th><th class="px-3 py-2">Scope</th><th class="px-3 py-2 text-right">Size</th></tr>
        </thead>
        <tbody>
        ${files
          .map(
            (f) => `
          <tr class="border-t border-slate-200">
            <td class="px-3 py-2 font-mono text-xs break-all">${escapeHtml(f.path)}${f.deleted ? ' <span class="text-xs ml-1 px-1 py-0.5 rounded bg-rose-100 text-rose-800">deleted</span>' : ""}</td>
            <td class="px-3 py-2 text-xs">${escapeHtml(f.scope ?? "—")}</td>
            <td class="px-3 py-2 text-right tabular-nums text-slate-500">${fmtBytes(f.size)}</td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>`
    : `<p class="text-sm text-slate-500">No file entries in manifest.</p>`;

  const body = `
    <div class="flex items-center justify-between mb-3">
      <a class="text-xs text-slate-500 hover:underline" href="/settings">← settings</a>
      <button type="button" class="text-xs text-emerald-700 hover:underline"
        x-data="{}"
        x-on:click="$dispatch('restore-backup', { scope: '${scope}', id: '${escapeHtml(key.hash ?? "")}', ts: '${escapeHtml(timestamp)}' })">
        Restore this backup →
      </button>
    </div>
    <h1 class="text-2xl font-semibold mb-1">Backup ${escapeHtml(scope)} <span class="font-mono text-base text-slate-600">${escapeHtml(timestamp)}</span></h1>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
      <div class="rounded border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase text-slate-500">Trigger</p><p class="font-mono">${escapeHtml(trigger)}</p>
      </div>
      <div class="rounded border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase text-slate-500">Codi version</p><p class="font-mono">${escapeHtml(codiVersion)}</p>
      </div>
      <div class="rounded border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase text-slate-500">Files</p><p class="tabular-nums">${files.length}</p>
      </div>
      <div class="rounded border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase text-slate-500">Total size</p><p class="tabular-nums">${fmtBytes(totalSize)}</p>
      </div>
    </div>
    ${key.hash ? `<p class="text-xs text-slate-500 mb-2">project hash: <span class="font-mono">${escapeHtml(key.hash)}</span></p>` : ""}
    <p class="text-xs text-slate-500 mb-4 break-all">dir: <code>${escapeHtml(dir)}</code></p>
    <p class="text-xs text-slate-500 mb-4 break-all">restore endpoint: <code>POST ${escapeHtml(restoreUrl)}</code></p>
    <section class="rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="text-sm font-semibold mb-3">Files</h2>
      ${filesHtml}
    </section>
    <div x-data="restorer()"
         x-on:restore-backup.window="open($event.detail.scope, $event.detail.id, $event.detail.ts)"
         x-show="visible"
         x-cloak
         class="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" x-on:click.stop>
        <div class="flex items-start gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-slate-900" x-text="step === 1 ? 'Restore from this checkpoint?' : 'Confirm restore'"></h3>
            <p class="text-sm text-slate-600 mt-1" x-show="step === 1">Files in the snapshot will be copied back over the current project state. Existing files NOT in the snapshot are kept intact.</p>
            <p class="text-sm text-slate-600 mt-1" x-show="step === 2">Last chance — second confirmation.</p>
            <p class="mt-2 text-xs font-mono text-slate-500 truncate" x-text="scope + ' · ' + (id ? id.slice(0,16) + '/' : '') + ts"></p>
          </div>
        </div>
        <div x-show="result" class="rounded bg-emerald-50 text-emerald-900 text-sm p-3 mb-3" x-text="result"></div>
        <div x-show="error" class="rounded bg-rose-50 text-rose-900 text-sm p-3 mb-3" x-text="error"></div>
        <div class="flex justify-end gap-2">
          <button type="button" class="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50" x-on:click="cancel()" x-text="result ? 'Close' : 'Cancel'">Cancel</button>
          <button type="button"
            class="px-3 py-1.5 text-sm rounded text-white"
            :class="step === 1 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-700 hover:bg-emerald-800 ring-2 ring-emerald-300'"
            :disabled="working || result"
            x-show="!result"
            x-on:click="advance()"
            x-text="working ? 'Restoring…' : (step === 1 ? 'Continue' : 'Restore now')"></button>
        </div>
      </div>
    </div>
    <script>
      function restorer() {
        return {
          visible: false, step: 1, working: false, result: null, error: null,
          scope: '', id: '', ts: '',
          open(scope, id, ts) {
            this.scope = scope; this.id = id; this.ts = ts;
            this.step = 1; this.working = false; this.result = null; this.error = null;
            this.visible = true;
          },
          cancel() { this.visible = false; },
          async advance() {
            if (this.step === 1) { this.step = 2; return; }
            this.working = true; this.error = null;
            try {
              const url = this.scope === 'archive'
                ? '/api/v1/backups/archive/' + encodeURIComponent(this.id) + '/' + encodeURIComponent(this.ts) + '/restore'
                : '/api/v1/backups/local/' + encodeURIComponent(this.ts) + '/restore';
              const r = await fetch(url, { method: 'POST' });
              const j = await r.json();
              if (!r.ok) { this.error = j.error?.message || 'Restore failed'; return; }
              this.result = 'Restored ' + (j.data?.restored?.length || 0) + ' files.';
            } catch (e) {
              this.error = String(e);
            } finally {
              this.working = false;
            }
          },
        };
      }
    </script>`;
  return shell({ title: `Backup ${timestamp}`, active: "/settings" }, body);
}
