// Rule 7: NO EMPTY NODES — every node must be either a parent (has children)
// or a content leaf (has own text). Childless, contentless nodes serve no
// purpose and usually indicate a structural bug.

export const id = "R7";
export const name = "No Empty Nodes";

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && !n.hasContent && !isLikelyDecorative(n, context)) {
      violations.push({
        rule: "R7",
        severity: "error",
        path: n.path,
        message: "Node has no children and no text content",
        fix: "Either add content, add child boxes, or remove the node.",
      });
    }
    for (const c of n.children) walk(c);
  }
}

// Images, videos, canvas, svg, iframes etc. legitimately have no children and
// no text — they are self-rendering content leaves.
const DECORATIVE_TAGS = new Set([
  "img",
  "video",
  "audio",
  "canvas",
  "svg",
  "iframe",
  "picture",
  "hr",
]);

function isLikelyDecorative(n, context) {
  if (DECORATIVE_TAGS.has(n.tag)) return true;
  // Zero-area is threshold-based (below 1 CSS px is effectively nothing).
  const z = context.zeroAreaThreshold;
  return n.rect.w < z || n.rect.h < z;
}
