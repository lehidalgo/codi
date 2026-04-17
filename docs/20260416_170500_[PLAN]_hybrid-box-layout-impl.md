# Hybrid Box Layout Model — Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the box validator recognize CSS-positioned layouts (justify-content) as valid, remove underfill penalties, and exempt decorative/inline elements from structural rules.

**Architecture:** Five targeted rule changes in the box-validator scripts. Each rule file is modified independently. The renderer already extracts `justify-content` as `n.rect.justify` — no extraction changes needed. Tests use vitest with real Playwright rendering.

**Tech Stack:** ESM JavaScript (Node.js), vitest, Playwright (headless Chromium)

---

### Task 1: Remove R10 underfill checks

**Files**: `src/templates/skills/box-validator/scripts/lib/rules/r10-content-fit.mjs`, `src/templates/skills/box-validator/tests/validate.test.js`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Edit `src/templates/skills/box-validator/scripts/lib/rules/r10-content-fit.mjs` — delete the entire underfill section (lines 85-115). Keep overflow checks (lines 62-83) intact. The function should return after the overflow checks:

```javascript
// Rule 10: CONTENT FIT — a leaf's natural content size must fit its
// allocated box. Overflow (content > box) is an error. Underfill
// (content < box) is allowed — Layer 2 CSS positioning handles
// content placement within structural boxes.
//
// Self-rendering tags (img, svg, video, canvas, iframe) are exempt.

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
  const { scrollW, scrollH, clientW, clientH } = n.rect;

  if (clientW === 0 || clientH === 0) return;

  const overflowH = scrollH - clientH;
  if (overflowH > tol) {
    out.push({
      rule: "R10",
      severity: "error",
      path: n.path,
      message: `Content height ${scrollH}px > box height ${clientH}px (overflow ${overflowH.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit vertically. Shrink the font-size, increase this leaf's flex ratio so its parent allocates more height, or reduce the text length.",
    });
  }

  const overflowW = scrollW - clientW;
  if (overflowW > tol) {
    out.push({
      rule: "R10",
      severity: "error",
      path: n.path,
      message: `Content width ${scrollW}px > box width ${clientW}px (overflow ${overflowW.toFixed(1)}px): "${truncate(n.textContent, context.truncateChars)}"`,
      fix: "Content does not fit horizontally. Shrink the font-size, allow wrapping, widen this leaf's flex ratio, or shorten the text.",
    });
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
```

- [ ] 2. Verify existing R10 overflow test still passes: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "broken-r10-overflow"` — expected: the overflow violations for `$12.4M` and `Extraordinarily` still fire (overflow check unchanged)
- [ ] 3. Verify starter templates still pass: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "starter templates"` — expected: all 3 pass (removing underfill can only help scores)
- [ ] 4. Commit: `git add src/templates/skills/box-validator/scripts/lib/rules/r10-content-fit.mjs && git commit -m "refactor(box-validator): remove R10 underfill checks, keep overflow only"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 2: Add justify-content awareness to R2

**Files**: `src/templates/skills/box-validator/scripts/lib/rules/r2-full-coverage.mjs`, `src/templates/skills/box-validator/scripts/lib/renderer.mjs`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Add `justifyContent` to the extracted CSS in the renderer. Edit `src/templates/skills/box-validator/scripts/lib/renderer.mjs` — add `justifyContent` to the `css:` block after line 144 (`paddingLeft`):

```javascript
      css: {
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexWrap: cs.flexWrap,
        gridTemplateColumns: cs.gridTemplateColumns,
        gap: parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0,
        columnGap: parseFloat(cs.columnGap) || 0,
        rowGap: parseFloat(cs.rowGap) || 0,
        paddingTop: parseFloat(cs.paddingTop) || 0,
        paddingRight: parseFloat(cs.paddingRight) || 0,
        paddingBottom: parseFloat(cs.paddingBottom) || 0,
        paddingLeft: parseFloat(cs.paddingLeft) || 0,
        justifyContent: cs.justifyContent,
      },
```

- [ ] 2. Edit `src/templates/skills/box-validator/scripts/lib/rules/r2-full-coverage.mjs` — add justify-content exemption. When a container uses `justify-content` that distributes space (space-between, space-around, space-evenly, center, flex-end), downgrade the main-axis R2 error to a warning (structure is intentional):

```javascript
// Rule 2: FULL COVERAGE — children + spacing must fill the parent completely.
// When a container uses justify-content to distribute space intentionally,
// the main-axis check is downgraded to warning (Layer 2 CSS placement).

export const id = "R2";
export const name = "Full Coverage";

// justify-content values that intentionally distribute leftover space.
// When present, children are not expected to fill the main axis — the
// browser handles the remaining space via CSS positioning (Layer 2).
const DISTRIBUTING_JUSTIFY = new Set([
  "space-between",
  "space-around",
  "space-evenly",
  "center",
  "flex-end",
]);

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (
      !n.isLeaf &&
      n.children.length > 0 &&
      n.flow !== "wrap" &&
      n.flow !== "grid" &&
      !n.isCompoundCohesion
    ) {
      checkNode(n, context, violations);
    }
    for (const c of n.children) walk(c);
  }
}

function checkNode(n, context, out) {
  const tol = context.tolerance;
  const padT = n.css.paddingTop;
  const padR = n.css.paddingRight;
  const padB = n.css.paddingBottom;
  const padL = n.css.paddingLeft;
  const gap = n.css.gap;
  const cn = n.children.length;
  const distributes = DISTRIBUTING_JUSTIFY.has(n.css.justifyContent);

  if (n.flow === "column") {
    const expected =
      padT + padB + n.children.reduce((s, c) => s + c.rect.h, 0) + gap * (cn - 1);
    const delta = Math.abs(n.rect.h - expected);
    if (delta > tol) {
      out.push({
        rule: "R2",
        severity: distributes ? "warning" : "error",
        path: n.path,
        message: `Column height ${n.rect.h.toFixed(1)}px ≠ children+spacing ${expected.toFixed(1)}px (Δ${delta.toFixed(1)}px)`,
        fix: distributes
          ? "Column uses justify-content to distribute space. Consider using flex children to fill the axis for tighter structure."
          : "Give every child `flex: 1` (or explicit heights) so they fill the parent. Verify there is no absolute-positioned ghost or hidden sibling.",
      });
    }
    const expectedW = n.rect.w - padL - padR;
    for (const c of n.children) {
      if (Math.abs(c.rect.w - expectedW) > tol) {
        out.push({
          rule: "R2",
          severity: "warning",
          path: c.path,
          message: `Child width ${c.rect.w.toFixed(1)}px ≠ parent inner width ${expectedW.toFixed(1)}px`,
          fix: "Remove fixed widths on children. Let flex distribute the cross axis.",
        });
      }
    }
  } else if (n.flow === "row") {
    const expected =
      padL + padR + n.children.reduce((s, c) => s + c.rect.w, 0) + gap * (cn - 1);
    const delta = Math.abs(n.rect.w - expected);
    if (delta > tol) {
      out.push({
        rule: "R2",
        severity: distributes ? "warning" : "error",
        path: n.path,
        message: `Row width ${n.rect.w.toFixed(1)}px ≠ children+spacing ${expected.toFixed(1)}px (Δ${delta.toFixed(1)}px)`,
        fix: distributes
          ? "Row uses justify-content to distribute space. Consider using flex children to fill the axis for tighter structure."
          : "Give every child `flex: 1` (or explicit widths) so they fill the parent.",
      });
    }
    const expectedH = n.rect.h - padT - padB;
    for (const c of n.children) {
      if (Math.abs(c.rect.h - expectedH) > tol) {
        out.push({
          rule: "R2",
          severity: "warning",
          path: c.path,
          message: `Child height ${c.rect.h.toFixed(1)}px ≠ parent inner height ${expectedH.toFixed(1)}px`,
          fix: "Remove fixed heights on children. Let flex distribute the cross axis.",
        });
      }
    }
  }
}
```

- [ ] 3. Verify the broken-r2-dead-space fixture still fails (it uses default `justify-content: normal`, so the error severity stays): `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "broken-r2-dead-space"` — expected: still FAIL with R2 errors
- [ ] 4. Verify starter templates still pass: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "starter templates"`
- [ ] 5. Commit: `git add src/templates/skills/box-validator/scripts/lib/rules/r2-full-coverage.mjs src/templates/skills/box-validator/scripts/lib/renderer.mjs && git commit -m "feat(box-validator): downgrade R2 to warning when justify-content distributes space"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 3: Exempt decorative elements from R7

**Files**: `src/templates/skills/box-validator/scripts/lib/rules/r7-no-empty.mjs`, `src/templates/skills/box-validator/scripts/lib/renderer.mjs`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Add `backgroundColor` and `borderWidth` to the CSS extraction in `src/templates/skills/box-validator/scripts/lib/renderer.mjs`. After the `paddingLeft` line in the `css:` block:

```javascript
        paddingLeft: parseFloat(cs.paddingLeft) || 0,
        justifyContent: cs.justifyContent,
        backgroundColor: cs.backgroundColor,
        borderWidth: parseFloat(cs.borderTopWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth),
        boxShadow: cs.boxShadow,
```

- [ ] 2. Edit `src/templates/skills/box-validator/scripts/lib/rules/r7-no-empty.mjs` — expand `isLikelyDecorative` to check for visual CSS properties:

```javascript
// Rule 7: NO EMPTY NODES — every node must be either a parent (has children)
// or a content leaf (has own text). Childless, contentless nodes serve no
// purpose UNLESS they have visual CSS properties (background, border,
// box-shadow) that make them decorative elements.

export const id = "R7";
export const name = "No Empty Nodes";

export function check(root, context) {
  const violations = [];
  walk(root);
  return violations;

  function walk(n) {
    if (n.isLeaf && !n.hasContent && !isLikelyDecorative(n, context)) {
      violations.push({
        rule: "R7",
        severity: "error",
        path: n.path,
        message: "Node has no children and no text content",
        fix: "Either add content, add child boxes, or remove the node.",
      });
    }
    for (const c of n.children) walk(c);
  }
}

const DECORATIVE_TAGS = new Set([
  "img",
  "video",
  "audio",
  "canvas",
  "svg",
  "iframe",
  "picture",
  "hr",
]);

function isLikelyDecorative(n, context) {
  if (DECORATIVE_TAGS.has(n.tag)) return true;
  const z = context.zeroAreaThreshold;
  if (n.rect.w < z || n.rect.h < z) return true;
  // Visual CSS properties make an element decorative (accent bars, dividers)
  if (hasVisualBackground(n)) return true;
  if (n.css.borderWidth > 0) return true;
  if (n.css.boxShadow && n.css.boxShadow !== "none") return true;
  return false;
}

// Returns true if the background-color is not fully transparent.
// Computed style returns rgba(0, 0, 0, 0) for transparent.
function hasVisualBackground(n) {
  const bg = n.css.backgroundColor;
  if (!bg) return false;
  if (bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
  return true;
}
```

- [ ] 3. Verify the broken-r7-empty fixture still fails (its empty node has no visual properties): `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "broken-r7-empty"` — expected: still FAIL
- [ ] 4. Commit: `git add src/templates/skills/box-validator/scripts/lib/rules/r7-no-empty.mjs src/templates/skills/box-validator/scripts/lib/renderer.mjs && git commit -m "feat(box-validator): exempt visually decorative elements from R7 empty check"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 4: Exempt heading elements from R1

**Files**: `src/templates/skills/box-validator/scripts/lib/rules/r1-boxes-only.mjs`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Edit `src/templates/skills/box-validator/scripts/lib/rules/r1-boxes-only.mjs` — exempt heading and paragraph tags:

```javascript
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
```

- [ ] 2. Verify starter templates still pass: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "starter templates"`
- [ ] 3. Commit: `git add src/templates/skills/box-validator/scripts/lib/rules/r1-boxes-only.mjs && git commit -m "feat(box-validator): exempt h1-h6 and p from R1 boxes-only check"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 5: Skip inline/br elements from R3 sibling comparison

**Files**: `src/templates/skills/box-validator/scripts/lib/rules/r3-shared-dimension.mjs`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Edit `src/templates/skills/box-validator/scripts/lib/rules/r3-shared-dimension.mjs` — filter out zero-width inline elements before comparing:

```javascript
// Rule 3: SHARED DIMENSION — column siblings share width, row siblings share
// height. Text-leaf children are exempt on the varying axis because text
// heights/widths legitimately differ.
// Inline elements (br, display:inline, display:contents) with zero rendered
// dimensions are excluded from sibling comparison.

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
```

- [ ] 2. Verify starter templates still pass: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js -t "starter templates"`
- [ ] 3. Commit: `git add src/templates/skills/box-validator/scripts/lib/rules/r3-shared-dimension.mjs && git commit -m "feat(box-validator): skip br and zero-dimension elements from R3 sibling comparison"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 6: Clean up context.mjs — remove underfill constants

**Files**: `src/templates/skills/box-validator/scripts/lib/context.mjs`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Edit `src/templates/skills/box-validator/scripts/lib/context.mjs` — remove `underfillMinBoxWidth`, `underfillErrorRatio`, and `underfillWarnRatio` from the context since R10 no longer uses them. Also remove them from the lenient/strict presets:

```javascript
export function computeContext({ canvasWidth, canvasHeight, nodeCount, overrides = {} }) {
  const minDim = Math.min(canvasWidth, canvasHeight);
  const tolerance = Math.max(2, minDim * 0.002);
  const errorTolerance = tolerance * 4;
  const zeroAreaThreshold = 1;
  const compoundCohesionMaxFillRatio = 0.5;
  const scoreWeights = { error: 0.08, warning: 0.03, info: 0.01 };
  const scoreNormalizer = Math.max(0.5, Math.sqrt(nodeCount / 45));
  const truncateChars = 40;

  const ctx = {
    canvasWidth,
    canvasHeight,
    nodeCount,
    tolerance,
    errorTolerance,
    zeroAreaThreshold,
    compoundCohesionMaxFillRatio,
    scoreWeights,
    scoreNormalizer,
    truncateChars,
    ...overrides,
  };
  return Object.freeze(ctx);
}

export function applyPreset(overrides, preset) {
  if (preset === "strict") {
    return {
      ...overrides,
      toleranceMultiplier: 0.5,
    };
  }
  if (preset === "lenient") {
    return {
      ...overrides,
      toleranceMultiplier: 2,
    };
  }
  return overrides;
}
```

- [ ] 2. Verify all tests still pass: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`
- [ ] 3. Commit: `git add src/templates/skills/box-validator/scripts/lib/context.mjs && git commit -m "refactor(box-validator): remove underfill constants from context after R10 simplification"`

**Verification**: `pnpm vitest run src/templates/skills/box-validator/tests/validate.test.js`

---

### Task 7: Copy updated validator to installed locations

**Files**: `.claude/skills/codi-box-validator/scripts/lib/`, `.codi/skills/codi-box-validator/scripts/lib/`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Copy all modified validator files to both installed locations:

```bash
for f in rules/r10-content-fit.mjs rules/r2-full-coverage.mjs rules/r7-no-empty.mjs rules/r1-boxes-only.mjs rules/r3-shared-dimension.mjs context.mjs; do
  cp "src/templates/skills/box-validator/scripts/lib/$f" ".claude/skills/codi-box-validator/scripts/lib/$f"
  cp "src/templates/skills/box-validator/scripts/lib/$f" ".codi/skills/codi-box-validator/scripts/lib/$f"
done
cp src/templates/skills/box-validator/scripts/lib/renderer.mjs .claude/skills/codi-box-validator/scripts/lib/renderer.mjs
cp src/templates/skills/box-validator/scripts/lib/renderer.mjs .codi/skills/codi-box-validator/scripts/lib/renderer.mjs
```

- [ ] 2. Also copy to the content-factory vendored copy (if it vendors the validator):

```bash
# Check if content-factory vendors the validator
ls src/templates/skills/content-factory/scripts/lib/box-validator/ 2>/dev/null || echo "not vendored separately"
```

- [ ] 3. Verify by running the content-factory validator endpoint against the test session:

```bash
curl -s -X POST "http://localhost:<PORT>/api/validate-card" \
  -H "Content-Type: application/json" \
  -d '{"project":"<session-dir>","file":"minimal-carousel.html","cardIndex":0,"force":true}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'score={d[\"score\"]:.2f} errors={sum(1 for v in d[\"violations\"] if v[\"severity\"]==\"error\")}')"
```

- [ ] 4. Commit: `git add .claude/skills/codi-box-validator .codi/skills/codi-box-validator && git commit -m "chore(box-validator): sync installed copies with source after hybrid layout changes"`

**Verification**: Content factory `/api/validate-card` returns improved scores for the test session.

---

### Task 8: Validate the minimal-carousel test session with updated rules

**Files**: none (verification only)
**Est**: 2 minutes

**Steps**:
- [ ] 1. Restart the content factory server:

```bash
bash .claude/skills/codi-content-factory/scripts/stop-server.sh .codi_output
bash .claude/skills/codi-content-factory/scripts/start-server.sh --project-dir .
```

- [ ] 2. Run batch validation on the minimal-carousel session and confirm scores improved:

```bash
curl -s "http://localhost:<PORT>/api/validate-cards?project=<session-dir>&file=minimal-carousel.html" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for c in data['cards']:
    errors = sum(1 for v in c['violations'] if v['severity']=='error')
    warns = sum(1 for v in c['violations'] if v['severity']=='warning')
    print(f'  Card {c[\"cardIndex\"]}: score={c[\"score\"]:.2f} pass={c[\"pass\"]} errors={errors} warnings={warns}')
"
```

- [ ] 3. Document the before/after comparison in the activity log.

**Verification**: At least 3 of 6 cards should score >= 0.50 (up from 0.00), and no R10 underfill errors should appear.
