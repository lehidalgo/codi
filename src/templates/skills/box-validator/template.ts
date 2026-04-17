import { PROJECT_NAME, SKILL_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Validate and enforce uniform spacing, hierarchy, and structural consistency in HTML layouts. Use ALWAYS when generating HTML for visual designs — Instagram posts, LinkedIn carousels, slide decks, A4 pages, stories, posters, cards, or any fixed-aspect-ratio HTML layout. Also use when the user mentions 'layout', 'design', 'post', 'slide', 'carousel', 'poster', 'social media', 'presentation template', 'validate my design', 'spacing', 'uniform layout', 'box theory', or asks to create any visual HTML content. This skill enforces the 8-rule Box Layout Theory and must run AFTER every HTML generation step — iterate until the layout passes. If in doubt whether a design task needs validation, use this skill.
category: ${SKILL_CATEGORY.DEVELOPER_TOOLS}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 6
---

# {{name}} — Box Layout Validator

## Purpose

Every time you generate HTML for a fixed-aspect-ratio layout (social post, slide,
document page, poster, card), you MUST validate it against the 8 rules of Box
Layout Theory before delivering to the user. This skill gives you a CLI that
renders the HTML with Playwright, walks the DOM, and returns a JSON report with
a score and actionable fix instructions. You read the report and iterate.

The validator runs in your own bash environment. No API, no server, no user
involvement. You generate → save → validate → fix → deliver, all in one turn.

## Skip When

- Pure prose output (articles, blog posts, READMEs) — no fixed-aspect layout
- Standalone chart or plot without a surrounding card or slide layout
- Exporting an existing PDF or image, not generating new HTML
- CLI or terminal output — no HTML layer at all

---

## The 10 Rules (working memory)

| # | Rule | What it enforces |
|---|------|------------------|
| 1 | BOXES ONLY | Layout is nested boxes. Text lives only in leaf elements. |
| 2 | FULL COVERAGE | Children + spacing fill the parent completely. No dead space. |
| 3 | SHARED DIMENSION | Column siblings share width. Row siblings share height. |
| 4 | UNIFORM SPACING | \`padding\` = \`gap\` at every level. All four padding sides equal. |
| 5 | RECURSIVE | Rules 2–4 apply at every depth until leaves. |
| 6 | LEAF RULE | Nodes with no children are leaves. Exempt from box validation. |
| 7 | NO EMPTY NODES | Every node is either a parent (has children) or a leaf (has content). |
| 8 | SIBLING CONSISTENCY | Structurally equivalent siblings must have matching child dimensions and positions. |
| 9 | LEAF ATOMICITY | A leaf holds exactly ONE atom (one text run OR one icon). Never a mix. |
| 10 | CONTENT FIT | A leaf's rendered content (\`scrollWidth\`/\`scrollHeight\`) must fit its allocated box (\`clientWidth\`/\`clientHeight\`). No overflow. |

For deep examples per rule, read \`\${CLAUDE_SKILL_DIR}[[/references/rules-detailed.md]]\`.

## Rule 9 in practice — the most common mistake

If you write \`<div class="delta">↑ 34.2% vs Q3</div>\`, the leaf packs TWO atoms (an arrow icon and a text run) into one box. You lose independent control over color, size, spacing, and alignment between them, and Rule 4's uniform-spacing rhythm cannot be applied between atoms. The validator will flag this.

**Wrong:**
\`\`\`html
<div class="delta">↑ 34.2% vs Q3</div>
\`\`\`

**Right:**
\`\`\`html
<div class="delta">
  <div class="arrow">↑</div>
  <div class="value">34.2% vs Q3</div>
</div>
\`\`\`

Same for timestamps like \`2026-04-14 · 14:20 UTC\` (3 atoms — date, bullet, time), checkmarks like \`✓ Done\` (icon + text), and navigation like \`A → B\` (text + icon + text).

**Not flagged** (single atoms): \`$12.4M\`, \`+15%\`, \`Terms & Conditions\`, \`Hello world\` — currency, punctuation, and plain text never count as icons.

## Rule 10 in practice — the font-vs-slot trap

R2 (full coverage) verifies parents' math, but it cannot see inside a leaf. A leaf styled \`font-size: 120px\` allocated 40px of flex height will render text glyphs that spill past the leaf's rect and overlap whatever sits below. The layout looks correct to flex but wrong to the eye. R10 catches this by comparing \`scrollHeight\`/\`scrollWidth\` (content natural size) against \`clientHeight\`/\`clientWidth\` (box size).

**Common causes and fixes:**

| Overflow | Cause | Fix |
|---|---|---|
| Vertical | Font too big for flex slot | Shrink font, OR raise the leaf's flex ratio, OR reduce siblings |
| Horizontal | \`white-space: nowrap\` on long text | Remove nowrap, OR shrink font, OR widen the leaf |
| Both | Parent is tiny and content is large | Restructure — content needs a bigger home |

Rule 10 is an **error**, not a warning. Visual overflow = broken layout.

---

## Canonical CSS pattern

Every non-leaf box uses this pattern at every depth. \`S\` is the spacing value
(same integer px at a given depth):

\`\`\`css
.box {
  display: flex;
  flex-direction: column; /* or row */
  padding: Spx;
  gap: Spx;               /* MUST equal padding */
  box-sizing: border-box;
}
.box > * {
  flex: 1;                /* ensures full coverage */
  min-width: 0;
  min-height: 0;
}
\`\`\`

Leaves hold text. Non-leaves hold only other boxes.

---

## Workflow

Run this loop for every HTML layout you generate. The user sees only the final
validated result.

### 1. Read the rules above. If a violation is unclear, read \`references/rules-detailed.md\`.

### 2. Determine dimensions.
Either the user specifies, or infer from context. For preset formats:
\`\${CLAUDE_SKILL_DIR}[[/references/aspect-ratios.md]]\`

Common presets:
- Instagram Post (4:5): 1080×1350
- Instagram Square: 1080×1080
- Slide Deck (16:9): 1920×1080
- A4 Portrait: 794×1123

### 3. Generate the HTML.
Start from a template if helpful: \`\${CLAUDE_SKILL_DIR}[[/assets/templates/]]\`
Save to an absolute path, e.g. \`/tmp/design.html\`.

### 4. Ensure Playwright is installed (first run only).

\`\`\`bash
bash \${CLAUDE_SKILL_DIR}[[/scripts/setup.sh]]
\`\`\`

Idempotent. Skips install if already present. Takes ~30s on first run.

### 5. Run the validator.

\`\`\`bash
node \${CLAUDE_SKILL_DIR}[[/scripts/validate.mjs]] \\
  --input /tmp/design.html \\
  --width 1080 --height 1350 \\
  --threshold 0.85
\`\`\`

Flags:
| Flag | Default | Meaning |
|------|---------|---------|
| \`--input\` | required | Absolute path to the HTML file |
| \`--width\` | required | Viewport width in pixels |
| \`--height\` | required | Viewport height in pixels |
| \`--tolerance\` | auto-scaled | Override the computed tolerance (default scales with canvas: \`max(2, minDim × 0.002)\`) |
| \`--threshold\` | \`0.85\` | Minimum score to be considered valid |
| \`--preset\` | — | Severity preset: \`strict\` or \`lenient\`. Default is balanced. |
| \`--pretty\` | off | Human-readable output instead of JSON |

**All other thresholds are derived automatically from canvas dimensions and tree complexity.** The validator scales from 300×600 mobile stories up through 3840×2160 4K slides without retuning. See \`\${CLAUDE_SKILL_DIR}[[/references/rules-detailed.md]]\` for the scaling model.

Exit codes: \`0\` valid, \`1\` invalid, \`2\` error.

### 6. Read the JSON report.

\`\`\`json
{
  "valid": false,
  "score": 0.72,
  "threshold": 0.85,
  "summary": { "totalNodes": 37, "errors": 3, "warnings": 2 },
  "violations": [
    {
      "rule": "R4",
      "severity": "error",
      "path": "root > card-01 > content-col",
      "message": "padding (12px) ≠ gap (8px)",
      "fix": "Set padding and gap to the same value (10px)"
    }
  ],
  "fixInstructions": "Three boxes have padding-gap mismatches. Unify padding and gap in card-01 content-col, card-02 content-col, and the footer row."
}
\`\`\`

### 7. Decide.
- If \`valid: true\` → deliver the HTML. Briefly mention the score to the user (e.g. "Layout validated — score 0.94, 0 errors, 1 minor warning").
- If \`valid: false\` → read \`fixInstructions\` and each violation's \`fix\` field. Modify the HTML. Go back to step 5.
- **Max 4 iterations.** If still failing, deliver the best-scoring attempt and surface the remaining warnings to the user.

### 8. Never show the raw JSON to the user unless they explicitly ask. Summarize.

---

## Rule 8 — Sibling Consistency (special handling)

Rule 8 compares structurally equivalent sibling boxes. Two siblings are
"structurally equivalent" when they have the same orientation and child count.
The validator auto-detects these groups and compares child dimensions across
group members.

To make grouping explicit and catch more cases, tag sibling parents with
\`data-box-group="name"\`:

\`\`\`html
<div class="card" data-box-group="card">...</div>
<div class="card" data-box-group="card">...</div>
<div class="card" data-box-group="card">...</div>
\`\`\`

All three cards will be validated as one group. Their children at each index
must have matching widths, heights, and relative positions.

---

## Composability

This skill validates STRUCTURE, not aesthetics. It pairs with:
- Brand skills (\`codi-brand\`, \`brand-creator\`) for colors and typography
- \`frontend-design\` for aesthetic guidelines
- \`content-factory\`, \`deck-engine\`, \`doc-engine\` for HTML generation

Run this validator AFTER applying visual styling from those skills.

---

## References

- \`\${CLAUDE_SKILL_DIR}[[/references/rules-detailed.md]]\` — deep examples per rule
- \`\${CLAUDE_SKILL_DIR}[[/references/aspect-ratios.md]]\` — format presets with dimensions
- \`\${CLAUDE_SKILL_DIR}[[/references/troubleshooting.md]]\` — common violations mapped to CSS fixes
- \`\${CLAUDE_SKILL_DIR}[[/assets/templates/]]\` — starter HTML layouts that pass validation
`;
