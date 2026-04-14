// Rule 9: LEAF ATOMICITY — a leaf must contain exactly one content atom.
// One text run OR one icon glyph, never a mix. Compound leaves like
// "↑ 34.2% vs Q3" must be promoted to parents with one child per atom,
// so Box Theory (R2-R4, R8) can be applied at the finer grain.
//
// Detection is a Unicode-range classifier over whitespace-separated tokens
// in the leaf's trimmed text content. Currency ($, €), punctuation, math
// operators, and ligatures (&) are deliberately NOT flagged as icons —
// only visual glyphs like arrows, bullets, checkmarks, stars, and emoji.

export const id = "R9";
export const name = "Leaf Atomicity";

// Curated icon-glyph ranges. A character is classified as "icon" only if it
// falls in one of these. Everything else is text, punctuation, or numeric.
const ICON_RANGES = [
  [0x00b7, 0x00b7], // middle dot ·
  [0x2022, 0x2022], // bullet •
  [0x2190, 0x21ff], // arrows ← → ↑ ↓ ↔ ↩
  [0x2500, 0x259f], // box drawing + block elements
  [0x25a0, 0x25ff], // geometric shapes ■ ● ▲
  [0x2600, 0x26ff], // misc symbols ★ ✓ ☀ ♦ ☁
  [0x2700, 0x27bf], // dingbats ✔ ✗ ✦ ➔
  [0x2900, 0x297f], // supplemental arrows B
  [0x2b00, 0x2bff], // misc symbols and arrows
  [0x1f300, 0x1f9ff], // emoji + pictographs
  [0x1fa00, 0x1faff], // extended symbols and pictographs
];

function isIconCodePoint(cp) {
  for (const [lo, hi] of ICON_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

// Classify a single whitespace-delimited token.
//   "icon"  — composed entirely of icon-range characters
//   "text"  — contains at least one letter or digit (alphanumeric)
//   "punct" — only punctuation/symbols outside our icon ranges (glue)
function classifyToken(token) {
  if (token.length === 0) return null;
  let icon = false;
  let alnum = false;
  for (const ch of token) {
    const cp = ch.codePointAt(0);
    if (isIconCodePoint(cp)) icon = true;
    else if (/[\p{L}\p{N}]/u.test(ch)) alnum = true;
  }
  if (alnum) return "text";
  if (icon) return "icon";
  return "punct";
}

// Count distinct content atoms in a text string. A run of consecutive text
// tokens collapses to one atom. Each icon token is its own atom. Punct
// tokens are glue — they do not count and do not split text runs.
function countAtoms(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  let atoms = 0;
  let inText = false;
  for (const tok of tokens) {
    const kind = classifyToken(tok);
    if (kind === "icon") {
      atoms += 1;
      inText = false;
    } else if (kind === "text") {
      if (!inText) atoms += 1;
      inText = true;
    }
    // "punct" tokens are glue — ignore, do not reset inText
  }
  return atoms;
}

export function check(root, context) {
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
      rule: "R9",
      severity: "warning",
      path: n.path,
      message: `Leaf packs ${atoms} atoms: "${truncate(text, context.truncateChars)}"`,
      fix: "Split into separate child boxes — one atom per leaf (e.g. one box for the icon, another for the text). Promote this leaf to a parent.",
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
