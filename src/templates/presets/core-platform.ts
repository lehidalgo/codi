/**
 * Core platform artifacts included in every preset.
 *
 * These power codi's self-improvement feedback loop. They are always
 * preselected — users may deselect individual entries, but they ship
 * in every built-in preset so the improvement loop is active by default.
 */
import { prefixedName, devArtifactName } from "#src/constants.js";

/** Rules that every preset includes by default. */
export const CORE_PLATFORM_RULES = [devArtifactName("improvement")] as const;

/**
 * Skills that every preset includes by default.
 *
 * - verification     — confirm tasks are complete before claiming done
 * - session-recovery — recover when the agent has made repeated errors
 * - rule-feedback    — background observation of rule quality
 * - refine-rules     — REVIEW collected feedback and REFINE rules with approval
 * - compare-preset   — check local artifacts against upstream
 */
export const CORE_PLATFORM_SKILLS = [
  prefixedName("verification"),
  prefixedName("session-recovery"),
  prefixedName("rule-feedback"),
  prefixedName("refine-rules"),
  prefixedName("compare-preset"),
] as const;
