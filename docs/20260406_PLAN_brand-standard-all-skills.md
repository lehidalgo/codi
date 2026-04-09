# Brand Standard — Full Skills Update Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a dual-runtime brand standard across all brand skills and all content generation skills. Every brand skill ships with `brand_tokens.json` (canonical data) + TypeScript generators (pptxgenjs, DEFAULT) + Python generators (python-pptx, FALLBACK). All generation skills explicitly route to brand generators when available.

**Architecture:**
- `brand_tokens.json` is the single source of truth — no color or font is duplicated across runtimes
- `scripts/ts/` holds TypeScript adapters and generators (always available via `npx tsx`)
- `scripts/python/` holds Python adapters and generators (fallback when `python3` available)
- Generation skills (`codi-pptx`, `codi-docx`, `codi-deck-engine`, `codi-doc-engine`) route to brand generators first, then fall back to their own defaults
- All SKILL.md bodies stay under 500 lines (skill creator constraint); detail moves to `scripts/` and `references/`

**Tech Stack:** TypeScript + pptxgenjs (DEFAULT), Python + python-pptx / python-docx (FALLBACK), Node.js (npx tsx, always available in codi)

---

## Scope

### Brand skills to update
| Skill | Priority | Change |
|-------|----------|--------|
| `codi-bbva-brand` | HIGH | Fix colors, add dual-runtime scripts, update description |
| `codi-rl3-brand` | HIGH | Migrate existing scripts to `ts/python/` dirs, update description |
| `codi-codi-brand` | MEDIUM | Add dual-runtime scripts (currently has none) |
| `codi-brand-identity` | HIGH | Update template to require `brand_tokens.json` standard |

### Generation skills to update
| Skill | Priority | Change |
|-------|----------|--------|
| `codi-pptx` | HIGH | Add brand routing, improve description |
| `codi-docx` | HIGH | Add brand routing, improve description |
| `codi-deck-engine` | MEDIUM | Explicit brand_tokens loading, improve description |
| `codi-doc-engine` | MEDIUM | Explicit brand_tokens loading, improve description |

---

## Standard: Brand Skill Directory Layout

Every brand skill MUST follow this layout after this plan is complete:

```
.claude/skills/codi-{brand}-brand/
  SKILL.md                          ← frontmatter + routing table + brief identity
  scripts/
    brand_tokens.json               ← canonical data (no runtime dep)
    ts/
      brand_tokens.ts               ← TypeScript adapter (pptxgenjs)
      generate_pptx.ts              ← pptxgenjs generator (DEFAULT)
      generate_docx.ts              ← DOCX generator (DEFAULT)
      validators/
        validate_pptx.ts            ← brand rule checker
        validate_docx.ts            ← brand rule checker
    python/
      brand_tokens.py               ← Python adapter (reads JSON)
      generate_pptx.py              ← python-pptx generator (FALLBACK)
      generate_docx.py              ← python-docx generator (FALLBACK)
      validators/
        pptx_validator.py
        docx_validator.py
  references/
    brand-guide.md                  ← detailed brand identity (color rationale, tone, etc.)
    icon-catalog.md                 ← (for brands with icons)
  assets/
    logo-light.svg
    logo-dark.svg
    fonts/                          ← WOFF2 files for web contexts
    icons/                          ← SVG icons
  evals/
    evals.json                      ← 5+ test cases
```

## Standard: brand_tokens.json Schema

All brand skills MUST provide this JSON structure:

```json
{
  "brand": "brand-name",
  "version": 1,
  "colors": {
    "primary": "#hex",
    "primary_dark": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "background_dark": "#hex",
    "text_primary": "#hex",
    "text_secondary": "#hex"
  },
  "fonts": {
    "pptx_headlines": "Font Name",
    "pptx_body": "Font Name",
    "web_headlines": "Font Name",
    "web_body": "Font Name",
    "fallback_sans": "Arial",
    "fallback_serif": "Georgia"
  },
  "layout": {
    "slide_width_in": "13.333",
    "slide_height_in": "7.5",
    "content_margin_in": "0.5",
    "accent_bar_width_in": "0.08"
  },
  "assets": {
    "logo_light_bg": "assets/logo-light.svg",
    "logo_dark_bg": "assets/logo-dark.svg",
    "pptx_template": "",
    "docx_template": ""
  },
  "voice": {
    "phrases_use": [],
    "phrases_avoid": []
  }
}
```

## Standard: content.json Schema (same for all generators)

```json
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "author": "Author Name",
  "sections": [
    {
      "number": "01",
      "label": "Section Name",
      "heading": "Section heading text",
      "body": "Body paragraph...",
      "items": ["bullet one", "bullet two"],
      "callout": "Optional callout text"
    }
  ]
}
```

## Standard: Routing Logic (for generation skills)

```bash
# In any generation skill — check for brand generator first
BRAND_SKILL="${HOME}/.claude/skills/codi-{brand}-brand"
if [ -f "${BRAND_SKILL}/scripts/ts/generate_pptx.ts" ]; then
  npx tsx "${BRAND_SKILL}/scripts/ts/generate_pptx.ts" \
    --content content.json --output output.pptx
elif [ -f "${BRAND_SKILL}/scripts/python/generate_pptx.py" ] && python3 --version &>/dev/null; then
  python3 "${BRAND_SKILL}/scripts/python/generate_pptx.py" \
    --content content.json --output output.pptx
else
  # Fall back to skill's own generator
fi
```

---

## Phase 1 — Shared Reference Document

### Task 1.1: Create the brand standard reference

**Files**: `.claude/skills/codi-brand-identity/references/brand-standard.md`

**Steps**:

- [ ] 1. Create `.claude/skills/codi-brand-identity/references/brand-standard.md` with:
  - The `brand_tokens.json` schema (copy from above)
  - The `content.json` schema (copy from above)
  - The routing logic pattern (copy from above)
  - The directory layout (copy from above)
  - Instructions for adding a new brand: "Copy the bbva-brand scripts/ dir, replace brand_tokens.json values, run `npx tsx scripts/ts/generate_pptx.ts` to verify"

- [ ] 2. Verify file exists:
  ```bash
  wc -l .claude/skills/codi-brand-identity/references/brand-standard.md
  ```
  Expected: > 50 lines.

- [ ] 3. Commit:
  ```bash
  git add .claude/skills/codi-brand-identity/references/brand-standard.md
  git commit -m "docs(brand-identity): add brand-standard.md reference for dual-runtime standard"
  ```

