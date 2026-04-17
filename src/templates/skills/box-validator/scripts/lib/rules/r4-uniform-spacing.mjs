// Rule 4: UNIFORM SPACING — padding = gap at every level, and all four
// padding sides are equal. Inset and inter-child gap must match so spacing
// reads as a single rhythm.

export const id = "R4";
export const name = "Uniform Spacing";

const SIDES = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
const SIDE_LABELS = ["top", "right", "bottom", "left"];

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (!n.isLeaf) checkNode(n, context, violations);
    for (const c of n.children) walk(c);
  }
}

function checkNode(n, context, out) {
  const tol = context.tolerance;
  const sides = SIDES.map((s) => n.css[s]);
  const avgPad = sides.reduce((a, b) => a + b, 0) / 4;

  // Symmetric padding check
  for (let i = 0; i < 4; i++) {
    const delta = Math.abs(sides[i] - avgPad);
    if (delta > tol) {
      out.push({
        rule: "R4",
        severity: "warning",
        path: n.path,
        message: `${SIDE_LABELS[i]} padding ${sides[i].toFixed(1)}px ≠ average ${avgPad.toFixed(1)}px`,
        fix: `Use uniform padding shorthand: \`padding: ${Math.round(avgPad)}px\``,
      });
    }
  }

  // Only enforce padding==gap when the node actually has spaced children
  if (n.children.length < 2) return;

  const gap = n.css.gap;
  const inset = avgPad; // use average as representative inset
  if (Math.abs(inset - gap) > tol) {
    out.push({
      rule: "R4",
      severity: "error",
      path: n.path,
      message: `padding (${inset.toFixed(1)}px) ≠ gap (${gap.toFixed(1)}px)`,
      fix: `Set both to the same value: \`padding: ${Math.round((inset + gap) / 2)}px; gap: ${Math.round((inset + gap) / 2)}px\``,
    });
  }
}
