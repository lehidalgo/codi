/**
 * Pure backend-to-backend transfer logic, factored out of cli-bridge.ts.
 *
 * Reads every entity tab from a source `SheetsClient`, builds a DraftEnvelope,
 * runs `atomicSyncDraft` against a destination `SheetsClient`. Direction-
 * agnostic — works local→Google, Google→local, local→local, Google→Google.
 *
 * The CLI handlers in cli-bridge.ts wire up the auth + project-config sides;
 * this module is the testable core.
 */

import {
  type EntityName,
  type SheetRow,
  type ProjectConfig,
  type DraftEnvelope,
  type CallerScope,
  type SheetsClient,
  type AtomicSyncResult,
  SheetsError,
  readTab,
  atomicSyncDraft,
} from "./index.js";

export interface TransferOptions {
  cwd: string;
  sourceClient: SheetsClient;
  sourceConfig: ProjectConfig;
  destClient: SheetsClient;
  destConfig: ProjectConfig;
  caller: CallerScope;
  actor: string;
  /** Subset of entities to transfer (default: BG, REQ, US, REL). */
  entities?: ReadonlyArray<EntityName>;
  /** Skip dest snapshot — only safe when dest is freshly bootstrapped. */
  skipDestSnapshot?: boolean;
  /** Snapshot label suffix on the destination side. */
  snapshotLabel?: string;
  now?: () => Date;
}

export interface TransferResult {
  total_rows: number;
  envelope_by_entity: Readonly<Record<string, number>>;
  atomic: AtomicSyncResult;
}

const DEFAULT_TARGETS: ReadonlyArray<EntityName> = [
  "BusinessGoal",
  "Requirement",
  "UserStory",
  "Release",
];

function stripEmptyStringFields(row: SheetRow): SheetRow {
  const out: Record<string, SheetRow[string]> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Transfer rows from source to destination atomically.
 * - Reads source one tab at a time via readTab (no full-row validation —
 *   migration must tolerate partial rows).
 * - Builds an envelope and applies it to the destination via atomicSyncDraft.
 * - Inherits atomicSyncDraft's snapshot+rollback semantics on the destination.
 */
export async function transferSheetData(opts: TransferOptions): Promise<TransferResult> {
  const targets = opts.entities ?? DEFAULT_TARGETS;
  const envelope: Record<string, ReadonlyArray<SheetRow>> = {};
  const counts: Record<string, number> = {};
  let total = 0;

  for (const entity of targets) {
    try {
      const tab = await readTab(entity, { client: opts.sourceClient, config: opts.sourceConfig });
      // Strip empty-string fields. xlsx + Sheets both round-trip "no value"
      // as "", but downstream AJV (with format: date-time on archived_at and
      // similar) rejects empty strings. Treat "" as "field not present" for
      // transfer purposes — preserves null semantics, drops noise.
      const cleaned = tab.rows.map(stripEmptyStringFields);
      envelope[entity] = cleaned;
      counts[entity] = cleaned.length;
      total += cleaned.length;
    } catch (e) {
      if (e instanceof SheetsError && e.code === "sheet_unreachable") {
        // Tab missing on source — skip silently (e.g., a fresh Sheet).
        counts[entity] = 0;
        continue;
      }
      throw e;
    }
  }

  const atomic = await atomicSyncDraft({
    cwd: opts.cwd,
    client: opts.destClient,
    config: opts.destConfig,
    caller: opts.caller,
    actor: opts.actor,
    envelope: envelope as DraftEnvelope,
    snapshotLabel: opts.snapshotLabel ?? "transfer",
    skipSnapshot: opts.skipDestSnapshot === true,
    ...(opts.now !== undefined ? { now: opts.now } : {}),
  });

  return {
    total_rows: total,
    envelope_by_entity: counts,
    atomic,
  };
}
