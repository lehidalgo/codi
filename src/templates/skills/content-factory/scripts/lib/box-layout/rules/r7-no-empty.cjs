'use strict';

const id = 'R7';
const name = 'No Empty Nodes';

function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && !n.hasContent && !isLikelyDecorative(n, context)) {
      violations.push({
        rule: 'R7',
        severity: 'error',
        path: n.path,
        message: 'Node has no children and no text content',
        fix: 'Either add content, add child boxes, or remove the node.',
      });
    }
    for (const c of n.children) walk(c);
  }
}

const DECORATIVE_TAGS = new Set([
  'img', 'video', 'audio', 'canvas', 'svg', 'iframe', 'picture', 'hr',
]);

function isLikelyDecorative(n, context) {
  if (DECORATIVE_TAGS.has(n.tag)) return true;
  const z = context.zeroAreaThreshold;
  return n.rect.w < z || n.rect.h < z;
}

module.exports = { id, name, check };
