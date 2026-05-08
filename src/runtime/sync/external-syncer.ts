/**
 * ExternalSyncer interface (ADR-005).
 *
 * SQLite is canonical. External destinations (Google Sheets, .xlsx files, ...)
 * are opt-in sync targets — never sources of truth. Every concrete syncer
 * implements this surface so that `codi brain export` / `codi brain pull` /
 * `codi brain diff` route to whatever target the project has configured
 * without the brain layer caring which destination it is.
 */

import type Database from "better-sqlite3";

export type SyncDirection = "push" | "pull" | "bidirectional";

export interface ExternalRef {
  /** Stable identifier of the external destination — e.g. spreadsheet ID,
   *  absolute xlsx path, S3 URL. */
  readonly id: string;
  /** Optional kind hint for logs/errors. */
  readonly kind?: "sheets" | "xlsx" | string;
}

export interface PushOptions {
  readonly external: ExternalRef;
  /** Tables to push. Default: all canonical tables. */
  readonly tables?: readonly string[];
  /** Dry run — compute the diff but do not mutate the destination. */
  readonly dryRun?: boolean;
}

export interface PushResult {
  readonly destination: ExternalRef;
  readonly rowsPushed: number;
  readonly tablesTouched: readonly string[];
  readonly skipped: number;
  readonly errors: readonly string[];
}

export interface PullOptions {
  readonly external: ExternalRef;
  /** Tables to pull. Default: all canonical tables. */
  readonly tables?: readonly string[];
  /** Conflict resolution policy.
   *  - `prefer-local`: external wins only when the local row is missing.
   *  - `prefer-external`: external always overwrites local.
   *  - `manual`: surface conflicts; do not write. */
  readonly conflictPolicy?: "prefer-local" | "prefer-external" | "manual";
}

export interface PullResult {
  readonly source: ExternalRef;
  readonly rowsPulled: number;
  readonly tablesTouched: readonly string[];
  readonly conflicts: readonly SyncConflict[];
  readonly errors: readonly string[];
}

export interface SyncConflict {
  readonly table: string;
  readonly rowId: string;
  readonly localValue: unknown;
  readonly externalValue: unknown;
}

export interface DiffResult {
  readonly external: ExternalRef;
  readonly localOnly: readonly { table: string; rowId: string }[];
  readonly externalOnly: readonly { table: string; rowId: string }[];
  readonly conflicting: readonly SyncConflict[];
}

/**
 * Contract every external sync adapter must satisfy. Implementations:
 *   - SheetsSyncer  (src/runtime/sync/sheets-syncer.ts) — Google Sheets
 *   - XlsxSyncer    (src/runtime/sync/xlsx-syncer.ts)   — local .xlsx file
 */
export interface ExternalSyncer {
  /** Stable kind identifier — used in logs and config-driven dispatch. */
  readonly kind: string;

  /** Push the brain DB state outward. */
  push(brainDb: Database.Database, opts: PushOptions): Promise<PushResult>;

  /** Pull external state into the brain DB. */
  pull(brainDb: Database.Database, opts: PullOptions): Promise<PullResult>;

  /** Compute differences without mutating either side. */
  diff(brainDb: Database.Database, external: ExternalRef): Promise<DiffResult>;
}

/**
 * Lightweight registry so the runtime can route sync requests by kind without
 * importing concrete syncers (which carry heavy googleapis / xlsx deps).
 */
export class SyncerRegistry {
  private readonly byKind = new Map<string, ExternalSyncer>();

  register(syncer: ExternalSyncer): void {
    if (this.byKind.has(syncer.kind)) {
      throw new Error(`ExternalSyncer kind "${syncer.kind}" already registered`);
    }
    this.byKind.set(syncer.kind, syncer);
  }

  get(kind: string): ExternalSyncer {
    const found = this.byKind.get(kind);
    if (!found) {
      throw new Error(`No ExternalSyncer registered for kind "${kind}"`);
    }
    return found;
  }

  has(kind: string): boolean {
    return this.byKind.has(kind);
  }

  kinds(): readonly string[] {
    return Array.from(this.byKind.keys());
  }
}
