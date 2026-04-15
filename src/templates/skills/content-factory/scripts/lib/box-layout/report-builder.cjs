'use strict';

function buildReport({ root, siblingGroups, violations, threshold, context }) {
  const summary = summarize(root, siblingGroups, violations);
  const score = computeScore(violations, context);
  const valid = score >= threshold && summary.errors === 0;

  return {
    valid,
    score,
    threshold,
    summary,
    violations: violations.map(cleanViolation),
    fixInstructions: buildFixInstructions(violations, summary),
  };
}

function summarize(root, siblingGroups, violations) {
  let totalNodes = 0;
  let leafNodes = 0;
  let maxDepth = 0;
  walk(root);

  return {
    totalNodes,
    leafNodes,
    parentNodes: totalNodes - leafNodes,
    maxDepth,
    siblingGroups: siblingGroups.length,
    errors: violations.filter((v) => v.severity === 'error').length,
    warnings: violations.filter((v) => v.severity === 'warning').length,
    infos: violations.filter((v) => v.severity === 'info').length,
  };

  function walk(n) {
    totalNodes += 1;
    if (n.isLeaf) leafNodes += 1;
    if (n.depth > maxDepth) maxDepth = n.depth;
    for (const c of n.children) walk(c);
  }
}

function computeScore(violations, context) {
  const weights = context.scoreWeights;
  const normalizer = context.scoreNormalizer;
  let penalty = 0;
  for (const v of violations) penalty += weights[v.severity] || 0;
  const score = 1 - penalty / normalizer;
  return Math.max(0, Math.round(score * 100) / 100);
}

function cleanViolation(v) {
  return {
    rule: v.rule,
    severity: v.severity,
    path: v.path,
    message: v.message,
    fix: v.fix,
  };
}

function buildFixInstructions(violations, summary) {
  if (violations.length === 0) {
    return 'Layout passes all checks. No changes needed.';
  }

  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule).push(v);
  }

  const parts = [];
  for (const [rule, items] of byRule) {
    const errors = items.filter((i) => i.severity === 'error');
    const warnings = items.filter((i) => i.severity === 'warning');
    const topPath = (errors[0] || items[0]).path;
    parts.push(
      `${rule}: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'} (e.g. ${topPath}).`,
    );
  }

  const lead = summary.errors > 0
    ? 'Fix these issues then re-run the validator.'
    : `${summary.warnings} minor warnings — acceptable if text content varies.`;

  return `${lead} ${parts.join(' ')}`;
}

module.exports = { buildReport };
