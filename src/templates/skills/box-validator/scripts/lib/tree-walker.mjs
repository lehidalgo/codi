// Annotates the raw tree from renderer.mjs with properties the rule engine
// needs: flow direction, isLeaf, hasContent, depth, structural fingerprint,
// and sibling groups keyed by fingerprint or explicit data-box-group.

/**
 * @param {object} rawRoot - tree from renderer.mjs
 * @param {object} context - ValidationContext (see context.mjs)
 * @returns {{ root: object, siblingGroups: object[], nodeCount: number }}
 */
export function annotate(rawRoot, context) {
  const stats = { nodeCount: 0 };
  annotateNode(rawRoot, 0, context, stats);
  const siblingGroups = collectSiblingGroups(rawRoot);
  return { root: rawRoot, siblingGroups, nodeCount: stats.nodeCount };
}

function annotateNode(node, depth, context, stats) {
  stats.nodeCount += 1;
  node.depth = depth;
  node.isLeaf = node.children.length === 0;
  node.hasContent = node.textContent.length > 0;
  node.flow = detectFlow(node);
  // Recurse BEFORE computing fingerprint — fingerprint depends on children's flow.
  for (const c of node.children) annotateNode(c, depth + 1, context, stats);
  node.fingerprint = computeFingerprint(node);
  node.isCompoundCohesion = detectCompoundCohesion(node, context);
}

// A "compound cohesion container" is a row parent that holds all-leaf
// children where at least one child is an icon atom (per R9's classifier)
// AND the combined content + spacing fills less than the cohesion
// threshold of the parent width. This is the structural signature of a
// content-sized cluster like ⟨arrow⟩⟨value⟩ that lives inside a larger
// slot. Such parents are exempt from R2 (full coverage) because the
// "dead space" is intentional — the cluster should be centered.
//
// No child-count bound — handles 2-atom deltas and N-icon navigation
// clusters with the same heuristic.
function detectCompoundCohesion(node, context) {
  if (node.flow !== "row") return false;
  if (node.children.length < 2) return false;
  if (!node.children.every((c) => c.isLeaf)) return false;
  if (!node.children.some(isIconLeaf)) return false;

  // Content-fraction check: sum of child box widths + inter-child gaps
  // + parent horizontal padding, divided by parent width. If this is
  // well below 100%, the children are content-sized and the parent has
  // room to spare — classic cluster pattern.
  const paddingH = node.css.paddingLeft + node.css.paddingRight;
  const gap = node.css.gap;
  const sumChildW = node.children.reduce((s, c) => s + c.rect.w, 0);
  const gapsH = gap * Math.max(0, node.children.length - 1);
  const usedW = paddingH + sumChildW + gapsH;
  const fillFraction = usedW / node.rect.w;
  return fillFraction < context.compoundCohesionMaxFillRatio;
}

// A leaf is an "icon atom" when its entire trimmed content is a single
// whitespace-free token composed only of glyph characters (arrows, bullets,
// checkmarks, dingbats, emoji). This is the same classifier R9 uses.
function isIconLeaf(leaf) {
  if (!leaf.hasContent) return false;
  const text = leaf.textContent.trim();
  if (!text || /\s/.test(text)) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (!isIconCodePoint(cp)) return false;
  }
  return true;
}

// Unicode ranges kept in sync with r9-leaf-atomicity.mjs. Duplicated here
// to avoid circular imports between tree-walker and a rule file.
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

function detectFlow(node) {
  if (node.isLeaf) return "leaf";
  const d = node.css.display;
  if (d === "grid" || d === "inline-grid") {
    const cols = node.css.gridTemplateColumns.split(" ").filter(Boolean).length;
    return cols > 1 && node.children.length > cols ? "grid" : cols > 1 ? "row" : "column";
  }
  if (d === "flex" || d === "inline-flex") {
    const dir = node.css.flexDirection || "row";
    const wrap = node.css.flexWrap || "nowrap";
    if (wrap !== "nowrap") return "wrap";
    return dir.startsWith("column") ? "column" : "row";
  }
  // block-level fallback: infer from child layout
  if (node.children.length >= 2) {
    const a = node.children[0].rect;
    const b = node.children[1].rect;
    if (Math.abs(a.y - b.y) < 2 && Math.abs(a.x - b.x) > 2) return "row";
  }
  return "column";
}

// Structural signature used to group siblings for Rule 8. Two nodes with the
// same fingerprint have identical orientation and identical child count + types.
function computeFingerprint(node) {
  if (node.isLeaf) return "leaf";
  const childTypes = node.children
    .map((c) => (c.isLeaf ? "L" : c.flow[0].toUpperCase()))
    .join("");
  return `${node.flow}:${node.children.length}:${childTypes}`;
}

function collectSiblingGroups(root) {
  const groups = [];
  walk(root);
  return groups;

  function walk(n) {
    if (n.children.length >= 2) {
      // Bucket parent-type children by explicit group OR by fingerprint
      const buckets = new Map();
      for (const c of n.children) {
        if (c.isLeaf) continue;
        const key = c.dataBoxGroup || c.fingerprint;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      }
      for (const [key, members] of buckets) {
        if (members.length >= 2) {
          groups.push({
            parentPath: n.path,
            key,
            fingerprint: members[0].fingerprint,
            explicit: Boolean(members[0].dataBoxGroup),
            members,
            childCount: members[0].children.length,
          });
        }
      }
    }
    for (const c of n.children) walk(c);
  }
}
