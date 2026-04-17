// Dispatches all rules against an annotated tree and returns the flat
// violation list. Tree-wide rules (R8) receive the sibling groups too.

import * as r1 from "./rules/r1-boxes-only.mjs";
import * as r2 from "./rules/r2-full-coverage.mjs";
import * as r3 from "./rules/r3-shared-dimension.mjs";
import * as r4 from "./rules/r4-uniform-spacing.mjs";
import * as r7 from "./rules/r7-no-empty.mjs";
import * as r8 from "./rules/r8-sibling-consistency.mjs";
import * as r9 from "./rules/r9-leaf-atomicity.mjs";
import * as r10 from "./rules/r10-content-fit.mjs";

const NODE_RULES = [r1, r2, r3, r4, r7, r9, r10];
const GROUP_RULES = [r8];

/**
 * @param {object} root - annotated tree from tree-walker
 * @param {object[]} siblingGroups - groups from tree-walker
 * @param {object} context - ValidationContext with all tunable thresholds
 */
export function runRules(root, siblingGroups, context) {
  const violations = [];
  for (const rule of NODE_RULES) {
    violations.push(...rule.check(root, context));
  }
  for (const rule of GROUP_RULES) {
    violations.push(...rule.check(root, context, siblingGroups));
  }
  return violations;
}
