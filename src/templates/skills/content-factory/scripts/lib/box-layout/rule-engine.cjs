'use strict';

// Dispatches all rules against an annotated tree and returns the flat
// violation list. Tree-wide rules (R8) receive the sibling groups too.

const r1 = require('./rules/r1-boxes-only.cjs');
const r2 = require('./rules/r2-full-coverage.cjs');
const r3 = require('./rules/r3-shared-dimension.cjs');
const r4 = require('./rules/r4-uniform-spacing.cjs');
const r7 = require('./rules/r7-no-empty.cjs');
const r8 = require('./rules/r8-sibling-consistency.cjs');
const r9 = require('./rules/r9-leaf-atomicity.cjs');
const r10 = require('./rules/r10-content-fit.cjs');

const NODE_RULES = [r1, r2, r3, r4, r7, r9, r10];
const GROUP_RULES = [r8];

function runRules(root, siblingGroups, context) {
  const violations = [];
  for (const rule of NODE_RULES) {
    violations.push(...rule.check(root, context));
  }
  for (const rule of GROUP_RULES) {
    violations.push(...rule.check(root, context, siblingGroups));
  }
  return violations;
}

module.exports = { runRules };
