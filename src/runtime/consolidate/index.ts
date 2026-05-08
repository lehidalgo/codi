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

export { runConsolidation, type RunContext, type RunResult } from "./runner.js";

export { generatePackage, packageToJson, type PackageManifest } from "./package.js";

export {
  p1RepeatedCorrection,
  p2UnusedSkill,
  p3SkillCoFire,
  p4RuleConflict,
  p5NewPattern,
  p6SlowSkill,
  p7OrphanCluster,
  p8UnusedRule,
  type PatternDetector,
  type DetectOptions,
  type P2Options,
  type P3Options,
  type P4Options,
  type P6Options,
  type P7Options,
  type P8Options,
} from "./patterns.js";