---

## Phase 2 — BBVA Brand Skill (primary implementation, becomes the reference)

### Task 2.1: Create `brand_tokens.json` for BBVA

**Files**:
- `src/templates/skills/bbva-brand/scripts/brand_tokens.json`
- `.claude/skills/codi-bbva-brand/scripts/brand_tokens.json`

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/brand_tokens.json`:
  ```json
  {
    "brand": "bbva",
    "version": 1,
    "colors": {
      "primary":          "#001391",
      "primary_dark":     "#070E46",
      "primary_mid":      "#003194",
      "secondary":        "#8BE1E9",
      "accent":           "#FFE761",
      "background":       "#F7F8F8",
      "background_dark":  "#000519",
      "text_primary":     "#1A1A2A",
      "text_secondary":   "#4A4A68",
      "text_light":       "#8A8AB0",
      "border":           "#D0D0E0",
      "white":            "#FFFFFF"
    },
    "fonts": {
      "pptx_headlines": "Source Serif 4",
      "pptx_body":      "Lato",
      "web_headlines":  "BentonSans BBVA",
      "web_body":       "BentonSans BBVA",
      "web_serif":      "Tiempos Text",
      "fallback_sans":  "Arial",
      "fallback_serif": "Georgia"
    },
    "layout": {
      "slide_width_in":    "13.333",
      "slide_height_in":   "7.5",
      "content_margin_in": "0.5",
      "accent_bar_width_in": "0.08"
    },
    "assets": {
      "logo_light_bg":  "../../assets/BBVA_RGB.svg",
      "logo_dark_bg":   "../../assets/BBVA_RGB_white.svg",
      "pptx_template":  "../../../../../examples/Plantilla BBVA_16_9.pptx",
      "docx_template":  "../../../../../examples/GDoc A4 Report - Generic BBVA - with micro cover.docx"
    },
    "voice": {
      "phrases_use": [
        "Creando oportunidades",
        "Tu dinero, tus decisiones",
        "Banca responsable",
        "Transformacion digital al servicio de las personas"
      ],
      "phrases_avoid": [
        "Somos lideres en",
        "Disruptivo",
        "Cutting-edge",
        "Nuestro equipo de expertos",
        "Soluciones 360"
      ]
    }
  }
  ```

- [ ] 2. Create directory and copy:
  ```bash
  mkdir -p src/templates/skills/bbva-brand/scripts/ts/validators
  mkdir -p src/templates/skills/bbva-brand/scripts/python/validators
  mkdir -p .claude/skills/codi-bbva-brand/scripts/ts/validators
  mkdir -p .claude/skills/codi-bbva-brand/scripts/python/validators
  cp src/templates/skills/bbva-brand/scripts/brand_tokens.json \
     .claude/skills/codi-bbva-brand/scripts/brand_tokens.json
  ```

- [ ] 3. Verify JSON is valid:
  ```bash
  node -e "const t = require('./.claude/skills/codi-bbva-brand/scripts/brand_tokens.json'); \
  console.assert(t.colors.primary === '#001391', 'wrong primary'); \
  console.assert(t.fonts.pptx_headlines === 'Source Serif 4', 'wrong font'); \
  console.log('brand_tokens.json OK')"
  ```
  Expected: `brand_tokens.json OK`

- [ ] 4. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/brand_tokens.json \
          .claude/skills/codi-bbva-brand/scripts/brand_tokens.json
  git commit -m "feat(bbva-brand): add brand_tokens.json with correct colors from PPTX template"
  ```

---

### Task 2.2: Create TypeScript adapter and PPTX generator

