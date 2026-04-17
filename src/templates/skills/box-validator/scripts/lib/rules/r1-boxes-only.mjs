// Rule 1: BOXES ONLY — text content lives only in leaves. A non-leaf node
// with own text violates the rule because it mixes structure and content.
// Exemption: heading (h1-h6) and paragraph (p) elements commonly mix text
// with inline formatting elements (span, em, strong) — this is standard HTML.

export const id = "R1";
export const name = "Boxes Only";

const EXEMPT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);

export function check(node, _context) {
  const violations = [];
  walk(node);
  return violations;

  function walk(n) {
    if (!n.isLeaf && n.hasContent && !EXEMPT_TAGS.has(n.tag)) {
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
