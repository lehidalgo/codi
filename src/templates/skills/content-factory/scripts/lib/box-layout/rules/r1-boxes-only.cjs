'use strict';

const id = 'R1';
const name = 'Boxes Only';

function check(node, _context) {
  const violations = [];
  walk(node);
  return violations;

  function walk(n) {
    if (!n.isLeaf && n.hasContent) {
      violations.push({
        rule: 'R1',
        severity: 'error',
        path: n.path,
        message: `Non-leaf node contains text: "${truncate(n.textContent)}"`,
        fix: 'Wrap the text in a child element, or remove it. Non-leaves must contain only other boxes.',
      });
    }
    for (const c of n.children) walk(c);
  }
}

function truncate(s) {
  return s.length > 40 ? s.slice(0, 37) + '...' : s;
}

module.exports = { id, name, check };