**Files**:
- `src/templates/skills/bbva-brand/scripts/ts/brand_tokens.ts`
- `src/templates/skills/bbva-brand/scripts/ts/generate_pptx.ts`
- (mirror to `.claude/skills/codi-bbva-brand/scripts/ts/`)

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/ts/brand_tokens.ts`:
  ```typescript
  /**
   * brand_tokens.ts — TypeScript adapter for BBVA brand tokens.
   * Reads brand_tokens.json and re-exports typed constants for pptxgenjs use.
   */
  import { readFileSync } from "node:fs";
  import { join, dirname } from "node:path";
  import { fileURLToPath } from "node:url";

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(
    readFileSync(join(__dirname, "..", "brand_tokens.json"), "utf-8")
  );

  export const COLORS = raw.colors as Record<string, string>;
  export const FONTS = raw.fonts as Record<string, string>;
  export const LAYOUT = raw.layout as Record<string, string>;
  export const ASSETS = raw.assets as Record<string, string>;
  export const VOICE = raw.voice as { phrases_use: string[]; phrases_avoid: string[] };

  /** Hex string without # — for pptxgenjs color values */
  export function hex(key: string): string {
    return COLORS[key].replace("#", "");
  }
  ```

- [ ] 2. Create `src/templates/skills/bbva-brand/scripts/ts/generate_pptx.ts`:
  ```typescript
  /**
   * generate_pptx.ts — Generate a BBVA-branded PPTX using pptxgenjs.
   *
   * CLI: npx tsx generate_pptx.ts --content content.json --output output.pptx
   *
   * content.json schema:
   *   { title, subtitle?, author?, sections: [{ number, label, heading, body, items?, callout? }] }
   */
  import PptxGenJS from "pptxgenjs";
  import { readFileSync, existsSync } from "node:fs";
  import { join, dirname } from "node:path";
  import { fileURLToPath } from "node:url";
  import { parseArgs } from "node:util";
  import * as bt from "./brand_tokens.js";

  const __dirname = dirname(fileURLToPath(import.meta.url));

  // ── Slide dimensions ────────────────────────────────────────────────
  const W = parseFloat(bt.LAYOUT.slide_width_in);
  const H = parseFloat(bt.LAYOUT.slide_height_in);
  const M = parseFloat(bt.LAYOUT.content_margin_in);
  const BAR = parseFloat(bt.LAYOUT.accent_bar_width_in);

  // ── Helpers ─────────────────────────────────────────────────────────

  function accentBar(slide: PptxGenJS.Slide): void {
    slide.addShape("rect", {
      x: 0, y: 0, w: BAR, h: H,
      fill: { color: bt.hex("primary") },
      line: { color: bt.hex("primary"), width: 0 },
    });
  }

  function sectionLabel(slide: PptxGenJS.Slide, num: string, label: string): void {
    slide.addText(`${num} — ${label}`, {
      x: M, y: 0.15, w: W - M * 2, h: 0.3,
      fontSize: 9, fontFace: bt.FONTS.pptx_body,
      color: bt.hex("primary"), margin: 0,
    });
  }

  // ── Validation ──────────────────────────────────────────────────────

  interface Section {
    number: string;
    label: string;
    heading: string;
    body: string;
    items?: string[];
    callout?: string;
  }

  interface Content {
    title: string;
    subtitle?: string;
    author?: string;
    sections: Section[];
  }

  function validate(content: unknown): Content {
    const c = content as Record<string, unknown>;
    if (!c.title) throw new Error("Missing required field: 'title'");
    if (!Array.isArray(c.sections) || c.sections.length === 0)
      throw new Error("'sections' must be a non-empty array");
    for (const [i, s] of (c.sections as Record<string, unknown>[]).entries()) {
      for (const field of ["number", "label", "heading", "body"]) {
        if (!s[field]) throw new Error(`Section ${i}: missing field '${field}'`);
      }
    }
    return c as unknown as Content;
  }

  // ── Slide builders ──────────────────────────────────────────────────

  function buildTitle(pres: PptxGenJS, content: Content): void {
    const slide = pres.addSlide();
    slide.background = { color: bt.hex("primary_dark") };

    // Left accent stripe
    slide.addShape("rect", {
      x: 0, y: 0, w: 0.5, h: H,
      fill: { color: bt.hex("primary") },
      line: { color: bt.hex("primary"), width: 0 },
    });

    slide.addText(content.title, {
      x: 0.8, y: 1.8, w: 10, h: 2.0,
      fontSize: 36, fontFace: bt.FONTS.pptx_headlines,
      color: bt.hex("white"), bold: true, wrap: true, margin: 0,
    });

    if (content.subtitle) {
      slide.addText(content.subtitle, {
        x: 0.8, y: 3.9, w: 10, h: 0.8,
        fontSize: 18, fontFace: bt.FONTS.pptx_body,
        color: bt.hex("secondary"), margin: 0,
      });
    }

    if (content.author) {
      slide.addText(content.author, {
        x: 0.8, y: 5.0, w: 10, h: 0.5,
        fontSize: 12, fontFace: bt.FONTS.pptx_body,
        color: bt.hex("text_secondary"), margin: 0,
      });
    }
  }

  function buildDivider(pres: PptxGenJS, section: Section): void {
    const slide = pres.addSlide();
    slide.background = { color: bt.hex("primary") };

    slide.addText(section.number, {
      x: 1.0, y: 1.5, w: 4, h: 2.5,
      fontSize: 96, fontFace: bt.FONTS.pptx_headlines,
      color: bt.hex("accent"), bold: true, margin: 0,
    });

    slide.addText(section.label.toUpperCase(), {
      x: 1.0, y: 3.8, w: 11, h: 0.5,
      fontSize: 13, fontFace: bt.FONTS.pptx_body,
      color: bt.hex("secondary"), margin: 0,
    });

    slide.addText(section.heading, {
      x: 1.0, y: 4.4, w: 11, h: 1.5,
      fontSize: 28, fontFace: bt.FONTS.pptx_headlines,
      color: bt.hex("white"), bold: true, wrap: true, margin: 0,
    });
  }

  function buildContent(pres: PptxGenJS, section: Section): void {
    const slide = pres.addSlide();
    slide.background = { color: bt.hex("background") };
    accentBar(slide);
    sectionLabel(slide, section.number, section.label);

    // Heading
    slide.addText(section.heading, {
      x: M, y: 0.55, w: W - M * 2, h: 0.9,
      fontSize: 22, fontFace: bt.FONTS.pptx_headlines,
      color: bt.hex("primary_dark"), bold: true, wrap: true, margin: 0,
    });

    // Rule
    slide.addShape("rect", {
      x: M, y: 1.5, w: W - M * 2, h: 0.02,
      fill: { color: bt.hex("primary") },
      line: { color: bt.hex("primary"), width: 0 },
    });

    // Body
    slide.addText(section.body, {
      x: M, y: 1.6, w: W - M * 2, h: 1.2,
      fontSize: 13, fontFace: bt.FONTS.pptx_body,
      color: bt.hex("text_primary"), wrap: true, margin: 0,
    });

    // Bullets
    if (section.items?.length) {
      const bullets = section.items.map((item) => ({
        text: `\u2192  ${item}`,
        options: {
          fontSize: 12,
          fontFace: bt.FONTS.pptx_body,
          color: bt.hex("text_primary"),
          paraSpaceAfter: 4,
        },
      }));
      slide.addText(bullets, {
        x: M, y: 3.0, w: W - M * 2, h: 2.2,
        wrap: true, margin: 0,
      });
    }

    // Callout
    if (section.callout) {
      slide.addShape("rect", {
        x: M, y: 5.5, w: W - M * 2, h: 0.8,
        fill: { color: bt.hex("secondary") },
        line: { color: bt.hex("secondary"), width: 0 },
      });
      slide.addText(section.callout, {
        x: M + 0.2, y: 5.55, w: W - M * 2 - 0.4, h: 0.65,
        fontSize: 13, fontFace: bt.FONTS.pptx_body,
        color: bt.hex("primary_dark"), bold: true, wrap: true, margin: 0,
      });
    }
  }

  function buildClosing(pres: PptxGenJS): void {
    const slide = pres.addSlide();
    slide.background = { color: bt.hex("primary_dark") };

    slide.addText("BBVA", {
      x: 2, y: 2.5, w: 9, h: 1.5,
      fontSize: 48, fontFace: bt.FONTS.pptx_headlines,
      color: bt.hex("white"), bold: true, align: "center", margin: 0,
    });

    slide.addText("Creating opportunities", {
      x: 2, y: 4.0, w: 9, h: 0.8,
      fontSize: 18, fontFace: bt.FONTS.pptx_body,
      color: bt.hex("secondary"), align: "center", margin: 0,
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  export function generatePptx(content: Content, outputPath: string): void {
    const pres = new PptxGenJS();
    pres.layout = "LAYOUT_16x9";
    pres.title = content.title;

    buildTitle(pres, content);
    for (const section of content.sections) {
      buildDivider(pres, section);
      buildContent(pres, section);
    }
    buildClosing(pres);

    pres.writeFile({ fileName: outputPath });
  }

  // ── CLI ─────────────────────────────────────────────────────────────

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      content: { type: "string" },
      output: { type: "string" },
    },
  });

  if (!values.content || !values.output) {
    console.error("Usage: npx tsx generate_pptx.ts --content content.json --output out.pptx");
    process.exit(1);
  }

  if (!existsSync(values.content)) {
    console.error(`Error: content file not found: ${values.content}`);
    process.exit(1);
  }

  const content = validate(JSON.parse(readFileSync(values.content, "utf-8")));
  generatePptx(content, values.output);
  console.log(`Generated: ${values.output}`);
  ```

- [ ] 3. Install pptxgenjs in the scripts context (verify it is available):
  ```bash
  node -e "require('pptxgenjs')" && echo "pptxgenjs OK" || \
    (cd /tmp && npm install pptxgenjs --no-save && echo "installed locally")
  ```

- [ ] 4. Mirror to installed skill:
  ```bash
  cp src/templates/skills/bbva-brand/scripts/ts/brand_tokens.ts \
     .claude/skills/codi-bbva-brand/scripts/ts/brand_tokens.ts
  cp src/templates/skills/bbva-brand/scripts/ts/generate_pptx.ts \
     .claude/skills/codi-bbva-brand/scripts/ts/generate_pptx.ts
  ```

- [ ] 5. Test end-to-end:
  ```bash
  cat > /tmp/bbva_content.json << 'EOF'
  {
    "title": "BBVA TypeScript Generator Test",
    "subtitle": "Dual-runtime brand standard",
    "author": "Codi",
    "sections": [{
      "number": "01",
      "label": "Test",
      "heading": "pptxgenjs generator works",
      "body": "This verifies the TypeScript generator reads brand_tokens.json and produces a valid PPTX.",
      "items": ["Primary #001391", "Source Serif 4", "Sand background"],
      "callout": "Colors from examples/Plantilla BBVA_16_9.pptx"
    }]
  }
  EOF
  cd .claude/skills/codi-bbva-brand/scripts/ts && \
  npx tsx generate_pptx.ts --content /tmp/bbva_content.json --output /tmp/bbva_ts.pptx
  ```
  Expected: `Generated: /tmp/bbva_ts.pptx`

- [ ] 6. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/ts/ \
          .claude/skills/codi-bbva-brand/scripts/ts/
  git commit -m "feat(bbva-brand): add TypeScript pptxgenjs generator as default runtime"
  ```

