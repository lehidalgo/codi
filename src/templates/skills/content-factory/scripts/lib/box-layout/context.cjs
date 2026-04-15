'use strict';

// ValidationContext — the single source of truth for every tunable
// constant in the rule engine. Computed from canvas dimensions and
// tree stats so that rules scale proportionally with design size and
// complexity instead of using absolute px values that only work at
// 1920×1080.

function computeContext({ canvasWidth, canvasHeight, nodeCount, overrides = {} }) {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const tolerance = Math.max(2, minDim * 0.002);
  const errorTolerance = tolerance * 4;
  const zeroAreaThreshold = 1;
  const underfillMinBoxWidth = canvasWidth * 0.3;
  const underfillErrorRatio = 0.15;
  const underfillWarnRatio = 0.3;
  const compoundCohesionMaxFillRatio = 0.5;
  const scoreWeights = { error: 0.08, warning: 0.03, info: 0.01 };
  const scoreNormalizer = Math.max(0.5, Math.sqrt(nodeCount / 45));
  const truncateChars = 40;

  return Object.freeze({
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
  });
}

function applyPreset(overrides, preset) {
  if (preset === 'strict') {
    return {
      ...overrides,
      toleranceMultiplier: 0.5,
      underfillErrorRatio: 0.2,
      underfillWarnRatio: 0.4,
    };
  }
  if (preset === 'lenient') {
    return {
      ...overrides,
      toleranceMultiplier: 2,
      underfillErrorRatio: 0.1,
      underfillWarnRatio: 0.2,
    };
  }
  return overrides;
}

module.exports = { computeContext, applyPreset };
