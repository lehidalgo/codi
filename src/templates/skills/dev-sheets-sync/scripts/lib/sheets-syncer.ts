/**
 * SheetsSyncer — Google Sheets adapter that satisfies ExternalSyncer (ADR-005).
 *
 * Ships the contract + a thin scaffold. Push/pull/diff are not yet wired
 * to the underlying skill internals (`./bootstrap.ts`, `./operations.ts`);
 * this module exists so the runtime can route by `kind` and tests can
 * stub the adapter. ISSUE-005 deleted the original `src/runtime/sync/`
 * location — the implementations now live alongside this file under
 * `dev-sheets-sync/scripts/lib/`.
 */

import type Database from "better-sqlite3";
import type {
  ExternalSyncer,
  ExternalRef,
  PushOptions,
  PushResult,
  PullOptions,
  PullResult,
  DiffResult,
} from "./external-syncer.js";

export class SheetsSyncer implements ExternalSyncer {
  readonly kind = "sheets" as const;

  async push(_brainDb: Database.Database, opts: PushOptions): Promise<PushResult> {
    return {
      destination: opts.external,
      rowsPushed: 0,
      tablesTouched: [],
      skipped: 0,
      errors: ["SheetsSyncer.push: not yet wired"],
    };
  }

  async pull(_brainDb: Database.Database, opts: PullOptions): Promise<PullResult> {
    return {
      source: opts.external,
      rowsPulled: 0,
      tablesTouched: [],
      conflicts: [],
      errors: ["SheetsSyncer.pull: not yet wired"],
    };
  }

  async diff(_brainDb: Database.Database, external: ExternalRef): Promise<DiffResult> {
    return {
      external,
      localOnly: [],
      externalOnly: [],
      conflicting: [],
    };
  }
}