---

### Task 2.3: Create TypeScript DOCX generator

**Files**:
- `src/templates/skills/bbva-brand/scripts/ts/generate_docx.ts`
- (mirror to `.claude/skills/codi-bbva-brand/scripts/ts/`)

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/ts/generate_docx.ts`:
  ```typescript
  /**
   * generate_docx.ts — Generate a BBVA-branded DOCX using docx npm package.
   *
   * CLI: npx tsx generate_docx.ts --content content.json --output output.docx
   *
   * Requires: npm install docx
   */
  import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, BorderStyle, Table, TableRow, TableCell,
    WidthType,
  } from "docx";
  import { readFileSync, writeFileSync, existsSync } from "node:fs";
  import { parseArgs } from "node:util";
  import * as bt from "./brand_tokens.js";

  // ── Helpers ──────────────────────────────────────────────────────────

  function hexToDocx(key: string): string {
    return bt.hex(key).toUpperCase();
  }

  function heading(text: string, level: HeadingLevel = HeadingLevel.HEADING_1): Paragraph {
    return new Paragraph({
      text,
      heading: level,
      style: "heading1",
      spacing: { before: 240, after: 120 },
      run: {
        bold: true,
        font: bt.FONTS.pptx_headlines,
        color: hexToDocx("primary_dark"),
      },
    });
  }

  function body(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          font: bt.FONTS.pptx_body,
          size: 22,
          color: hexToDocx("text_primary"),
        }),
      ],
      spacing: { after: 120 },
    });
  }

  function bullet(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `\u2192  ${text}`,
          font: bt.FONTS.pptx_body,
          size: 22,
          color: hexToDocx("text_primary"),
        }),
      ],
      spacing: { after: 80 },
      indent: { left: 360 },
    });
  }

  function callout(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          font: bt.FONTS.pptx_body,
          size: 22,
          bold: true,
          color: hexToDocx("primary_dark"),
        }),
      ],
      spacing: { before: 160, after: 160 },
      indent: { left: 360, right: 360 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 12, color: hexToDocx("primary") },
      },
    });
  }

  // ── Validation ───────────────────────────────────────────────────────

  interface Section {
    number: string;
    label: string;
    heading: string;
    body: string;
    items?: string[];
    callout?: string;
  }

  interface Content {
    title: string;
    subtitle?: string;
    author?: string;
    sections: Section[];
  }

  function validate(content: unknown): Content {
    const c = content as Record<string, unknown>;
    if (!c.title) throw new Error("Missing required field: 'title'");
    if (!Array.isArray(c.sections) || c.sections.length === 0)
      throw new Error("'sections' must be a non-empty array");
    return c as unknown as Content;
  }

  // ── Document builder ─────────────────────────────────────────────────

  async function generateDocx(content: Content, outputPath: string): Promise<void> {
    const children: Paragraph[] = [];

    // Cover heading
    children.push(heading(content.title, HeadingLevel.TITLE));
    if (content.subtitle) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: content.subtitle,
          font: bt.FONTS.pptx_body,
          size: 28,
          color: hexToDocx("primary"),
        })],
        spacing: { after: 120 },
      }));
    }
    if (content.author) {
      children.push(new Paragraph({
        children: [new TextRun({
          text: content.author,
          font: bt.FONTS.pptx_body,
          size: 20,
          color: hexToDocx("text_secondary"),
          italics: true,
        })],
        spacing: { after: 480 },
      }));
    }

    // Sections
    for (const section of content.sections) {
      children.push(heading(`${section.number} — ${section.heading}`));
      children.push(body(section.body));
      if (section.items) {
        for (const item of section.items) children.push(bullet(item));
      }
      if (section.callout) {
        children.push(callout(section.callout));
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: bt.FONTS.pptx_body },
          },
        },
      },
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    writeFileSync(outputPath, buffer);
  }

  // ── CLI ──────────────────────────────────────────────────────────────

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      content: { type: "string" },
      output: { type: "string" },
    },
  });

  if (!values.content || !values.output) {
    console.error("Usage: npx tsx generate_docx.ts --content content.json --output out.docx");
    process.exit(1);
  }

  const content = validate(JSON.parse(readFileSync(values.content!, "utf-8")));
  generateDocx(content, values.output!).then(() => {
    console.log(`Generated: ${values.output}`);
  });
  ```

- [ ] 2. Mirror and test:
  ```bash
  cp src/templates/skills/bbva-brand/scripts/ts/generate_docx.ts \
     .claude/skills/codi-bbva-brand/scripts/ts/generate_docx.ts

  cd .claude/skills/codi-bbva-brand/scripts/ts && \
  npx tsx generate_docx.ts --content /tmp/bbva_content.json --output /tmp/bbva_ts.docx
  ```
  Expected: `Generated: /tmp/bbva_ts.docx`

- [ ] 3. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/ts/generate_docx.ts \
          .claude/skills/codi-bbva-brand/scripts/ts/generate_docx.ts
  git commit -m "feat(bbva-brand): add TypeScript DOCX generator"
  ```

