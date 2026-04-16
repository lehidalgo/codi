'use strict';

const id = 'R10';
const name = 'Content Fit';

const EXEMPT_TAGS = new Set([
  'img', 'video', 'audio', 'canvas', 'svg', 'iframe', 'picture', 'hr',
]);

function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && n.hasContent && !EXEMPT_TAGS.has(n.tag)) {
      checkLeaf(n, context, violations);
    }
    for (const c of n.children) walk(c);
  }
}

function checkLeaf(n, context, out) {
  const tol = context.tolerance;
  const { scrollW, scrollH, clientW, clientH } = n.rect;

  if (clientW === 0 || clientH === 0) return;

  const overflowH = scrollH - clientH;
  if (overflowH > tol) {
    out.push({
      rule: 'R10',
      severity: 'error',
      path: n.path,
      message: `Content height ${scrollH}px > box height ${clientH}px (overflow ${overflowH.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: 'Content does not fit vertically. Shrink the font-size, increase this leaf\'s flex ratio so its parent allocates more height, or reduce the text length.',
    });
  }

  const overflowW = scrollW - clientW;
  if (overflowW > tol) {
    out.push({
      rule: 'R10',
      severity: 'error',
      path: n.path,
      message: `Content width ${scrollW}px > box width ${clientW}px (overflow ${overflowW.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: 'Content does not fit horizontally. Shrink the font-size, allow wrapping, widen this leaf\'s flex ratio, or shorten the text.',
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

module.exports = { id, name, check };
