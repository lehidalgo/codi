/**
 * SheetsSyncer — Google Sheets adapter that satisfies ExternalSyncer (ADR-005).
 *
 * Sprint 2 proper ships the contract + a thin scaffold. The full push/pull
 * implementation reuses src/runtime/sync/{bootstrap,operations,...}.ts which
 * were imported from Codi. Wiring those internals into the
 * push/pull/diff methods is Sprint 3 work — this module exists so the
 * runtime can already route by `kind` and tests can stub the adapter.
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
      errors: ["SheetsSyncer.push: Sprint 3 wiring pending"],
    };
  }

  async pull(_brainDb: Database.Database, opts: PullOptions): Promise<PullResult> {
    return {
      source: opts.external,
      rowsPulled: 0,
      tablesTouched: [],
      conflicts: [],
      errors: ["SheetsSyncer.pull: Sprint 3 wiring pending"],
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
