// Rule 10: CONTENT FIT — a leaf's natural content size must be a good
// match for its allocated box — neither too big (overflow) nor too
// small (underfill). Box Theory is incomplete without both halves:
//
//  OVERFLOW (error): scrollHeight/scrollWidth > clientHeight/clientWidth
//    Content is larger than the box — text glyphs spill past the leaf's
//    rect and render on top of siblings below, or get clipped. R2 can't
//    see this because flex-allocated rects still sum correctly.
//
//  UNDERFILL (warning/error): text natural width << box width, content
//    not centered. Content only fills a small fraction of the box, all
//    pooled on one edge. Looks sparse and left-heavy (or right-heavy).
//    Common cause: applying R9 atomic splits without shrinking the
//    parent's flex ratios, or using flex:1 on compound sub-atoms.
//
// Self-rendering tags (img, svg, video, canvas, iframe) are exempt.
// Small leaves (box width < 200px) are exempt from the underfill check
// because small-box imbalance is visually insignificant.

export const id = "R10";
export const name = "Content Fit";

const EXEMPT_TAGS = new Set([
  "img",
  "video",
  "audio",
  "canvas",
  "svg",
  "iframe",
  "picture",
  "hr",
]);

// A leaf is considered centered if either its flex container uses
// justify-content: center/space-around/space-evenly OR its block text
// uses text-align: center. Centered content balances empty space on
// both sides, so low fill ratio is not a visual problem.
const CENTER_JUSTIFY = new Set(["center", "space-around", "space-evenly"]);

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && n.hasContent && !EXEMPT_TAGS.has(n.tag)) {
      checkLeaf(n, context, violations);
    }
    for (const c of n.children) walk(c);
  }
}

function checkLeaf(n, context, out) {
  const tol = context.tolerance;
  const { scrollW, scrollH, clientW, clientH, textW, justify, textAlign } =
    n.rect;

  // Skip nodes where layout didn't produce meaningful metrics (zero-area
  // leaves, display:contents, etc.) — R7 already catches empties.
  if (clientW === 0 || clientH === 0) return;

  // ── OVERFLOW checks (content > box) ───────────────────────────────
  const overflowH = scrollH - clientH;
  if (overflowH > tol) {
    out.push({
      rule: "R10",
      severity: "error",
      path: n.path,
      message: `Content height ${scrollH}px > box height ${clientH}px (overflow ${overflowH.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit vertically. Shrink the font-size, increase this leaf's flex ratio so its parent allocates more height, or reduce the text length. The leaf's rendered text is taller than the flex-allocated box.",
    });
  }

  const overflowW = scrollW - clientW;
  if (overflowW > tol) {
    out.push({
      rule: "R10",
      severity: "error",
      path: n.path,
      message: `Content width ${scrollW}px > box width ${clientW}px (overflow ${overflowW.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit horizontally. Shrink the font-size, allow wrapping (remove white-space: nowrap), widen this leaf's flex ratio, or shorten the text. The leaf's rendered content is wider than the allocated box.",
    });
  }

  // ── UNDERFILL check (content << box, not centered) ───────────────
  // Only applies to sufficiently wide boxes — scaled proportionally to
  // canvas (see context.underfillMinBoxWidth). Small-box underfill is
  // visually insignificant. Centered content is exempt because its
  // empty space is balanced on both sides.
  if (clientW < context.underfillMinBoxWidth) return;
  if (textW <= 0) return; // no measurable text — nothing to compare
  if (overflowW > tol) return; // already flagged as overflow, don't double-count

  const isCentered =
    CENTER_JUSTIFY.has(justify) || textAlign === "center";
  if (isCentered) return;

  const ratio = textW / clientW;
  if (ratio < context.underfillErrorRatio) {
    out.push({
      rule: "R10",
      severity: "error",
      path: n.path,
      message: `Content fills ${(ratio * 100).toFixed(0)}% of box width (${textW.toFixed(0)}px text in ${clientW}px box, not centered): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Severe horizontal underfill. Center the content with `justify-content: center` on the leaf's flex container (or `text-align: center`), OR shrink the leaf's flex ratio so its box matches its content, OR wrap the compound in an inline-flex cluster that sizes to content. Left-heavy empty space looks broken.",
    });
  } else if (ratio < context.underfillWarnRatio) {
    out.push({
      rule: "R10",
      severity: "warning",
      path: n.path,
      message: `Content fills ${(ratio * 100).toFixed(0)}% of box width (${textW.toFixed(0)}px text in ${clientW}px box, not centered): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Moderate horizontal underfill. Consider centering the content (`justify-content: center`) or reducing the leaf's flex ratio. Acceptable if the empty space is intentional.",
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