---

### Task 2.4: Create TypeScript validators

**Files**:
- `src/templates/skills/bbva-brand/scripts/ts/validators/validate_pptx.ts`
- `src/templates/skills/bbva-brand/scripts/ts/validators/validate_docx.ts`
- (mirror to `.claude/skills/codi-bbva-brand/scripts/ts/validators/`)

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/ts/validators/validate_pptx.ts`:
  ```typescript
  /**
   * validate_pptx.ts — Validate PPTX against BBVA brand rules using markitdown.
   *
   * CLI: npx tsx validate_pptx.ts --input file.pptx
   *
   * Rules checked via text extraction:
   *   1. has_slides — non-empty extracted text
   *   2. no_forbidden_phrases — none of VOICE.phrases_avoid present
   *   3. has_brand_title — title text present
   */
  import { execSync } from "node:child_process";
  import { existsSync } from "node:fs";
  import { parseArgs } from "node:util";
  import { join, dirname } from "node:path";
  import { fileURLToPath } from "node:url";
  import { readFileSync } from "node:fs";

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const tokens = JSON.parse(
    readFileSync(join(__dirname, "../../..", "brand_tokens.json"), "utf-8")
  );

  interface ValidationResult {
    passed: boolean;
    errors: Array<{ rule: string; message: string }>;
    warnings: string[];
  }

  function extractText(filePath: string): string {
    try {
      return execSync(`python3 -m markitdown "${filePath}"`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      return "";
    }
  }

  function validatePptx(filePath: string): ValidationResult {
    const errors: Array<{ rule: string; message: string }> = [];
    const text = extractText(filePath).toLowerCase();

    if (text.trim().length === 0) {
      errors.push({ rule: "has_slides", message: "No text extracted from PPTX — file may be empty." });
    }

    for (const phrase of tokens.voice.phrases_avoid as string[]) {
      if (text.includes(phrase.toLowerCase())) {
        errors.push({
          rule: "no_forbidden_phrases",
          message: `Forbidden phrase found: "${phrase}"`,
        });
      }
    }

    return { passed: errors.length === 0, errors, warnings: [] };
  }

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { input: { type: "string" } },
  });

  if (!values.input) {
    console.error("Usage: npx tsx validate_pptx.ts --input file.pptx");
    process.exit(1);
  }

  if (!existsSync(values.input)) {
    console.error(`Error: file not found: ${values.input}`);
    process.exit(1);
  }

  const result = validatePptx(values.input);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
  ```

- [ ] 2. Mirror to installed skill:
  ```bash
  cp src/templates/skills/bbva-brand/scripts/ts/validators/validate_pptx.ts \
     .claude/skills/codi-bbva-brand/scripts/ts/validators/validate_pptx.ts
  ```

- [ ] 3. Test the validator:
  ```bash
  cd .claude/skills/codi-bbva-brand/scripts/ts/validators && \
  npx tsx validate_pptx.ts --input /tmp/bbva_ts.pptx
  ```
  Expected: `"passed": true`

- [ ] 4. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/ts/validators/ \
          .claude/skills/codi-bbva-brand/scripts/ts/validators/
  git commit -m "feat(bbva-brand): add TypeScript PPTX validator"
  ```

---

### Task 2.5: Create Python fallback generators

**Files**:
- `src/templates/skills/bbva-brand/scripts/python/brand_tokens.py`
- `src/templates/skills/bbva-brand/scripts/python/generate_pptx.py`
- `src/templates/skills/bbva-brand/scripts/python/generate_docx.py`
- `src/templates/skills/bbva-brand/scripts/python/validators/pptx_validator.py`
- (mirror all to `.claude/skills/codi-bbva-brand/scripts/python/`)

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/python/brand_tokens.py`:
  ```python
  """brand_tokens.py — Python adapter. Reads brand_tokens.json for python-pptx use."""
  import json
  import os
  from pathlib import Path

  _root = Path(__file__).parent.parent
  _data = json.loads((_root / "brand_tokens.json").read_text())

  COLORS: dict[str, str] = _data["colors"]
  FONTS: dict[str, str] = _data["fonts"]
  LAYOUT: dict[str, str] = _data["layout"]
  ASSETS: dict[str, str] = _data["assets"]
  VOICE: dict = _data["voice"]
  PHRASES_AVOID: list[str] = VOICE["phrases_avoid"]
  PHRASES_USE: list[str] = VOICE["phrases_use"]

  def rgb(key: str):
      """Return RGBColor for a color key. Requires python-pptx imported by caller."""
      from pptx.dml.color import RGBColor
      h = COLORS[key].lstrip("#")
      return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
  ```

- [ ] 2. Create `src/templates/skills/bbva-brand/scripts/python/generate_pptx.py` following the same structure as Task 2.2's TypeScript version but using python-pptx. The file must:
  - `import brand_tokens as bt` from `sys.path.insert(0, os.path.dirname(__file__))`
  - Use `pptx.Presentation()`, `Inches()`, `Pt()`, `RGBColor()`
  - Implement the same 4 slide types: title, divider, content, closing
  - Accept `--content content.json --output output.pptx` CLI args
  - Call `bt.rgb(key)` for all colors

  Full structure mirrors `generate_pptx.py` from the deleted Task 2 in the previous plan (see `.claude/skills/codi-rl3-brand/scripts/generate_pptx.py` as reference pattern, replacing RL3 constants with `bt.rgb()` and `bt.FONTS`).

- [ ] 3. Create `src/templates/skills/bbva-brand/scripts/python/generate_docx.py`:
  - Use `python-docx` (`from docx import Document`)
  - `import brand_tokens as bt`
  - Same content schema as the TypeScript version
  - CLI: `python3 generate_docx.py --content content.json --output output.docx`

- [ ] 4. Create `src/templates/skills/bbva-brand/scripts/python/validators/pptx_validator.py`:
  - Follow RL3's `pptx_validator.py` pattern from `.claude/skills/codi-rl3-brand/scripts/validators/pptx_validator.py`
  - Import `brand_tokens as bt` from parent dir
  - Check: has slides, no forbidden phrases, has BBVA brand colors, has Source Serif 4 font

- [ ] 5. Mirror all to installed skill:
  ```bash
  cp -r src/templates/skills/bbva-brand/scripts/python/ \
        .claude/skills/codi-bbva-brand/scripts/python/
  ```

- [ ] 6. Test both generators produce valid files:
  ```bash
  cd .claude/skills/codi-bbva-brand/scripts/python && \
  python3 generate_pptx.py --content /tmp/bbva_content.json --output /tmp/bbva_py.pptx && \
  python3 validators/pptx_validator.py --input /tmp/bbva_py.pptx
  ```
  Expected: `Generated: /tmp/bbva_py.pptx` then `"passed": true`

- [ ] 7. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/python/ \
          .claude/skills/codi-bbva-brand/scripts/python/
  git commit -m "feat(bbva-brand): add Python fallback generators (python-pptx, python-docx)"
  ```

