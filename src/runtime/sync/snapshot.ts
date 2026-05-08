/**
 * Local snapshot capture / read / list / prune for the project Sheet.
 *
 * Snapshots are simple JSON files written to `.devloop/snapshots/`.
 * They serve three purposes:
 *
 *   1. Pre-flight backup before any sync-draft / archive / migration —
 *      lets `restore` reverse a write if something goes wrong.
 *   2. Pull-before-modify baseline for the patch model — agent reads a
 *      snapshot, modifies in memory, writes a delta, syncs.
 *   3. Forensic record — Audit tab is per-row, snapshots are per-tab
 *      (header + every cell), and the two complement each other.
 *
 * Snapshots are NOT a substitute for the Sheet itself. They are local,
 * project-scoped, and gitignored. Retention defaults to 20 most-recent
 * (configurable per-call) to keep the tree small.
 */

import type { EntityName, SheetRow, ProjectConfig, SheetsClient } from "./index.js";
import { ENTITY_NAMES, readTab } from "./index.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export const SNAPSHOT_VERSION = 1 as const;
export const SNAPSHOT_DIR_RELATIVE = ".devloop/snapshots" as const;
export const DEFAULT_SNAPSHOT_RETENTION = 20 as const;

export interface SnapshotTab {
  rows: ReadonlyArray<SheetRow>;
  row_count: number;
  taken_at: string;
}

export interface Snapshot {
  version: typeof SNAPSHOT_VERSION;
  taken_at: string;
  taken_by: string;
  sheet_id: string;
  project_name: string;
  label?: string;
  tabs: Partial<Record<EntityName, SnapshotTab>>;
}

export interface CaptureSnapshotOptions {
  cwd: string;
  client: SheetsClient;
  config: ProjectConfig;
  taken_by: string;
  /** Subset of entities to capture (default: all five). */
  entities?: ReadonlyArray<EntityName>;
  /** Human-readable label included in the filename (e.g., "pre-sync-discover"). */
  label?: string;
  /** Override clock for deterministic tests. */
  now?: () => Date;
}

export interface CaptureSnapshotResult {
  path: string;
  snapshot: Snapshot;
}

export interface SnapshotEntry {
  path: string;
  filename: string;
  mtime: Date;
  size: number;
}

// ─── Capture ─────────────────────────────────────────────────────────────────

export async function captureSnapshot(
  opts: CaptureSnapshotOptions,
): Promise<CaptureSnapshotResult> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const targets = opts.entities ?? ENTITY_NAMES;
  const now = (opts.now ?? (() => new Date()))();
  const takenAt = now.toISOString();

  const tabs: Partial<Record<EntityName, SnapshotTab>> = {};
  for (const entity of targets) {
    try {
      const tab = await readTab(entity, { client: opts.client, config: opts.config });
      tabs[entity] = {
        rows: tab.rows,
        row_count: tab.rows.length,
        taken_at: takenAt,
      };
    } catch {
      // Missing tab: skip silently. Snapshot just won't carry it.
    }
  }

  const snapshot: Snapshot = {
    version: SNAPSHOT_VERSION,
    taken_at: takenAt,
    taken_by: opts.taken_by,
    sheet_id: opts.config.sheet_id,
    project_name: opts.config.project_name,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    tabs,
  };

  const dir = path.join(opts.cwd, SNAPSHOT_DIR_RELATIVE);
  fs.mkdirSync(dir, { recursive: true });
  const filename = snapshotFilename(now, opts.label);
  const absPath = path.join(dir, filename);
  fs.writeFileSync(absPath, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  return { path: absPath, snapshot };
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Read a snapshot JSON from disk. Throws if the file is missing or corrupt.
 * Validates version + required top-level fields; tab payload is trusted.
 */
export function readSnapshot(absPath: string): Snapshot {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- sync API needed for callers that bail fast
  const fs = require("node:fs") as typeof import("node:fs");
  const raw = fs.readFileSync(absPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`snapshot is not valid JSON: ${absPath} — ${(e as Error).message}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`snapshot must be a JSON object: ${absPath}`);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj["version"] !== SNAPSHOT_VERSION) {
    throw new Error(
      `snapshot version mismatch: expected ${SNAPSHOT_VERSION}, got ${String(obj["version"])} (${absPath})`,
    );
  }
  for (const required of ["taken_at", "taken_by", "sheet_id", "tabs"]) {
    if (!(required in obj)) {
      throw new Error(`snapshot missing required field "${required}": ${absPath}`);
    }
  }
  return obj as unknown as Snapshot;
}

// ─── List + prune ────────────────────────────────────────────────────────────

/**
 * List all snapshots in `.devloop/snapshots/` newest-first.
 */
export async function listSnapshots(cwd: string): Promise<ReadonlyArray<SnapshotEntry>> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(cwd, SNAPSHOT_DIR_RELATIVE);
  if (!fs.existsSync(dir)) return [];
  const entries: SnapshotEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const abs = path.join(dir, name);
    const stat = fs.statSync(abs);
    if (!stat.isFile()) continue;
    entries.push({ path: abs, filename: name, mtime: stat.mtime, size: stat.size });
  }
  entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return entries;
}

/**
 * Prune snapshots, keeping the `keep` most-recent. Returns removed paths.
 * Default retention follows DEFAULT_SNAPSHOT_RETENTION.
 */
export async function pruneSnapshots(
  cwd: string,
  keep: number = DEFAULT_SNAPSHOT_RETENTION,
): Promise<ReadonlyArray<string>> {
  const fs = await import("node:fs");
  const entries = await listSnapshots(cwd);
  if (entries.length <= keep) return [];
  const toRemove = entries.slice(keep);
  const removed: string[] = [];
  for (const entry of toRemove) {
    try {
      fs.unlinkSync(entry.path);
      removed.push(entry.path);
    } catch {
      // best-effort; don't throw on individual unlink failures.
    }
  }
  return removed;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filename format: `YYYYMMDD_HHMMSS[_label].json`.
 * Label is sanitized to [a-z0-9-] (max 40 chars). Collisions resolved by
 * appending a millisecond suffix.
 */
export function snapshotFilename(now: Date, label?: string): string {
  const ts = formatTimestamp(now);
  const safeLabel = sanitizeLabel(label);
  return safeLabel ? `${ts}_${safeLabel}.json` : `${ts}.json`;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

function sanitizeLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned.length > 0 ? cleaned : undefined;
}
