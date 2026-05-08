/**
 * XlsxSyncer — local .xlsx snapshot adapter (ADR-005).
 *
 * Sprint 2 proper scaffold. Full implementation in Sprint 3 once the brain
 * tables stabilize: write each canonical table to a worksheet (.xlsx), keep
 * a manifest sheet for schema_version + generated_at.
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

export class XlsxSyncer implements ExternalSyncer {
  readonly kind = "xlsx" as const;

  async push(_brainDb: Database.Database, opts: PushOptions): Promise<PushResult> {
    return {
      destination: opts.external,
      rowsPushed: 0,
      tablesTouched: [],
      skipped: 0,
      errors: ["XlsxSyncer.push: Sprint 3 wiring pending"],
    };
  }

  async pull(_brainDb: Database.Database, opts: PullOptions): Promise<PullResult> {
    return {
      source: opts.external,
      rowsPulled: 0,
      tablesTouched: [],
      conflicts: [],
      errors: ["XlsxSyncer.pull: not supported (xlsx is push-only)"],
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
