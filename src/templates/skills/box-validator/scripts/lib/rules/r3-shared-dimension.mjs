// Rule 3: SHARED DIMENSION — column siblings share width, row siblings share
// height. Text-leaf children are exempt on the varying axis because text
// heights/widths legitimately differ.
// Inline elements (br, wbr) and zero-dimension nodes are excluded from
// sibling comparison — they don't participate in the flex layout.

export const id = "R3";
export const name = "Shared Dimension";

const SKIP_TAGS = new Set(["br", "wbr"]);

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (!n.isLeaf && n.children.length >= 2) {
      checkSiblings(n, context, violations);
    }
    for (const c of n.children) walk(c);
  }
}

function isLayoutParticipant(child) {
  if (SKIP_TAGS.has(child.tag)) return false;
  if (child.rect.w === 0 && child.rect.h === 0) return false;
  return true;
}

function checkSiblings(parent, context, out) {
  const tol = context.tolerance;
  const kids = parent.children.filter(isLayoutParticipant);
  if (kids.length < 2) return;

  if (parent.flow === "column") {
    const widths = kids.map((c) => c.rect.w);
    const avg = avgOf(widths);
    for (let i = 0; i < kids.length; i++) {
      const delta = Math.abs(widths[i] - avg);
      if (delta > tol) {
        out.push({
          rule: "R3",
          severity: "error",
          path: kids[i].path,
          message: `Column sibling width ${widths[i].toFixed(1)}px ≠ group avg ${avg.toFixed(1)}px`,
          fix: "All children of a column container must have the same width. Remove individual width overrides.",
        });
      }
    }
  } else if (parent.flow === "row") {
    const nonLeaf = kids.filter((c) => !c.isLeaf);
    if (nonLeaf.length >= 2) {
      const heights = nonLeaf.map((c) => c.rect.h);
      const avg = avgOf(heights);
      for (let i = 0; i < nonLeaf.length; i++) {
        const delta = Math.abs(heights[i] - avg);
        if (delta > tol) {
          out.push({
            rule: "R3",
            severity: "error",
            path: nonLeaf[i].path,
            message: `Row sibling height ${heights[i].toFixed(1)}px ≠ group avg ${avg.toFixed(1)}px`,
            fix: "All parent-type children of a row container must share the same height. Use `align-items: stretch` and remove height overrides.",
          });
        }
      }
    }
  }
}

function avgOf(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
