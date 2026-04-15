'use strict';

const id = 'R10';
const name = 'Content Fit';

const EXEMPT_TAGS = new Set([
  'img', 'video', 'audio', 'canvas', 'svg', 'iframe', 'picture', 'hr',
]);

const CENTER_JUSTIFY = new Set(['center', 'space-around', 'space-evenly']);

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
  const { scrollW, scrollH, clientW, clientH, textW, justify, textAlign } = n.rect;

  if (clientW === 0 || clientH === 0) return;

  const overflowH = scrollH - clientH;
  if (overflowH > tol) {
    out.push({
      rule: 'R10',
      severity: 'error',
      path: n.path,
      message: `Content height ${scrollH}px > box height ${clientH}px (overflow ${overflowH.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit vertically. Shrink the font-size, increase this leaf's flex ratio so its parent allocates more height, or reduce the text length. The leaf's rendered text is taller than the flex-allocated box.",
    });
  }

  const overflowW = scrollW - clientW;
  if (overflowW > tol) {
    out.push({
      rule: 'R10',
      severity: 'error',
      path: n.path,
      message: `Content width ${scrollW}px > box width ${clientW}px (overflow ${overflowW.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit horizontally. Shrink the font-size, allow wrapping (remove white-space: nowrap), widen this leaf's flex ratio, or shorten the text. The leaf's rendered content is wider than the allocated box.",
    });
  }

  if (clientW < context.underfillMinBoxWidth) return;
  if (textW <= 0) return;
  if (overflowW > tol) return;

  const isCentered = CENTER_JUSTIFY.has(justify) || textAlign === 'center';
  if (isCentered) return;

  const ratio = textW / clientW;
  if (ratio < context.underfillErrorRatio) {
    out.push({
      rule: 'R10',
      severity: 'error',
      path: n.path,
      message: `Content fills ${(ratio * 100).toFixed(0)}% of box width (${textW.toFixed(0)}px text in ${clientW}px box, not centered): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: 'Severe horizontal underfill. Center the content with `justify-content: center` on the leaf\'s flex container (or `text-align: center`), OR shrink the leaf\'s flex ratio so its box matches its content, OR wrap the compound in an inline-flex cluster that sizes to content. Left-heavy empty space looks broken.',
    });
  } else if (ratio < context.underfillWarnRatio) {
    out.push({
      rule: 'R10',
      severity: 'warning',
      path: n.path,
      message: `Content fills ${(ratio * 100).toFixed(0)}% of box width (${textW.toFixed(0)}px text in ${clientW}px box, not centered): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: 'Moderate horizontal underfill. Consider centering the content (`justify-content: center`) or reducing the leaf\'s flex ratio. Acceptable if the empty space is intentional.',
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

module.exports = { id, name, check };
