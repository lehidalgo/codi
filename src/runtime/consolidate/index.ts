/**
 * Public surface of `src/runtime/consolidate/` (Sprint 5).
 */

export {
  PATTERN_CODES,
  PROPOSAL_TYPES,
  type PatternCode,
  type ProposalType,
  type ArtifactKind,
  type Proposal,
  type ProposalEvidence,
  type PersistedProposal,
  type ProposalStatus,
} from "./types.js";

export {
  insertProposal,
  listProposals,
  getProposal,
  decideProposal,
  type DecisionInput,
  type DecisionResult,
} from "./repo.js";

export {
  p1RepeatedCorrection,
  p2UnusedSkill,
  p5NewPattern,
  type PatternDetector,
  type DetectOptions,
  type P2Options,
} from "./patterns.js";
