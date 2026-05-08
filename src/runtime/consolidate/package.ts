/**
 * Stage 5 — generate a consolidation package (Sprint 5.b).
 *
 * Materialises every accepted proposal as a JSON manifest plus the
 * accepted patches inline. Sprint 5.c can extend this to write a real .zip
 * via `archiver` once we ship the disk-side apply logic; for now we emit a
 * single self-describing JSON document that the user can hand-apply or
 * pipe into `codi consolidation apply --from <file>`.
 */

import type Database from "better-sqlite3";
import { listProposals } from "./repo.js";
import type { PersistedProposal } from "./types.js";

export interface PackageManifest {
  readonly generatedAt: number;
  readonly counts: {
    readonly total: number;
    readonly perPattern: Record<string, number>;
    readonly perProposalType: Record<string, number>;
  };
  readonly proposals: readonly PersistedProposal[];
}

export function generatePackage(raw: Database.Database): PackageManifest {
  const accepted = listProposals(raw, { status: "accepted", limit: 1000 });
  const perPattern: Record<string, number> = {};
  const perProposalType: Record<string, number> = {};
  for (const p of accepted) {
    perPattern[p.patternCode] = (perPattern[p.patternCode] ?? 0) + 1;
    perProposalType[p.proposalType] = (perProposalType[p.proposalType] ?? 0) + 1;
  }
  return {
    generatedAt: Date.now(),
    counts: {
      total: accepted.length,
      perPattern,
      perProposalType,
    },
    proposals: accepted,
  };
}

export function packageToJson(manifest: PackageManifest): string {
  return JSON.stringify(manifest, null, 2);
}