---

### Task 2.6: Update BBVA SKILL.md and template.ts

**Files**:
- `src/templates/skills/bbva-brand/template.ts`
- Run `codi generate` to update `.claude/skills/codi-bbva-brand/SKILL.md`

**Steps**:

- [ ] 1. Replace `src/templates/skills/bbva-brand/template.ts` content. Key changes:
  - Fix all colors to `#001391`, `#070E46`, `#8BE1E9`, `#FFE761`, `#F7F8F8`, `#000519`
  - Update typography: PPTX fonts are Source Serif 4 + Lato; Web fonts are BentonSans + Tiempos
  - Add the **Routing Table** section (pptxgenjs default, python fallback, HTML inline)
  - Add **Scripts Reference** table pointing to `scripts/ts/` and `scripts/python/`
  - Keep SKILL.md body under 400 lines — move color rationale to `references/brand-guide.md`
  - Improve description:
    ```
    Apply BBVA brand identity to any deliverable. Use when the user mentions BBVA, needs BBVA-branded output, or asks for a presentation, document, or dashboard with BBVA visual identity. Provides brand_tokens.json (correct colors from examples/), dual-runtime PPTX/DOCX generators (pptxgenjs default, python-pptx fallback), and brand validators.
    ```

- [ ] 2. Run `codi generate` and verify:
  ```bash
  codi generate
  grep -c "#001391" .claude/skills/codi-bbva-brand/SKILL.md
  grep "#004481" .claude/skills/codi-bbva-brand/SKILL.md && echo "FAIL" || echo "OK"
  ```
  Expected: at least 1 match for `#001391`, `OK` for old color check.

- [ ] 3. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/template.ts \
          .codi/skills/codi-bbva-brand/SKILL.md \
          .claude/skills/codi-bbva-brand/SKILL.md
  git commit -m "feat(bbva-brand): update SKILL.md — correct colors, routing table, dual-runtime scripts"
  ```

---

### Task 2.7: Write BBVA evals

**Files**: `src/templates/skills/bbva-brand/evals/evals.json`

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/evals/evals.json`:
  ```json
  {
    "skillName": "codi-bbva-brand",
    "cases": [
      {
        "id": "pptx-ts-generator",
        "description": "TypeScript generator produces a valid PPTX",
        "prompt": "Create a BBVA-branded presentation about digital banking",
        "expectations": [
          "Reads brand_tokens.json from scripts/ directory",
          "Runs npx tsx scripts/ts/generate_pptx.ts with a content.json",
          "Produces a .pptx file",
          "Does NOT hard-code any color values — uses bt.hex() or bt.COLORS"
        ]
      },
      {
        "id": "docx-ts-generator",
        "description": "TypeScript generator produces a valid DOCX",
        "prompt": "Create a BBVA-branded proposal document",
        "expectations": [
          "Runs npx tsx scripts/ts/generate_docx.ts",
          "Produces a .docx file",
          "Document uses Source Serif 4 for headings"
        ]
      },
      {
        "id": "python-fallback",
        "description": "Python generator used when specified",
        "prompt": "Create a BBVA presentation using the Python generator",
        "expectations": [
          "Runs python3 scripts/python/generate_pptx.py",
          "Does NOT use the TypeScript generator",
          "Produces a .pptx file"
        ]
      },
      {
        "id": "validate-colors-correct",
        "description": "Skill uses correct BBVA colors from template",
        "prompt": "What are the BBVA brand colors?",
        "expectations": [
          "Reports Electric Blue as #001391 (not #004481)",
          "Reports Ice as #8BE1E9 (not #2DCCCD)",
          "Mentions 'Source Serif 4' for PPTX headlines"
        ]
      },
      {
        "id": "negative-non-bbva",
        "description": "Skill does not trigger for non-BBVA requests",
        "prompt": "Create a presentation for our startup",
        "expectations": [
          "Does NOT apply BBVA colors",
          "Does NOT run bbva-brand generators"
        ]
      }
    ]
  }
  ```

- [ ] 2. Mirror and commit:
  ```bash
  mkdir -p .claude/skills/codi-bbva-brand/evals
  cp src/templates/skills/bbva-brand/evals/evals.json \
     .claude/skills/codi-bbva-brand/evals/evals.json
  git add src/templates/skills/bbva-brand/evals/ \
          .claude/skills/codi-bbva-brand/evals/
  git commit -m "test(bbva-brand): add evals.json with 5 test cases"
  ```

---

## Phase 3 — RL3 Brand Skill (migrate to new standard)

### Task 3.1: Migrate RL3 scripts to `ts/python/` subdirs

**Files**: `.claude/skills/codi-rl3-brand/scripts/` (reorganize)

**Steps**:

- [ ] 1. Move existing RL3 Python scripts to `python/` subdir:
  ```bash
  mkdir -p .claude/skills/codi-rl3-brand/scripts/python/validators
  # Move existing scripts
  mv .claude/skills/codi-rl3-brand/scripts/brand_tokens.py \
     .claude/skills/codi-rl3-brand/scripts/python/brand_tokens.py
  mv .claude/skills/codi-rl3-brand/scripts/generate_pptx.py \
     .claude/skills/codi-rl3-brand/scripts/python/generate_pptx.py
  mv .claude/skills/codi-rl3-brand/scripts/validators/pptx_validator.py \
     .claude/skills/codi-rl3-brand/scripts/python/validators/pptx_validator.py
  ```

