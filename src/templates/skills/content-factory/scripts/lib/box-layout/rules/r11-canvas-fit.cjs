'use strict';

// R11 — Canvas Fit
//
// Every canvas-root element (`.doc-page`, `.slide`, `.social-card`) MUST
// fit its declared canvas dimensions. Unlike R10 (which checks leaf text
// overflow), R11 runs against the canvas containers themselves and
// catches the failure mode where the whole page is too tall or too wide
// for its format.
//
// Emitted as a standard box-layout violation so content-fit shows up in
// the same /api/validate-card response the agent already consumes — no
// parallel notification channel, no separate "you should also check"
// file. Agents that validate before declaring done pick this up
// automatically.
//
// Remediation is content-type aware:
//   document (.doc-page)  → paginate when overflow > 15%, else tighten
//   slides   (.slide)     → split when overflow > 15%, else tighten
//   social   (.social-card) → always tighten (single canvas, no split)

const id = 'R11';
const name = 'Canvas Fit';

const CANVAS_ROOT_CLASSES = {
  'doc-page': 'document',
  'slide': 'slides',
  'social-card': 'social',
};

const REMEDIATION_MATRIX = {
  document: { high: 'paginate', low: 'tighten' },
  slides:   { high: 'split',    low: 'tighten' },
  social:   { high: 'tighten',  low: 'tighten' },
};

const HIGH_OVERFLOW_PCT = 15;

function canvasTypeFor(node) {
  for (const cls of node.classes || []) {
    if (CANVAS_ROOT_CLASSES[cls]) return CANVAS_ROOT_CLASSES[cls];
  }
  return null;
}

function computeRemediation(overflowPct, type) {
  const matrix = REMEDIATION_MATRIX[type] || REMEDIATION_MATRIX.document;
  return overflowPct > HIGH_OVERFLOW_PCT ? matrix.high : matrix.low;
}

function buildFix(remediation, overflow) {
  const { canvasW, canvasH, overflowPx, overflowPct, type } = overflow;
  const fmt = canvasW + 'x' + canvasH;
  if (remediation === 'paginate') {
    return (
      'paginate: Page exceeds ' + fmt + ' by ' + overflowPx + 'px (' + overflowPct + '%). ' +
      'Add a new .doc-page sibling after this one and move overflow content ' +
      'into it. Preserve the existing header and footer on every page.'
    );
  }
  if (remediation === 'split') {
    return (
      'split: Slide exceeds ' + fmt + ' by ' + overflowPx + 'px (' + overflowPct + '%). ' +
      'Split this slide into multiple slides at the next natural section ' +
      'break (h2 or hr).'
    );
  }
  const noun = type === 'social' ? 'Card' : 'Page';
  return (
    'tighten: ' + noun + ' exceeds ' + fmt + ' by ' + overflowPx + 'px (' + overflowPct + '%). ' +
    'Tighten the layout: reduce padding, condense copy, or lower font sizes ' +
    'until content fits.'
  );
}

function check(root, context) {
  const violations = [];
  const tol = context && typeof context.tolerance === 'number' ? context.tolerance : 2;
  // Declared canvas from the active format. When the validator forces
  // `min-height` on .doc-page so content can grow, the element's own
  // clientH grows with it — we must measure against the format instead.
  const canvasW = context && context.canvasWidth;
  const canvasH = context && context.canvasHeight;
  walk(root);
  return violations;

  function walk(node) {
    const type = canvasTypeFor(node);
    if (type) inspectCanvasNode(node, type, tol, canvasW, canvasH, violations);
    for (const c of node.children || []) walk(c);
  }
}

function inspectCanvasNode(node, type, tol, canvasW, canvasH, out) {
  const { scrollW, scrollH, clientW, clientH } = node.rect;
  if (!clientW || !clientH) return;
  if (!canvasW || !canvasH) return;

  // Measure the rendered canvas against its declared format. The rendered
  // height is `max(scrollH, clientH)` — either is authoritative when the
  // element stretches to content. Overflow is positive when the rendered
  // box exceeds the format declared by the active canvas.
  const renderedH = Math.max(scrollH, clientH);
  const renderedW = Math.max(scrollW, clientW);
  const overflowH = renderedH - canvasH;
  const overflowW = renderedW - canvasW;
  if (overflowH <= tol && overflowW <= tol) return;

  // Pick the worst dimension to describe the violation; both are captured
  // in the numbers but the fix narrative keys off the primary overflow.
  const overflowPx = Math.max(overflowH, overflowW, 0);
  const denom = overflowH >= overflowW ? canvasH : canvasW;
  const overflowPct = Math.round((overflowPx / denom) * 1000) / 10;
  const remediation = computeRemediation(overflowPct, type);
  const fix = buildFix(remediation, {
    canvasW,
    canvasH,
    overflowPx,
    overflowPct,
    type,
  });

  out.push({
    rule: id,
    severity: 'error',
    path: node.path,
    message:
      'Canvas overflow on .' + (type === 'document' ? 'doc-page' : type === 'slides' ? 'slide' : 'social-card') +
      ' — content is ' + overflowPx + 'px larger than ' + canvasW + 'x' + canvasH +
      ' (' + overflowPct + '%)',
    fix,
    // Machine-readable hints so agents can branch without parsing the message.
    remediation,
    overflowPx,
    overflowPct,
    canvasType: type,
  });
}

module.exports = { id, name, check };
