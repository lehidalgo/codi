'use strict';

const id = 'R9';
const name = 'Leaf Atomicity';

const ICON_RANGES = [
  [0x00b7, 0x00b7],
  [0x2022, 0x2022],
  [0x2190, 0x21ff],
  [0x2500, 0x259f],
  [0x25a0, 0x25ff],
  [0x2600, 0x26ff],
  [0x2700, 0x27bf],
  [0x2900, 0x297f],
  [0x2b00, 0x2bff],
  [0x1f300, 0x1f9ff],
  [0x1fa00, 0x1faff],
];

function isIconCodePoint(cp) {
  for (const [lo, hi] of ICON_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function classifyToken(token) {
  if (token.length === 0) return null;
  let icon = false;
  let alnum = false;
  for (const ch of token) {
    const cp = ch.codePointAt(0);
    if (isIconCodePoint(cp)) icon = true;
    else if (/[\p{L}\p{N}]/u.test(ch)) alnum = true;
  }
  if (alnum) return 'text';
  if (icon) return 'icon';
  return 'punct';
}

function countAtoms(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  let atoms = 0;
  let inText = false;
  for (const tok of tokens) {
    const kind = classifyToken(tok);
    if (kind === 'icon') {
      atoms += 1;
      inText = false;
    } else if (kind === 'text') {
      if (!inText) atoms += 1;
      inText = true;
    }
  }
  return atoms;
}

function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && n.hasContent) checkLeaf(n, context, violations);
    for (const c of n.children) walk(c);
  }
}

function checkLeaf(n, context, out) {
  const text = n.textContent.trim();
  if (!text) return;
  const atoms = countAtoms(text);
  if (atoms > 1) {
    out.push({
      rule: 'R9',
      severity: 'warning',
      path: n.path,
      message: `Leaf packs ${atoms} atoms: "${truncate(text, context.truncateChars)}"`,
      fix: 'Split into separate child boxes — one atom per leaf (e.g. one box for the icon, another for the text). Promote this leaf to a parent.',
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + '...' : s;
}

module.exports = { id, name, check };