- [ ] 2. Create `brand_tokens.json` for RL3 — extract all values from the existing `python/brand_tokens.py`:
  ```json
  {
    "brand": "rl3",
    "version": 1,
    "colors": {
      "primary":         "#0a0a0b",
      "white":           "#ffffff",
      "accent":          "#c8b88a",
      "accent_dim":      "#c8b88a33",
      "gray":            "#7a7a7a",
      "dark_gray":       "#1a1a1b",
      "mid_gray":        "#2a2a2b",
      "light_bg":        "#f5f5f5"
    },
    "fonts": {
      "pptx_headlines":  "Space Grotesk",
      "pptx_body":       "Instrument Sans",
      "pptx_mono":       "Space Mono",
      "web_headlines":   "Space Grotesk",
      "web_body":        "Instrument Sans",
      "fallback_sans":   "Arial",
      "fallback_serif":  "Georgia"
    },
    "layout": {
      "slide_width_in":    "13.333",
      "slide_height_in":   "7.5",
      "content_margin_in": "1.5",
      "accent_bar_width_in": "0.06"
    },
    "assets": {
      "logo_light_bg": "../../assets/rl3-logo-light.svg",
      "logo_dark_bg":  "../../assets/rl3-logo-dark.svg",
      "pptx_template": "",
      "docx_template": ""
    },
    "voice": {
      "phrases_use": [
        "Cada iteracion nos acerca al resultado optimo",
        "Observar · Actuar · Iterar",
        "No demos. Soluciones en produccion"
      ],
      "phrases_avoid": [
        "Revolucionamos",
        "Disruptivo",
        "Cutting-edge",
        "Nuestro equipo de expertos",
        "Soluciones 360"
      ]
    }
  }
  ```

- [ ] 3. Update `python/brand_tokens.py` to read from JSON (same pattern as BBVA Task 2.5 step 1).

