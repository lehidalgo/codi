// Rule 1: BOXES ONLY — text content lives only in leaves. A non-leaf node
// with own text (excluding descendants) violates the rule because it mixes
// structure and content.

export const id = "R1";
export const name = "Boxes Only";

export function check(node, _context) {
  const violations = [];
  walk(node);
  return violations;

  function walk(n) {
    if (!n.isLeaf && n.hasContent) {
      violations.push({
        rule: "R1",
        severity: "error",
        path: n.path,
        message: `Non-leaf node contains text: "${truncate(n.textContent)}"`,
        fix: "Wrap the text in a child element, or remove it. Non-leaves must contain only other boxes.",
      });
    }
    for (const c of n.children) walk(c);
  }
}

function truncate(s) {
  return s.length > 40 ? s.slice(0, 37) + "..." : s;
}
