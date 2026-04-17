'use strict';

const id = 'R7';
const name = 'No Empty Nodes';

const DECORATIVE_TAGS = new Set([
  'img', 'video', 'audio', 'canvas', 'svg', 'iframe', 'picture', 'hr',
]);

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

function isLikelyDecorative(n, context) {
  if (DECORATIVE_TAGS.has(n.tag)) return true;
  const z = context.zeroAreaThreshold;
  if (n.rect.w < z || n.rect.h < z) return true;
  if (hasVisualBackground(n)) return true;
  if (n.css.borderWidth > 0) return true;
  if (n.css.boxShadow && n.css.boxShadow !== 'none') return true;
  return false;
}

function hasVisualBackground(n) {
  const bg = n.css.backgroundColor;
  if (!bg) return false;
  if (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;
  return true;
}

module.exports = { id, name, check };
