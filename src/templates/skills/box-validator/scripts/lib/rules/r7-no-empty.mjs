// Rule 7: NO EMPTY NODES — every node must be either a parent (has children)
// or a content leaf (has own text). Childless, contentless nodes serve no
// purpose UNLESS they have visual CSS properties (background, border,
// box-shadow) that make them decorative elements.

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
  const z = context.zeroAreaThreshold;
  if (n.rect.w < z || n.rect.h < z) return true;
  if (hasVisualBackground(n)) return true;
  if (n.css.borderWidth > 0) return true;
  if (n.css.boxShadow && n.css.boxShadow !== "none") return true;
  return false;
}

function hasVisualBackground(n) {
  const bg = n.css.backgroundColor;
  if (!bg) return false;
  if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
  return true;
}
