// ValidationContext — the single source of truth for every tunable
// constant in the rule engine. Computed from canvas dimensions and
// tree stats so that rules scale proportionally with design size and
// complexity instead of using absolute px values that only work at
// 1920×1080.
//
// Rules receive this object and read constants from it. They never
// hardcode numbers. This file is the ONLY place where numeric policy
// lives — change a threshold here and every rule updates consistently.

/**
 * Build a ValidationContext for a given canvas and tree.
 *
 * @param {object} opts
 * @param {number} opts.canvasWidth   - viewport/canvas width in px
 * @param {number} opts.canvasHeight  - viewport/canvas height in px
 * @param {number} opts.nodeCount     - total node count in the annotated tree
 * @param {object} [opts.overrides]   - CLI/user overrides (merged last)
 * @returns {object}                  - frozen context object
 */
export function computeContext({ canvasWidth, canvasHeight, nodeCount, overrides = {} }) {
  const minDim = Math.min(canvasWidth, canvasHeight);

  // Tolerance — 0.2% of the shorter canvas dimension, floor 2px.
  // A 300×600 mobile story → 2px. A 1920×1080 slide → 2.16px.
  // A 3840×2160 4K slide → 4.32px. Scales with render precision.
  const tolerance = Math.max(2, minDim * 0.002);

  // Error-band tolerance for R8 sibling consistency (severity escalation).
  // Delta exceeding this = error, below = warning. 4x the base tolerance.
  const errorTolerance = tolerance * 4;

  // Zero-area threshold for R7 decorative exemption — below 1 CSS px
  // is effectively nothing, regardless of canvas size.
  const zeroAreaThreshold = 1;

  // R10 underfill applies only to "structurally meaningful" boxes —
  // defined as at least 30% of the canvas width. On 1080px → 324.
  // On 3840px → 1152. Scales proportionally; ensures the rule kicks
  // in for structurally significant containers at every scale.
  const underfillMinBoxWidth = canvasWidth * 0.3;

  // Underfill ratio thresholds. These are dimensionless and stay
  // conservative to avoid false positives on display-style layouts
  // where a large box with a tight headline is intentional.
  const underfillErrorRatio = 0.15; // < 15% fill → error
  const underfillWarnRatio = 0.3; //  < 30% fill → warning

  // Compound cohesion detection threshold — a row parent whose
  // children sum-plus-spacing fills less than this fraction of the
  // parent width is treated as a "content-sized cluster" and exempted
  // from R2 full-coverage. No child-count bound (handles 2-atom
  // deltas and 6-icon navigation clusters with the same rule).
  const compoundCohesionMaxFillRatio = 0.5;

  // Scoring weights per severity.
  const scoreWeights = { error: 0.08, warning: 0.03, info: 0.01 };

  // Complexity normalizer for scoring — √(nodeCount / 45). At 45
  // nodes (representative medium design), normalizer = 1 (identity).
  // Smaller designs (10 nodes): ~0.47, violations penalize more.
  // Larger designs (200 nodes): ~2.1, same errors penalize less.
  const scoreNormalizer = Math.max(0.5, Math.sqrt(nodeCount / 45));

  // Truncate length for violation message previews (cosmetic).
  const truncateChars = 40;

  const ctx = {
    canvasWidth,
    canvasHeight,
    nodeCount,
    tolerance,
    errorTolerance,
    zeroAreaThreshold,
    underfillMinBoxWidth,
    underfillErrorRatio,
    underfillWarnRatio,
    compoundCohesionMaxFillRatio,
    scoreWeights,
    scoreNormalizer,
    truncateChars,
    ...overrides,
  };
  return Object.freeze(ctx);
}

/**
 * Apply a severity preset to override baseline thresholds.
 * Used by CLI flags --strict and --lenient.
 */
export function applyPreset(overrides, preset) {
  if (preset === "strict") {
    return {
      ...overrides,
      // Tighter tolerance, stricter underfill
      toleranceMultiplier: 0.5,
      underfillErrorRatio: 0.2,
      underfillWarnRatio: 0.4,
    };
  }
  if (preset === "lenient") {
    return {
      ...overrides,
      toleranceMultiplier: 2,
      underfillErrorRatio: 0.1,
      underfillWarnRatio: 0.2,
    };
  }
  return overrides;
}
