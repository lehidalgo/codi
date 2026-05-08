/**
 * Consolidation types (Sprint 5).
 *
 * Pattern detectors scan the brain DB for recurring signals and emit
 * Proposals: structured suggestions about how to evolve the artifact catalog
 * (rules / skills / agents) based on what users actually do.
 */

/**
 * 8 patterns from master plan §10. Sprint 5 ships P1, P2, P5.
 * Remaining (P3, P4, P6, P7, P8) are implemented in later sprints.
 */
export const PATTERN_CODES = [
  "P1", // repeated correction → propose RULE
  "P2", // skill never selected → propose DEPRECATE
  "P3", // skill always co-fires with another → propose MERGE
  "P4", // two rules contradicting → propose RESOLVE_CONFLICT
  "P5", // new consistent pattern (≥3 occurrences) → propose CREATE_NEW
  "P6", // skill timing exceeds threshold → propose OPTIMIZE
  "P7", // capture cluster sin home rule → propose CREATE_NEW
  "P8", // rule referenced never triggered → propose DEPRECATE
] as const;

export type PatternCode = (typeof PATTERN_CODES)[number];

/** 6 proposal kinds per master plan §5.x. Each pattern emits exactly one. */
export const PROPOSAL_TYPES = [
  "PROMOTE_TO_RULE",
  "MERGE_SIMILAR",
  "RESOLVE_CONFLICT",
  "DEPRECATE_ARTIFACT",
  "CREATE_NEW_ARTIFACT",
  "OPTIMIZE_EXISTING_ARTIFACT",
] as const;

export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export type ArtifactKind = "rule" | "skill" | "agent";

export interface ProposalEvidence {
  /** Source row id in the brain (capture_id or artifacts_used.usage_id). */
  readonly id: number;
  /** Which table the id refers to. */
  readonly source: "captures" | "artifacts_used" | "corrections";
  /** Human-readable snippet for UI. */
  readonly snippet?: string;
}

export interface Proposal {
  readonly proposalId?: number; // assigned by INSERT
  readonly patternCode: PatternCode;
  readonly proposalType: ProposalType;
  /** When PROMOTE_TO_RULE / OPTIMIZE → existing artifact; null for CREATE_NEW. */
  readonly artifactKind: ArtifactKind | null;
  readonly artifactName: string | null;
  readonly title: string;
  readonly rationale: string;
  /** Optional structured patch the UI can apply on accept. JSON-serialized. */
  readonly patch: unknown | null;
  readonly evidence: readonly ProposalEvidence[];
}

export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface PersistedProposal extends Proposal {
  readonly proposalId: number;
  readonly status: ProposalStatus;
  readonly createdAt: number;
  readonly decidedAt: number | null;
  readonly decisionReason: string | null;
}
