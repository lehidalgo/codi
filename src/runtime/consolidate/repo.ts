/**
 * Persistence helpers for the proposals table (Sprint 5).
 *
 * The brain DB owns the table; this module wraps the SQL with typed APIs
 * so detectors and the HTTP API don't reach into raw rows.
 */

import type Database from "better-sqlite3";
import type {
  Proposal,
  PersistedProposal,
  ProposalStatus,
  ArtifactKind,
  PatternCode,
  ProposalType,
} from "./types.js";

interface RawRow {
  proposal_id: number;
  pattern_code: string;
  proposal_type: string;
  artifact_kind: string | null;
  artifact_name: string | null;
  title: string;
  rationale: string;
  patch_json: string | null;
  evidence_json: string;
  status: string;
  created_at: number;
  decided_at: number | null;
  decision_reason: string | null;
}

function rowToProposal(r: RawRow): PersistedProposal {
  return {
    proposalId: r.proposal_id,
    patternCode: r.pattern_code as PatternCode,
    proposalType: r.proposal_type as ProposalType,
    artifactKind: (r.artifact_kind as ArtifactKind | null) ?? null,
    artifactName: r.artifact_name,
    title: r.title,
    rationale: r.rationale,
    patch: r.patch_json !== null ? JSON.parse(r.patch_json) : null,
    evidence: JSON.parse(r.evidence_json),
    status: r.status as ProposalStatus,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decisionReason: r.decision_reason,
  };
}

export function insertProposal(raw: Database.Database, p: Proposal): number {
  const result = raw
    .prepare(
      `INSERT INTO proposals(pattern_code, proposal_type, artifact_kind, artifact_name,
                             title, rationale, patch_json, evidence_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(
      p.patternCode,
      p.proposalType,
      p.artifactKind ?? null,
      p.artifactName ?? null,
      p.title,
      p.rationale,
      p.patch !== null ? JSON.stringify(p.patch) : null,
      JSON.stringify(p.evidence),
      Date.now(),
    );
  return Number(result.lastInsertRowid);
}

export function listProposals(
  raw: Database.Database,
  opts: { status?: ProposalStatus; limit?: number } = {},
): PersistedProposal[] {
  const limit = opts.limit ?? 100;
  const rows = opts.status
    ? (raw
        .prepare(`SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC LIMIT ?`)
        .all(opts.status, limit) as RawRow[])
    : (raw
        .prepare(`SELECT * FROM proposals ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as RawRow[]);
  return rows.map(rowToProposal);
}

export function getProposal(raw: Database.Database, proposalId: number): PersistedProposal | null {
  const row = raw.prepare(`SELECT * FROM proposals WHERE proposal_id = ?`).get(proposalId) as
    | RawRow
    | undefined;
  return row ? rowToProposal(row) : null;
}

export interface DecisionInput {
  readonly proposalId: number;
  readonly status: "accepted" | "rejected";
  readonly reason?: string;
}

export interface DecisionResult {
  readonly ok: boolean;
  readonly proposal: PersistedProposal | null;
  readonly error?: "not_found" | "already_decided";
}

export function decideProposal(raw: Database.Database, input: DecisionInput): DecisionResult {
  const current = getProposal(raw, input.proposalId);
  if (!current) return { ok: false, proposal: null, error: "not_found" };
  if (current.status !== "pending") {
    return { ok: false, proposal: current, error: "already_decided" };
  }
  raw
    .prepare(
      `UPDATE proposals
       SET status = ?, decided_at = ?, decision_reason = ?
       WHERE proposal_id = ?`,
    )
    .run(input.status, Date.now(), input.reason ?? null, input.proposalId);
  return { ok: true, proposal: getProposal(raw, input.proposalId) };
}
