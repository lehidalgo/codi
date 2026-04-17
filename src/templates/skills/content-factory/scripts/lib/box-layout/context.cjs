'use strict';

function computeContext({ canvasWidth, canvasHeight, nodeCount, overrides = {} }) {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const tolerance = Math.max(2, minDim * 0.002);
  const errorTolerance = tolerance * 4;
  const zeroAreaThreshold = 1;
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
    compoundCohesionMaxFillRatio,
    scoreWeights,
    scoreNormalizer,
    truncateChars,
    ...overrides,
  });
}

function applyPreset(overrides, preset) {
  if (preset === 'strict') {
    return { ...overrides, toleranceMultiplier: 0.5 };
  }
  if (preset === 'lenient') {
    return { ...overrides, toleranceMultiplier: 2 };
  }
  return overrides;
}

module.exports = { computeContext, applyPreset };
