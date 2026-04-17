// ValidationContext — the single source of truth for every tunable
// constant in the rule engine. Computed from canvas dimensions and
// tree stats so that rules scale proportionally with design size and
// complexity instead of using absolute px values that only work at
// 1920x1080.
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
  const tolerance = Math.max(2, minDim * 0.002);

  // Error-band tolerance for R8 sibling consistency (severity escalation).
  const errorTolerance = tolerance * 4;

  // Zero-area threshold for R7 decorative exemption.
  const zeroAreaThreshold = 1;

  // Compound cohesion detection threshold for R2 exemption.
  const compoundCohesionMaxFillRatio = 0.5;

  // Scoring weights per severity.
  const scoreWeights = { error: 0.08, warning: 0.03, info: 0.01 };

  // Complexity normalizer for scoring — sqrt(nodeCount / 45).
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
      toleranceMultiplier: 0.5,
    };
  }
  if (preset === "lenient") {
    return {
      ...overrides,
      toleranceMultiplier: 2,
    };
  }
  return overrides;
}