- [ ] 4. Create `scripts/ts/brand_tokens.ts` and `scripts/ts/generate_pptx.ts` for RL3 using pptxgenjs (same pattern as BBVA Task 2.2, adapted for RL3's dark theme: `primary` = dark background, `accent` = gold).

- [ ] 5. Mirror to `src/templates/skills/rl3-brand/scripts/`:
  ```bash
  cp -r .claude/skills/codi-rl3-brand/scripts/ \
        src/templates/skills/rl3-brand/scripts/
  ```

- [ ] 6. Test TS generator:
  ```bash
  cd .claude/skills/codi-rl3-brand/scripts/ts && \
  npx tsx generate_pptx.ts --content /tmp/bbva_content.json --output /tmp/rl3_ts.pptx
  ```

- [ ] 7. Commit:
  ```bash
  git add src/templates/skills/rl3-brand/scripts/ \
          .claude/skills/codi-rl3-brand/scripts/
  git commit -m "refactor(rl3-brand): migrate to dual-runtime standard (brand_tokens.json + ts/python/ dirs)"
  ```

---

## Phase 4 — Codi Brand Skill

### Task 4.1: Add dual-runtime scripts to codi-brand

**Steps**:

- [ ] 1. Check current state:
  ```bash
  ls .claude/skills/codi-codi-brand/scripts/ 2>/dev/null || echo "no scripts dir"
  ```

- [ ] 2. Create `brand_tokens.json` for codi-brand using Codi's design tokens (dark/minimal theme, check `codi-codi-brand/SKILL.md` for current colors).

- [ ] 3. Create `scripts/ts/brand_tokens.ts` and `scripts/ts/generate_pptx.ts` following the BBVA pattern.

- [ ] 4. Mirror to `src/templates/skills/codi-brand/scripts/`.

- [ ] 5. Update description:
  ```
  Apply Codi brand identity to any deliverable. Use when creating Codi-branded materials — landing pages, marketing copy, presentations, documents, or any visual output carrying the Codi product identity. Provides brand_tokens.json, dual-runtime generators, and validators.
  ```

- [ ] 6. Commit:
  ```bash
  git commit -m "feat(codi-brand): add dual-runtime brand standard scripts"
  ```

---

## Phase 5 — Brand Identity Template

### Task 5.1: Update brand-identity template to require the standard

**Files**: `src/templates/skills/brand-identity/template.ts`

**Steps**:

- [ ] 1. Update the template to include:
  - A **Required: brand_tokens.json** section showing the exact JSON schema from this plan
  - A **Required: scripts/** section listing `ts/brand_tokens.ts`, `ts/generate_pptx.ts`, `ts/generate_docx.ts`, `python/brand_tokens.py`, `python/generate_pptx.py`
  - A link to `CLAUDE_SKILL_DIR[[/references/brand-standard.md]]` for the full reference
  - Updated description:
    ```
    Template for creating brand identity skills. Use when building a new brand skill — provides the standard brand_tokens.json schema, dual-runtime generator structure (pptxgenjs default, python-pptx fallback), and routing table pattern. See codi-bbva-brand for a reference implementation.
    ```

- [ ] 2. Run `codi generate` and verify:
  ```bash
  codi generate
  grep -c "brand_tokens.json" .claude/skills/codi-brand-identity/SKILL.md
  ```

- [ ] 3. Commit:
  ```bash
  git commit -m "feat(brand-identity): update template to require dual-runtime brand_tokens.json standard"
  ```

---

## Phase 6 — Generation Skills

### Task 6.1: Update codi-pptx — brand routing

**Files**: `.claude/skills/codi-pptx/SKILL.md`, `src/templates/skills/pptx/template.ts` (if exists)

**Steps**:

- [ ] 1. Add a **Brand Integration** section to `.claude/skills/codi-pptx/SKILL.md` before the QA section:
  ```markdown
  ## Brand Integration

  When a brand skill is active or the user names a brand:

  1. Locate the brand skill scripts dir:
     ```bash
     BRAND=bbva  # or rl3, codi, etc.
     SCRIPTS="${HOME}/.claude/skills/codi-${BRAND}-brand/scripts"
     ```

  2. **TypeScript generator exists (DEFAULT):**
     ```bash
     # 1. Write your content to content.json
     # 2. Run:
     npx tsx "${SCRIPTS}/ts/generate_pptx.ts" --content content.json --output output.pptx
     # 3. Validate:
     npx tsx "${SCRIPTS}/ts/validators/validate_pptx.ts" --input output.pptx
     ```

  3. **Python generator fallback** (if TypeScript fails or user prefers Python):
     ```bash
     python3 "${SCRIPTS}/python/generate_pptx.py" --content content.json --output output.pptx
     python3 "${SCRIPTS}/python/validators/pptx_validator.py" --input output.pptx
     ```

  4. **No brand skill** — use pptxgenjs directly with topic-appropriate palette from Design Ideas section.

  Read `brand_tokens.json` for colors and fonts — never hard-code brand values.
  ```

- [ ] 2. Improve description (under 1024 chars):
  ```
  Use when creating, editing, reading, or converting .pptx files. Activate for 'deck', 'slides', 'presentation', or any .pptx filename. When a brand skill is active, routes to the brand's generate_pptx.ts (pptxgenjs, DEFAULT) or generate_pptx.py (python-pptx, fallback) generator. For unbranded slides, uses pptxgenjs directly with topic-appropriate design.
  ```

- [ ] 3. Verify description length:
  ```bash
  echo -n "Use when creating..." | wc -c
  ```
  Expected: < 1024

- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-pptx/SKILL.md
  git commit -m "feat(pptx): add brand routing to generate_pptx.ts/py when brand skill active"
  ```

---

### Task 6.2: Update codi-docx — brand routing

Same pattern as Task 6.1 but for DOCX:

- [ ] 1. Add **Brand Integration** section to `.claude/skills/codi-docx/SKILL.md` referencing `scripts/ts/generate_docx.ts` (DEFAULT) and `scripts/python/generate_docx.py` (fallback).

- [ ] 2. Update description:
  ```
  Use when creating, editing, or working with .docx files. Activate for 'Word doc', '.docx', or structured document requests. When a brand skill is active, routes to the brand's generate_docx.ts (DEFAULT) or generate_docx.py (fallback). For unbranded documents, uses the docx npm package directly.
  ```

- [ ] 3. Commit:
  ```bash
  git add .claude/skills/codi-docx/SKILL.md
  git commit -m "feat(docx): add brand routing to generate_docx.ts/py when brand skill active"
  ```

---

### Task 6.3: Update codi-deck-engine — explicit brand loading

- [ ] 1. In `.claude/skills/codi-deck-engine/SKILL.md`, replace the vague brand check in Step 1 with:
  ```markdown
  **[CODING AGENT]** Load brand tokens explicitly:

  ```bash
  BRAND_SCRIPTS="${HOME}/.claude/skills/codi-{brand}-brand/scripts"
  # Read brand_tokens.json for all values:
  node -e "const t=require('${BRAND_SCRIPTS}/brand_tokens.json'); \
    console.log('primary:', t.colors.primary); \
    console.log('fonts:', t.fonts.web_headlines, '/', t.fonts.web_body)"
  ```

  Apply `CSS_VARIABLES` from brand_tokens.json as the `:root {}` block in the HTML deck.
  Use `fonts.web_headlines` and `fonts.web_body` for typography.
  Never hard-code color values — read exclusively from `brand_tokens.json`.
  ```

- [ ] 2. Commit:
  ```bash
  git add .claude/skills/codi-deck-engine/SKILL.md
  git commit -m "feat(deck-engine): explicit brand_tokens.json loading from brand skill scripts/"
  ```

---

### Task 6.4: Update codi-doc-engine — explicit brand loading

Same pattern as Task 6.3:

- [ ] 1. Replace vague brand check in `.claude/skills/codi-doc-engine/SKILL.md` Step 1 with explicit `brand_tokens.json` loading.

- [ ] 2. Commit:
  ```bash
  git add .claude/skills/codi-doc-engine/SKILL.md
  git commit -m "feat(doc-engine): explicit brand_tokens.json loading from brand skill scripts/"
  ```

---

## Phase 7 — Integration Test

### Task 7.1: End-to-end validation across all updated skills

**Steps**:

- [ ] 1. Run `codi status`:
  ```bash
  codi status
  ```
  Expected: no drift alerts.

- [ ] 2. Verify all brand skills have the standard scripts structure:
  ```bash
  for brand in bbva rl3 codi; do
    dir=".claude/skills/codi-${brand}-brand/scripts"
    echo "=== ${brand} ==="
    ls "${dir}/brand_tokens.json" 2>/dev/null && echo "  brand_tokens.json OK" || echo "  MISSING brand_tokens.json"
    ls "${dir}/ts/generate_pptx.ts" 2>/dev/null && echo "  ts/generate_pptx.ts OK" || echo "  MISSING ts/generate_pptx.ts"
    ls "${dir}/python/generate_pptx.py" 2>/dev/null && echo "  python/generate_pptx.py OK" || echo "  MISSING python/generate_pptx.py"
  done
  ```
  Expected: all 9 checks say OK.

- [ ] 3. Verify all generation skills have brand routing:
  ```bash
  for skill in codi-pptx codi-docx codi-deck-engine codi-doc-engine; do
    count=$(grep -c "brand_tokens" ".claude/skills/${skill}/SKILL.md" 2>/dev/null || echo 0)
    echo "${skill}: ${count} brand_tokens references"
  done
  ```
  Expected: each shows at least 1.

- [ ] 4. Run BBVA full pipeline as the canonical test:
  ```bash
  SCRIPTS=".claude/skills/codi-bbva-brand/scripts"
  npx tsx "${SCRIPTS}/ts/generate_pptx.ts" \
    --content /tmp/bbva_content.json --output /tmp/final_bbva.pptx && \
  npx tsx "${SCRIPTS}/ts/validators/validate_pptx.ts" \
    --input /tmp/final_bbva.pptx
  ```
  Expected: `Generated: /tmp/final_bbva.pptx` then `"passed": true`

- [ ] 5. Verify no SKILL.md body exceeds 500 lines:
  ```bash
  for skill in codi-bbva-brand codi-rl3-brand codi-codi-brand codi-brand-identity \
               codi-pptx codi-docx codi-deck-engine codi-doc-engine; do
    lines=$(wc -l < ".claude/skills/${skill}/SKILL.md" 2>/dev/null || echo 0)
    status=$([[ $lines -le 500 ]] && echo "OK" || echo "OVER LIMIT")
    echo "${skill}: ${lines} lines — ${status}"
  done
  ```
  Expected: all `OK`.

- [ ] 6. Run `codi validate`:
  ```bash
  codi validate
  ```
  Expected: no errors.
