'use strict';

// Annotates the raw tree from renderer with properties the rule engine
// needs: flow direction, isLeaf, hasContent, depth, structural fingerprint,
// and sibling groups keyed by fingerprint or explicit data-box-group.

function annotate(rawRoot, context) {
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
  for (const c of node.children) annotateNode(c, depth + 1, context, stats);
  node.fingerprint = computeFingerprint(node);
  node.isCompoundCohesion = detectCompoundCohesion(node, context);
}

function detectCompoundCohesion(node, context) {
  if (node.flow !== 'row') return false;
  if (node.children.length < 2) return false;
  if (!node.children.every((c) => c.isLeaf)) return false;
  if (!node.children.some(isIconLeaf)) return false;

  const paddingH = node.css.paddingLeft + node.css.paddingRight;
  const gap = node.css.gap;
  const sumChildW = node.children.reduce((s, c) => s + c.rect.w, 0);
  const gapsH = gap * Math.max(0, node.children.length - 1);
  const usedW = paddingH + sumChildW + gapsH;
  const fillFraction = usedW / node.rect.w;
  return fillFraction < context.compoundCohesionMaxFillRatio;
}

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
  if (node.isLeaf) return 'leaf';
  const d = node.css.display;
  if (d === 'grid' || d === 'inline-grid') {
    const cols = node.css.gridTemplateColumns.split(' ').filter(Boolean).length;
    return cols > 1 && node.children.length > cols ? 'grid' : cols > 1 ? 'row' : 'column';
  }
  if (d === 'flex' || d === 'inline-flex') {
    const dir = node.css.flexDirection || 'row';
    const wrap = node.css.flexWrap || 'nowrap';
    if (wrap !== 'nowrap') return 'wrap';
    return dir.startsWith('column') ? 'column' : 'row';
  }
  if (node.children.length >= 2) {
    const a = node.children[0].rect;
    const b = node.children[1].rect;
    if (Math.abs(a.y - b.y) < 2 && Math.abs(a.x - b.x) > 2) return 'row';
  }
  return 'column';
}

function computeFingerprint(node) {
  if (node.isLeaf) return 'leaf';
  const childTypes = node.children
    .map((c) => (c.isLeaf ? 'L' : c.flow[0].toUpperCase()))
    .join('');
  return `${node.flow}:${node.children.length}:${childTypes}`;
}

function collectSiblingGroups(root) {
  const groups = [];
  walk(root);
  return groups;

  function walk(n) {
    if (n.children.length >= 2) {
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

module.exports = { annotate };
