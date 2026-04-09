# BBVA Brand Standard Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish `brand_tokens.py` as the standard interface for all brand skills, populate it with correct BBVA colors/fonts extracted from `examples/`, and wire generation skills to consume it explicitly rather than reading prose.

**Architecture:** Each brand skill owns a `scripts/brand_tokens.py` as a single source of truth. Generation skills (`pptx`, `deck-engine`, `doc-engine`) explicitly reference it by path. The `bbva-brand` skill gains full `scripts/` parity with the `rl3-brand` gold standard. The `brand-identity` template is updated so all future brand skills include the standard interface.

**Tech Stack:** Python 3.10+ (python-pptx), TypeScript (template.ts source templates), Node.js (codi generate)

---

## File Structure After Completion

```
src/templates/skills/bbva-brand/
  scripts/
    __init__.py                    ← NEW
    brand_tokens.py                ← NEW (BBVA colors from examples/)
    generate_pptx.py               ← NEW (BBVA-branded PPTX generator)
    validators/
      __init__.py                  ← NEW
      pptx_validator.py            ← NEW (brand rule checker)
  template.ts                      ← UPDATE (fix colors, add routing table)
  index.ts                         ← unchanged

src/templates/skills/brand-identity/
  template.ts                      ← UPDATE (add brand_tokens.py standard)

.claude/skills/codi-bbva-brand/scripts/   ← NEW (mirror of src scripts)
  __init__.py
  brand_tokens.py
  generate_pptx.py
  validators/
    __init__.py
    pptx_validator.py

.claude/skills/codi-bbva-brand/SKILL.md   ← UPDATED via codi generate
.claude/skills/codi-brand-identity/SKILL.md  ← UPDATE (brand_tokens.py standard)
.claude/skills/codi-deck-engine/SKILL.md     ← UPDATE (explicit brand loading)
.claude/skills/codi-doc-engine/SKILL.md      ← UPDATE (explicit brand loading)
.claude/skills/codi-pptx/SKILL.md            ← UPDATE (brand routing)
```

---

### Task 1: Create BBVA brand_tokens.py — source of truth for all BBVA generators

**Files**:
- `src/templates/skills/bbva-brand/scripts/__init__.py`
- `src/templates/skills/bbva-brand/scripts/brand_tokens.py`
- `.claude/skills/codi-bbva-brand/scripts/__init__.py`
- `.claude/skills/codi-bbva-brand/scripts/brand_tokens.py`

**Est**: 3 minutes

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/__init__.py` (empty, marks directory as Python package):
  ```python
  ```

- [ ] 2. Create `src/templates/skills/bbva-brand/scripts/brand_tokens.py`:
  ```python
  """
  brand_tokens.py — Single source of truth for every BBVA visual constant.

  Colors extracted from examples/Plantilla BBVA_16_9.pptx XML.
  Fonts extracted from examples/Plantilla BBVA_16_9.pptx slide masters.

  Every generator, validator, and template imports from here.
  Nothing is hard-coded elsewhere.
  """

  # ── Colors (from examples/Plantilla BBVA_16_9.pptx) ─────────────────

  COLORS: dict[str, str] = {
      "electric_blue":  "#001391",   # primary — headers, CTAs, section bars
      "midnight":       "#070E46",   # dark variant — dark sections, sidebar bg
      "layout_blue":    "#003194",   # layout elements — dividers, mid-tone fills
      "ice":            "#8BE1E9",   # secondary accent — data viz, highlights
      "canary":         "#FFE761",   # callout highlight — badges, key data points
      "sand":           "#F7F8F8",   # default light background
      "night":          "#000519",   # darkest background — title slides (alt)
      "white":          "#FFFFFF",   # inverse text, icon fills on dark bg
      "text_dark":      "#1A1A2A",   # primary body text on light backgrounds
      "text_medium":    "#4A4A68",   # secondary text, captions, metadata
      "text_light":     "#8A8AB0",   # tertiary text, disabled states
      "border":         "#D0D0E0",   # dividers, card outlines
  }

  # ── CSS Variables (for web/HTML deliverables) ─────────────────────────

  CSS_VARIABLES: str = """\
  :root {
    --bbva-electric-blue: #001391;
    --bbva-midnight: #070E46;
    --bbva-layout-blue: #003194;
    --bbva-ice: #8BE1E9;
    --bbva-canary: #FFE761;
    --bbva-sand: #F7F8F8;
    --bbva-night: #000519;
    --bbva-white: #FFFFFF;
    --bbva-text-dark: #1A1A2A;
    --bbva-text-medium: #4A4A68;
    --bbva-text-light: #8A8AB0;
    --bbva-border: #D0D0E0;
    --bbva-heading-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
    --bbva-body-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
    --bbva-serif-font: 'Tiempos Text', Georgia, serif;
  }"""

  # ── Fonts ─────────────────────────────────────────────────────────────
  # PPTX and print contexts: Source Serif 4 (headlines) + Lato (body)
  # Web contexts: BentonSans BBVA (primary) — loaded from assets/fonts/
  # NOTE: BentonSans is web-only; never embed in python-pptx generation.

  FONTS: dict[str, str] = {
      "pptx_headlines": "Source Serif 4",
      "pptx_body":      "Lato",
      "web_headlines":  "BentonSans BBVA",
      "web_body":       "BentonSans BBVA",
      "web_serif":      "Tiempos Text",
      "fallback_sans":  "Arial",
      "fallback_serif": "Georgia",
  }

  # ── Logo paths (relative to this script's directory) ─────────────────

  LOGO_LIGHT_BG: str = "../assets/BBVA_RGB.svg"
  LOGO_DARK_BG: str = "../assets/BBVA_RGB_white.svg"

  # ── PPTX / DOCX template paths ────────────────────────────────────────

  PPTX_TEMPLATE: str = "../../../examples/Plantilla BBVA_16_9.pptx"
  DOCX_TEMPLATE: str = "../../../examples/GDoc A4 Report - Generic BBVA - with micro cover.docx"

  # ── Layout ───────────────────────────────────────────────────────────

  LAYOUT: dict[str, str] = {
      "max_width":         "1200px",
      "slide_width_in":    "13.333",
      "slide_height_in":   "7.5",
      "content_margin_in": "0.5",
      "accent_bar_width":  "0.08",
  }

  # ── Typography ────────────────────────────────────────────────────────

  TYPOGRAPHY: dict[str, str] = {
      "headline_weight":  "700",
      "headline_size_pt": "28",
      "body_weight":      "400",
      "body_size_pt":     "11",
      "caption_size_pt":  "9",
      "body_line_height": "1.5",
  }

  # ── Brand voice ───────────────────────────────────────────────────────

  PHRASES_USE: list[str] = [
      "Creando oportunidades",
      "Tu dinero, tus decisiones",
      "Banca responsable",
      "Transformacion digital al servicio de las personas",
  ]

  PHRASES_AVOID: list[str] = [
      "Somos lideres en",
      "Disruptivo",
      "Cutting-edge",
      "Nuestro equipo de expertos",
      "Soluciones 360",
  ]
  ```

- [ ] 3. Mirror both files to the installed skill directory (replace the empty placeholder):
  ```bash
  mkdir -p .claude/skills/codi-bbva-brand/scripts/validators
  cp src/templates/skills/bbva-brand/scripts/__init__.py \
     .claude/skills/codi-bbva-brand/scripts/__init__.py
  cp src/templates/skills/bbva-brand/scripts/brand_tokens.py \
     .claude/skills/codi-bbva-brand/scripts/brand_tokens.py
  ```

- [ ] 4. Verify the module is importable:
  ```bash
  cd .claude/skills/codi-bbva-brand/scripts && python -c "
  import brand_tokens as bt
  assert bt.COLORS['electric_blue'] == '#001391', 'wrong electric_blue'
  assert bt.COLORS['ice'] == '#8BE1E9', 'wrong ice'
  assert bt.FONTS['pptx_headlines'] == 'Source Serif 4', 'wrong pptx headline font'
  assert bt.FONTS['pptx_body'] == 'Lato', 'wrong pptx body font'
  print('brand_tokens OK — all assertions passed')
  "
  ```
  Expected: `brand_tokens OK — all assertions passed`

- [ ] 5. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/__init__.py \
          src/templates/skills/bbva-brand/scripts/brand_tokens.py \
          .claude/skills/codi-bbva-brand/scripts/__init__.py \
          .claude/skills/codi-bbva-brand/scripts/brand_tokens.py
  git commit -m "feat(bbva-brand): add brand_tokens.py with correct colors from PPTX template"
  ```

**Verification**: `python -c "import brand_tokens as bt; print(bt.COLORS['electric_blue'])"` from the scripts dir — expected: `#001391`

---

### Task 2: Create BBVA generate_pptx.py — BBVA-branded PPTX generator

**Files**:
- `src/templates/skills/bbva-brand/scripts/generate_pptx.py`
- `.claude/skills/codi-bbva-brand/scripts/generate_pptx.py`

**Est**: 5 minutes

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/generate_pptx.py`:
  ```python
  """
  generate_pptx.py — Generate a BBVA-branded PowerPoint presentation.

  CLI: python generate_pptx.py --content content.json --output output.pptx

  Content schema:
    {
      "title": str,
      "subtitle": str (optional),
      "author": str (optional),
      "sections": [
        {
          "number": "01",
          "label": "Introduction",
          "heading": "What this is about",
          "body": "Paragraph text...",
          "items": ["bullet one", "bullet two"],   (optional)
          "callout": "Key takeaway text"            (optional)
        }
      ]
    }
  """

  import sys
  import os
  import argparse
  import json

  sys.path.insert(0, os.path.dirname(__file__))

  from pptx import Presentation
  from pptx.util import Inches, Pt, Emu
  from pptx.dml.color import RGBColor
  from pptx.enum.text import PP_ALIGN

  import brand_tokens as bt

  # ── Brand constants ────────────────────────────────────────────────

  def _hex(key: str) -> RGBColor:
      h = bt.COLORS[key].lstrip("#")
      return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

  ELECTRIC_BLUE = _hex("electric_blue")
  MIDNIGHT      = _hex("midnight")
  ICE           = _hex("ice")
  CANARY        = _hex("canary")
  SAND          = _hex("sand")
  WHITE         = _hex("white")
  TEXT_DARK     = _hex("text_dark")
  TEXT_MEDIUM   = _hex("text_medium")

  FONT_HEADLINE = bt.FONTS["pptx_headlines"]   # Source Serif 4
  FONT_BODY     = bt.FONTS["pptx_body"]        # Lato

  SLIDE_W = Inches(float(bt.LAYOUT["slide_width_in"]))
  SLIDE_H = Inches(float(bt.LAYOUT["slide_height_in"]))

  MARGIN = Inches(float(bt.LAYOUT["content_margin_in"]))
  CONTENT_W = SLIDE_W - MARGIN * 2
  ACCENT_W  = Inches(float(bt.LAYOUT["accent_bar_width"]))


  # ── Helpers ────────────────────────────────────────────────────────

  def _blank_slide(prs: Presentation):
      return prs.slides.add_slide(prs.slide_layouts[6])  # blank layout

  def _set_bg(slide, color: RGBColor) -> None:
      fill = slide.background.fill
      fill.solid()
      fill.fore_color.rgb = color

  def _textbox(slide, x, y, w, h):
      return slide.shapes.add_textbox(x, y, w, h)

  def _run(para, text: str, font_name: str, size_pt: float,
           color: RGBColor, bold: bool = False) -> None:
      run = para.add_run()
      run.text = text
      run.font.name = font_name
      run.font.size = Pt(size_pt)
      run.font.color.rgb = color
      run.font.bold = bold

  def _accent_bar(slide, y_in: float, h_in: float) -> None:
      """Vertical electric-blue accent bar on the left edge."""
      slide.shapes.add_shape(
          1,  # MSO_SHAPE_TYPE.RECTANGLE
          Inches(0), Inches(y_in),
          ACCENT_W, Inches(h_in),
      ).fill.fore_color.rgb = ELECTRIC_BLUE


  # ── Validation ─────────────────────────────────────────────────────

  def _validate(content: dict) -> None:
      if "title" not in content:
          raise ValueError("Missing required field: 'title'")
      if "sections" not in content or not content["sections"]:
          raise ValueError("'sections' must be a non-empty list")
      for i, s in enumerate(content["sections"]):
          for field in ("number", "label", "heading", "body"):
              if field not in s:
                  raise ValueError(f"Section {i}: missing field '{field}'")


  # ── Slide builders ─────────────────────────────────────────────────

  def _build_title(prs: Presentation, content: dict) -> None:
      slide = _blank_slide(prs)
      _set_bg(slide, MIDNIGHT)

      # Left color block (electric blue stripe)
      slide.shapes.add_shape(
          1, Inches(0), Inches(0), Inches(0.5), SLIDE_H,
      ).fill.fore_color.rgb = ELECTRIC_BLUE

      # Title
      tb = _textbox(slide, Inches(0.8), Inches(1.8), Inches(10.0), Inches(2.0))
      tf = tb.text_frame
      tf.word_wrap = True
      _run(tf.paragraphs[0], content["title"],
           FONT_HEADLINE, 36, WHITE, bold=True)

      # Subtitle
      if content.get("subtitle"):
          tb2 = _textbox(slide, Inches(0.8), Inches(3.9), Inches(10.0), Inches(0.8))
          _run(tb2.text_frame.paragraphs[0], content["subtitle"],
               FONT_BODY, 18, ICE)

      # Author / date
      meta = content.get("author", "")
      if meta:
          tb3 = _textbox(slide, Inches(0.8), Inches(5.0), Inches(10.0), Inches(0.5))
          _run(tb3.text_frame.paragraphs[0], meta, FONT_BODY, 12, TEXT_MEDIUM)


  def _build_divider(prs: Presentation, section: dict) -> None:
      slide = _blank_slide(prs)
      _set_bg(slide, ELECTRIC_BLUE)

      # Large section number in Canary
      tb = _textbox(slide, Inches(1.0), Inches(1.5), Inches(4.0), Inches(2.5))
      _run(tb.text_frame.paragraphs[0], section["number"],
           FONT_HEADLINE, 96, CANARY, bold=True)

      # Section label (small caps style)
      tb2 = _textbox(slide, Inches(1.0), Inches(3.8), Inches(11.0), Inches(0.5))
      _run(tb2.text_frame.paragraphs[0], section["label"].upper(),
           FONT_BODY, 13, ICE)

      # Section heading
      tb3 = _textbox(slide, Inches(1.0), Inches(4.4), Inches(11.0), Inches(1.5))
      tf = tb3.text_frame
      tf.word_wrap = True
      _run(tf.paragraphs[0], section["heading"],
           FONT_HEADLINE, 28, WHITE, bold=True)


  def _build_content(prs: Presentation, section: dict) -> None:
      slide = _blank_slide(prs)
      _set_bg(slide, SAND)

      # Accent bar
      _accent_bar(slide, y_in=0, h_in=7.5)

      # Section label (small)
      tb_label = _textbox(slide, Inches(0.3), Inches(0.2), Inches(9.0), Inches(0.35))
      _run(tb_label.text_frame.paragraphs[0],
           f"{section['number']} — {section['label']}",
           FONT_BODY, 9, ELECTRIC_BLUE)

      # Heading
      tb_h = _textbox(slide, Inches(0.3), Inches(0.65), Inches(12.5), Inches(0.9))
      tf_h = tb_h.text_frame
      tf_h.word_wrap = True
      _run(tf_h.paragraphs[0], section["heading"],
           FONT_HEADLINE, 22, MIDNIGHT, bold=True)

      # Horizontal rule (thin blue rect)
      rule = slide.shapes.add_shape(
          1, Inches(0.3), Inches(1.55), Inches(12.5), Inches(0.03),
      )
      rule.fill.fore_color.rgb = ELECTRIC_BLUE
      rule.line.fill.background()

      # Body text
      tb_b = _textbox(slide, Inches(0.3), Inches(1.7), Inches(12.5), Inches(1.2))
      tf_b = tb_b.text_frame
      tf_b.word_wrap = True
      _run(tf_b.paragraphs[0], section["body"], FONT_BODY, 13, TEXT_DARK)

      # Bullet items
      items = section.get("items", [])
      if items:
          tb_i = _textbox(slide, Inches(0.3), Inches(3.1), Inches(12.5), Inches(2.2))
          tf_i = tb_i.text_frame
          tf_i.word_wrap = True
          for idx, item in enumerate(items):
              para = tf_i.paragraphs[0] if idx == 0 else tf_i.add_paragraph()
              para.space_after = Pt(4)
              _run(para, f"\u2192  {item}", FONT_BODY, 12, TEXT_DARK)

      # Callout box
      if section.get("callout"):
          box = slide.shapes.add_shape(
              1, Inches(0.3), Inches(5.5), Inches(12.5), Inches(0.8),
          )
          box.fill.fore_color.rgb = ICE
          box.line.fill.background()
          tb_c = _textbox(slide, Inches(0.5), Inches(5.6), Inches(12.1), Inches(0.6))
          _run(tb_c.text_frame.paragraphs[0], section["callout"],
               FONT_BODY, 13, MIDNIGHT, bold=True)


  def _build_closing(prs: Presentation) -> None:
      slide = _blank_slide(prs)
      _set_bg(slide, MIDNIGHT)

      tb = _textbox(slide, Inches(2.0), Inches(2.5), Inches(9.0), Inches(1.5))
      tf = tb.text_frame
      tf.word_wrap = True
      p = tf.paragraphs[0]
      p.alignment = PP_ALIGN.CENTER
      _run(p, "BBVA", FONT_HEADLINE, 48, WHITE, bold=True)

      tb2 = _textbox(slide, Inches(2.0), Inches(4.0), Inches(9.0), Inches(0.8))
      tf2 = tb2.text_frame
      p2 = tf2.paragraphs[0]
      p2.alignment = PP_ALIGN.CENTER
      _run(p2, "Creating opportunities", FONT_BODY, 18, ICE)


  # ── Public API ─────────────────────────────────────────────────────

  def generate_pptx(content: dict, output_path: str) -> None:
      """
      Generate a BBVA-branded PPTX from structured content.

      Args:
          content: dict with keys title, sections (list), optional subtitle/author
          output_path: destination file path for the .pptx
      """
      _validate(content)

      prs = Presentation()
      prs.slide_width = SLIDE_W
      prs.slide_height = SLIDE_H

      _build_title(prs, content)
      for section in content["sections"]:
          _build_divider(prs, section)
          _build_content(prs, section)
      _build_closing(prs)

      prs.save(output_path)


  # ── CLI ────────────────────────────────────────────────────────────

  def main() -> None:
      parser = argparse.ArgumentParser(
          description="Generate a BBVA-branded PPTX from a JSON content file."
      )
      parser.add_argument("--content", required=True, help="Path to JSON content file")
      parser.add_argument("--output", required=True, help="Output .pptx file path")
      args = parser.parse_args()

      if not os.path.isfile(args.content):
          print(f"Error: content file not found: {args.content}", file=sys.stderr)
          sys.exit(1)

      with open(args.content, encoding="utf-8") as f:
          content = json.load(f)

      generate_pptx(content, args.output)
      print(f"Generated: {args.output}")


  if __name__ == "__main__":
      main()
  ```

- [ ] 2. Mirror to installed skill directory:
  ```bash
  cp src/templates/skills/bbva-brand/scripts/generate_pptx.py \
     .claude/skills/codi-bbva-brand/scripts/generate_pptx.py
  ```

- [ ] 3. Create a minimal test content file and verify generation:
  ```bash
  cat > /tmp/bbva_test_content.json << 'EOF'
  {
    "title": "BBVA Brand Test",
    "subtitle": "Verifying brand_tokens.py integration",
    "author": "Codi Brand Test",
    "sections": [
      {
        "number": "01",
        "label": "Overview",
        "heading": "What this tests",
        "body": "This verifies that generate_pptx.py reads brand_tokens.py and produces a BBVA-branded PPTX.",
        "items": ["Electric Blue headers", "Source Serif 4 fonts", "Sand backgrounds"],
        "callout": "Colors sourced from examples/Plantilla BBVA_16_9.pptx"
      }
    ]
  }
  EOF
  cd .claude/skills/codi-bbva-brand/scripts && \
  python generate_pptx.py --content /tmp/bbva_test_content.json --output /tmp/bbva_test.pptx
  ```
  Expected: `Generated: /tmp/bbva_test.pptx`

- [ ] 4. Verify PPTX has expected slide count:
  ```bash
  python -c "
  from pptx import Presentation
  prs = Presentation('/tmp/bbva_test.pptx')
  assert len(prs.slides) == 4, f'Expected 4 slides (title+divider+content+closing), got {len(prs.slides)}'
  print(f'PPTX generated: {len(prs.slides)} slides — OK')
  "
  ```
  Expected: `PPTX generated: 4 slides — OK`

- [ ] 5. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/generate_pptx.py \
          .claude/skills/codi-bbva-brand/scripts/generate_pptx.py
  git commit -m "feat(bbva-brand): add generate_pptx.py using brand_tokens.py colors and fonts"
  ```

**Verification**: Run `python generate_pptx.py --content /tmp/bbva_test_content.json --output /tmp/test.pptx` from `.claude/skills/codi-bbva-brand/scripts/` — expected: file created, 4 slides.

---

### Task 3: Create BBVA pptx_validator.py — brand rule checker

**Files**:
- `src/templates/skills/bbva-brand/scripts/validators/__init__.py`
- `src/templates/skills/bbva-brand/scripts/validators/pptx_validator.py`
- `.claude/skills/codi-bbva-brand/scripts/validators/__init__.py`
- `.claude/skills/codi-bbva-brand/scripts/validators/pptx_validator.py`

**Est**: 4 minutes

**Steps**:

- [ ] 1. Create `src/templates/skills/bbva-brand/scripts/validators/__init__.py` (empty):
  ```python
  ```

- [ ] 2. Create `src/templates/skills/bbva-brand/scripts/validators/pptx_validator.py`:
  ```python
  """
  pptx_validator.py — Validate a PPTX against BBVA brand guidelines.

  Rules:
    1. has_slides          — Presentation has at least 1 slide
    2. no_forbidden_phrases — No phrase from brand_tokens.PHRASES_AVOID present
    3. has_bbva_colors     — At least one slide contains a known BBVA color fill
    4. source_serif_present — At least one text run uses Source Serif 4

  CLI: python pptx_validator.py --input file.pptx
  """

  import sys
  import os
  import argparse
  import json

  sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

  from pptx import Presentation
  from pptx.util import Pt
  from pptx.dml.color import RGBColor

  import brand_tokens as bt


  # ── Expected constants ─────────────────────────────────────────────

  def _hex(key: str) -> RGBColor:
      h = bt.COLORS[key].lstrip("#")
      return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

  ELECTRIC_BLUE = _hex("electric_blue")
  MIDNIGHT      = _hex("midnight")
  ICE           = _hex("ice")

  KNOWN_BBVA_COLORS: set[RGBColor] = {ELECTRIC_BLUE, MIDNIGHT, ICE}
  HEADLINE_FONT = bt.FONTS["pptx_headlines"]  # Source Serif 4


  # ── Rule checkers ──────────────────────────────────────────────────

  def _check_has_slides(prs: Presentation) -> list[dict]:
      if len(prs.slides) == 0:
          return [{"rule": "has_slides", "message": "Presentation has no slides."}]
      return []


  def _check_no_forbidden_phrases(prs: Presentation) -> list[dict]:
      errors: list[dict] = []
      forbidden_lower = [p.lower() for p in bt.PHRASES_AVOID]
      for idx, slide in enumerate(prs.slides, start=1):
          for shape in slide.shapes:
              if not shape.has_text_frame:
                  continue
              text = shape.text_frame.text.lower()
              for i, phrase in enumerate(forbidden_lower):
                  if phrase in text:
                      errors.append({
                          "rule": "no_forbidden_phrases",
                          "message": (
                              f"Slide {idx}: forbidden phrase "
                              f"'{bt.PHRASES_AVOID[i]}' found."
                          ),
                      })
      return errors


  def _check_has_bbva_colors(prs: Presentation) -> list[dict]:
      """At least one slide background or shape fill must use a known BBVA color."""
      for slide in prs.slides:
          bg = slide.background.fill
          try:
              if bg.fore_color.rgb in KNOWN_BBVA_COLORS:
                  return []
          except Exception:
              pass
          for shape in slide.shapes:
              try:
                  if shape.fill.fore_color.rgb in KNOWN_BBVA_COLORS:
                      return []
              except Exception:
                  pass
      return [{
          "rule": "has_bbva_colors",
          "message": (
              f"No BBVA brand color found in any slide background or shape fill. "
              f"Expected one of: {[bt.COLORS[k] for k in ('electric_blue','midnight','ice')]}"
          ),
      }]


  def _check_source_serif_present(prs: Presentation) -> list[dict]:
      """At least one text run must use the headline font (Source Serif 4)."""
      for slide in prs.slides:
          for shape in slide.shapes:
              if not shape.has_text_frame:
                  continue
              for para in shape.text_frame.paragraphs:
                  for run in para.runs:
                      if run.font.name == HEADLINE_FONT:
                          return []
      return [{
          "rule": "source_serif_present",
          "message": (
              f"No text run uses '{HEADLINE_FONT}'. "
              "BBVA PPTX headlines must use Source Serif 4."
          ),
      }]


  # ── Public API ─────────────────────────────────────────────────────

  def validate_pptx(filepath: str) -> dict:
      """
      Validate a .pptx file against BBVA brand rules.

      Returns:
          {"passed": bool, "errors": [...], "warnings": []}
      """
      prs = Presentation(filepath)
      errors: list[dict] = []
      errors.extend(_check_has_slides(prs))
      errors.extend(_check_no_forbidden_phrases(prs))
      errors.extend(_check_has_bbva_colors(prs))
      errors.extend(_check_source_serif_present(prs))
      return {"passed": len(errors) == 0, "errors": errors, "warnings": []}


  # ── CLI ────────────────────────────────────────────────────────────

  def main() -> None:
      parser = argparse.ArgumentParser(
          description="Validate a PPTX file against BBVA brand guidelines."
      )
      parser.add_argument("--input", required=True, help="Path to .pptx file")
      args = parser.parse_args()

      if not os.path.isfile(args.input):
          print(f"Error: file not found: {args.input}", file=sys.stderr)
          sys.exit(1)

      result = validate_pptx(args.input)
      print(json.dumps(result, indent=2))
      sys.exit(0 if result["passed"] else 1)


  if __name__ == "__main__":
      main()
  ```

- [ ] 3. Mirror to installed skill directory:
  ```bash
  cp src/templates/skills/bbva-brand/scripts/validators/__init__.py \
     .claude/skills/codi-bbva-brand/scripts/validators/__init__.py
  cp src/templates/skills/bbva-brand/scripts/validators/pptx_validator.py \
     .claude/skills/codi-bbva-brand/scripts/validators/pptx_validator.py
  ```

- [ ] 4. Run validator against the PPTX from Task 2 — must pass:
  ```bash
  cd .claude/skills/codi-bbva-brand/scripts/validators && \
  python pptx_validator.py --input /tmp/bbva_test.pptx
  ```
  Expected output (all rules pass):
  ```json
  {
    "passed": true,
    "errors": [],
    "warnings": []
  }
  ```

- [ ] 5. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/scripts/validators/__init__.py \
          src/templates/skills/bbva-brand/scripts/validators/pptx_validator.py \
          .claude/skills/codi-bbva-brand/scripts/validators/__init__.py \
          .claude/skills/codi-bbva-brand/scripts/validators/pptx_validator.py
  git commit -m "feat(bbva-brand): add pptx_validator.py checking BBVA colors and headline font"
  ```

**Verification**: `python pptx_validator.py --input /tmp/bbva_test.pptx` → `"passed": true`

---

### Task 4: Update bbva-brand template.ts — correct colors and routing table

**Files**:
- `src/templates/skills/bbva-brand/template.ts`

**Est**: 4 minutes

**Steps**:

- [ ] 1. Replace the color palette table, CSS variables block, and typography section in `src/templates/skills/bbva-brand/template.ts`. Also add the routing table and scripts section. Replace the entire `template` export with the following (change from line 3 onward):

  In `src/templates/skills/bbva-brand/template.ts`, replace everything from the opening backtick of `template` through the closing backtick with:

  ```typescript
  export const template = `---
  name: {{name}}
  description: Apply BBVA brand identity to any content creation task. Use when creating branded materials for BBVA — presentations, documents, reports, dashboards, or any visual/written deliverable that needs BBVA branding.
  category: ${SKILL_CATEGORY.BRAND_IDENTITY}
  compatibility: ${SUPPORTED_PLATFORMS_YAML}
  managed_by: ${PROJECT_NAME}
  user-invocable: true
  disable-model-invocation: false
  version: 8
  ---

  ## When to Activate

  - User mentions 'BBVA', 'marca BBVA', or asks for BBVA-branded output
  - User needs a client-facing or internal deliverable (presentation, report, dashboard) for BBVA
  - User is creating any document or visual that should carry the BBVA corporate identity

  # BBVA — Brand Identity System

  BBVA is a global financial group with a purpose: to bring the age of opportunity to everyone.

  ## Brand Essence

  **Purpose**: To bring the age of opportunity to everyone.

  **Core values**:
  1. **El cliente es lo primero** (Customer comes first)
  2. **Pensamos en grande** (We think big)
  3. **Somos un solo equipo** (We are one team)

  ---

  ## Process by Artifact Type

  ### Routing Table

  | Request type | Who generates | Process |
  |---|---|---|
  | HTML / dashboard / web | Claude inline | Read \\\`\${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.py]]\\\` → apply CSS_VARIABLES and FONTS["web_headlines"] → generate HTML |
  | Word / proposal / report | Script | Write \\\`content.json\\\` → run \\\`\${CLAUDE_SKILL_DIR}[[/scripts/generate_docx.py]]\\\` → open result |
  | PowerPoint / deck / pitch | Script | Write \\\`content.json\\\` → run \\\`\${CLAUDE_SKILL_DIR}[[/scripts/generate_pptx.py]]\\\` → validate with \\\`validators/pptx_validator.py\\\` |

  **Always read brand_tokens.py first:**
  \\\`\\\`\\\`python
  import sys, os
  sys.path.insert(0, "\${CLAUDE_SKILL_DIR}[[/scripts]]")
  import brand_tokens as bt
  # bt.COLORS["electric_blue"] == "#001391"
  # bt.FONTS["pptx_headlines"] == "Source Serif 4"
  \\\`\\\`\\\`

  ---

  ## Visual Identity

  ### Color Palette (source: examples/Plantilla BBVA_16_9.pptx)

  | Token | Hex | Usage |
  |-------|-----|-------|
  | \`--bbva-electric-blue\` | \`#001391\` | Primary — headers, CTAs, accent bars |
  | \`--bbva-midnight\` | \`#070E46\` | Dark backgrounds, title slides |
  | \`--bbva-layout-blue\` | \`#003194\` | Layout elements, mid-tone fills |
  | \`--bbva-ice\` | \`#8BE1E9\` | Secondary accent — data viz, callouts |
  | \`--bbva-canary\` | \`#FFE761\` | Highlight — section numbers, badges |
  | \`--bbva-sand\` | \`#F7F8F8\` | Default light background |
  | \`--bbva-night\` | \`#000519\` | Darkest background variant |
  | \`--bbva-white\` | \`#FFFFFF\` | Inverse text and fills |
  | \`--bbva-text-dark\` | \`#1A1A2A\` | Primary body text |
  | \`--bbva-text-medium\` | \`#4A4A68\` | Secondary text, captions |

  **Usage rules**:
  - Electric Blue (#001391) is the primary brand color for all materials
  - Sand (#F7F8F8) is the default background for light-mode materials
  - Midnight (#070E46) for dark sections and title slides
  - Ice (#8BE1E9) for secondary highlights — never as primary background fill
  - Canary (#FFE761) for callout badges and section number accents only

  ### CSS Variables

  \\\`\\\`\\\`css
  :root {
    --bbva-electric-blue: #001391;
    --bbva-midnight: #070E46;
    --bbva-layout-blue: #003194;
    --bbva-ice: #8BE1E9;
    --bbva-canary: #FFE761;
    --bbva-sand: #F7F8F8;
    --bbva-night: #000519;
    --bbva-white: #FFFFFF;
    --bbva-text-dark: #1A1A2A;
    --bbva-text-medium: #4A4A68;
    --bbva-heading-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
    --bbva-body-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
    --bbva-serif-font: 'Tiempos Text', Georgia, serif;
  }
  \\\`\\\`\\\`

  ### Typography

  | Context | Role | Font | Fallback |
  |---------|------|------|----------|
  | **PPTX / Print** | Headlines | Source Serif 4 | Georgia |
  | **PPTX / Print** | Body | Lato | Arial |
  | **Web** | Headlines | BentonSans BBVA | Helvetica Neue, Arial |
  | **Web** | Body | BentonSans BBVA | Helvetica Neue, Arial |
  | **Web** | Long-form | Tiempos Text | Georgia |

  > BentonSans BBVA and Tiempos Text are **web-only** fonts (WOFF2). Use Source Serif 4 and Lato for all python-pptx generation.

  **Available WOFF2 font files** (in \`\${CLAUDE_SKILL_DIR}[[/assets/fonts/]]\`):
  - \`BentonSansBBVA-Light.woff2\` (300)
  - \`BentonSansBBVA-Book.woff2\` (400)
  - \`BentonSansBBVA-Medium.woff2\` (500)
  - \`BentonSansBBVA-Bold.woff2\` (700)
  - \`TiemposTextWeb-Regular.woff2\` (400)
  - \`tiempos-headline-bold.woff2\` (700)

  ### Logo

  **Primary logo**: The official BBVA wordmark.

  - \`\${CLAUDE_SKILL_DIR}[[/assets/BBVA_RGB.svg]]\` — Vector logo, blue on white (preferred for web)
  - \`\${CLAUDE_SKILL_DIR}[[/assets/BBVA_RGB.png]]\` — Raster version

  **Logo rules**: Never recreate, stretch, rotate, or add effects. Minimum clear space = height of "B" on all sides.

  ### Icon Library

  35 SVG icons in \`\${CLAUDE_SKILL_DIR}[[/assets/icons/]]\`:
  - Finance: account, bank, card, cart, cash, dollar, euro, transfer, wallet
  - Navigation: arrows, menu, search, filter, home, settings, download, upload
  - Communication: chat, email, send, share
  - Status: check, close, info, warning, lock, delete
  - User: my-profile, mobile, calendar, document, edit, favorite

  Full 600+ icon catalog: \`\${CLAUDE_SKILL_DIR}[[/references/icon-catalog.md]]\`

  ---

  ## Tone of Voice

  **Language**: Spanish for Spain/LATAM. English for global communications.

  **Personality**: Clear and simple, warm and human, forward-looking, inclusive.

  **Phrases to USE**:
  - "Creando oportunidades"
  - "Tu dinero, tus decisiones"
  - "Banca responsable"

  **Phrases to AVOID**:
  - "Somos lideres en..." (corporate cliche)
  - Excessive financial jargon without explanation

  ---

  ## Scripts Reference

  All scripts in \`\${CLAUDE_SKILL_DIR}[[/scripts/]]\`:

  | Script | Purpose | CLI |
  |--------|---------|-----|
  | \`brand_tokens.py\` | Source of truth — all colors, fonts, paths | import only |
  | \`generate_pptx.py\` | Generate BBVA-branded PPTX from content.json | \`python generate_pptx.py --content c.json --output out.pptx\` |
  | \`validators/pptx_validator.py\` | Check PPTX against brand rules | \`python pptx_validator.py --input file.pptx\` |

  ## Reference Files

  - \`\${CLAUDE_SKILL_DIR}[[/references/icon-catalog.md]]\` — Complete icon library listing
  - \`\${CLAUDE_SKILL_DIR}[[/references/values-imagery.md]]\` — Corporate values image catalog
  - \`\${CLAUDE_SKILL_DIR}[[/references/bbva-deck-reference.html]]\` — BBVA HTML presentation example

  ## Bundled Assets

  - \`\${CLAUDE_SKILL_DIR}[[/assets/BBVA_RGB.svg]]\` — Official logo (vector)
  - \`\${CLAUDE_SKILL_DIR}[[/assets/BBVA_RGB.png]]\` — Official logo (raster)
  - \`\${CLAUDE_SKILL_DIR}[[/assets/fonts/]]\` — BentonSans BBVA (4 weights) + Tiempos (4 variants)
  - \`\${CLAUDE_SKILL_DIR}[[/assets/icons/]]\` — Curated 35 SVG icons
  `;
  ```

- [ ] 2. Run `codi generate` to propagate the updated SKILL.md to both `.codi/` and `.claude/`:
  ```bash
  codi generate
  ```
  Expected: no errors, completion message.

- [ ] 3. Verify the generated SKILL.md contains the new colors and routing table:
  ```bash
  grep -c "#001391" .claude/skills/codi-bbva-brand/SKILL.md
  grep -c "generate_pptx.py" .claude/skills/codi-bbva-brand/SKILL.md
  grep -c "Source Serif 4" .claude/skills/codi-bbva-brand/SKILL.md
  ```
  Expected: each returns at least `1`.

  Also verify the old wrong color is gone:
  ```bash
  grep "#004481" .claude/skills/codi-bbva-brand/SKILL.md && echo "FAIL: old color found" || echo "OK: old color absent"
  ```
  Expected: `OK: old color absent`

- [ ] 4. Commit:
  ```bash
  git add src/templates/skills/bbva-brand/template.ts \
          .codi/skills/codi-bbva-brand/SKILL.md \
          .claude/skills/codi-bbva-brand/SKILL.md
  git commit -m "feat(bbva-brand): fix brand colors (#001391 from template), add routing table and scripts reference"
  ```

**Verification**: `.claude/skills/codi-bbva-brand/SKILL.md` contains `#001391`, `generate_pptx.py`, and `Source Serif 4`.

---

### Task 5: Update brand-identity template.ts — add brand_tokens.py standard requirement

**Files**:
- `src/templates/skills/brand-identity/template.ts`

**Est**: 3 minutes

**Steps**:

- [ ] 1. In `src/templates/skills/brand-identity/template.ts`, add the Scripts section and brand_tokens.py standard interface after the "Phrases to Avoid" section (before the closing backtick):

  Find the line:
  ```typescript
      ### Phrases to Avoid

      - Add phrases that don't match the brand voice\`;
  ```

  Replace with:
  ```typescript
      ### Phrases to Avoid

      - Add phrases that don't match the brand voice

  ## brand_tokens.py — Required Standard Interface

  Every brand skill MUST provide a \`scripts/brand_tokens.py\` with these module-level constants.
  Generation skills (pptx, deck-engine, doc-engine) import it by path to consume tokens programmatically.

  Required constants:

  \\\`\\\`\\\`python
  COLORS: dict[str, str]        # hex values keyed by semantic name
  CSS_VARIABLES: str             # :root { --brand-*: ...; } block for web/HTML
  FONTS: dict[str, str]          # at minimum: pptx_headlines, pptx_body, web_headlines, web_body
  LOGO_LIGHT_BG: str             # path to logo SVG/PNG on light backgrounds (relative to scripts/)
  LOGO_DARK_BG: str              # path to logo SVG/PNG on dark backgrounds
  PPTX_TEMPLATE: str             # path to .pptx template file or empty string if none
  DOCX_TEMPLATE: str             # path to .docx template file or empty string if none
  LAYOUT: dict[str, str]         # layout constants: slide_width_in, slide_height_in, etc.
  PHRASES_USE: list[str]         # approved brand phrases
  PHRASES_AVOID: list[str]       # forbidden phrases checked by validators
  \\\`\\\`\\\`

  Place \`brand_tokens.py\` in \`scripts/\` alongside \`generate_pptx.py\`, \`generate_docx.py\`, and \`validators/pptx_validator.py\`.
  See \`codi-rl3-brand\` and \`codi-bbva-brand\` for reference implementations.\`;
  ```

- [ ] 2. Run `codi generate`:
  ```bash
  codi generate
  ```

- [ ] 3. Verify the brand-identity SKILL.md now includes the standard interface:
  ```bash
  grep -c "brand_tokens.py" .claude/skills/codi-brand-identity/SKILL.md
  grep -c "PHRASES_AVOID" .claude/skills/codi-brand-identity/SKILL.md
  ```
  Expected: each returns at least `1`.

- [ ] 4. Commit:
  ```bash
  git add src/templates/skills/brand-identity/template.ts \
          .codi/skills/codi-brand-identity/SKILL.md \
          .claude/skills/codi-brand-identity/SKILL.md
  git commit -m "feat(brand-identity): require brand_tokens.py standard interface in all brand skills"
  ```

**Verification**: `.claude/skills/codi-brand-identity/SKILL.md` contains `brand_tokens.py` and the required constants list.

---

### Task 6: Update deck-engine and doc-engine SKILL.md — explicit brand_tokens.py loading

**Files**:
- `.claude/skills/codi-deck-engine/SKILL.md`
- `.claude/skills/codi-doc-engine/SKILL.md`

**Est**: 3 minutes

**Steps**:

- [ ] 1. In `.claude/skills/codi-deck-engine/SKILL.md`, find the vague brand loading instruction in Step 1:

  Find:
  ```
  **[CODING AGENT]** Check if any skill with **category: brand** is defined in the project. If a brand skill exists, use its design tokens (CSS variables, fonts, logos, tone of voice). If the user specifies a brand name, use that one. If no brand skill exists, use neutral defaults.
  ```

  Replace with:
  ```
  **[CODING AGENT]** Load brand tokens using this priority order:

  1. **If a brand skill with `brand_tokens.py` exists**: import it by path:
     ```python
     import sys, os
     # Find the brand skill scripts dir — e.g., .claude/skills/codi-bbva-brand/scripts/
     skill_scripts = os.path.expanduser("~/.claude/skills/codi-{brand}-brand/scripts")
     sys.path.insert(0, skill_scripts)
     import brand_tokens as bt
     # Use bt.CSS_VARIABLES for :root block
     # Use bt.FONTS["web_headlines"] and bt.FONTS["web_body"] for typography
     # Use bt.COLORS["primary"] (or brand-specific key) for accent color
     ```
  2. **If the user specifies a brand skill name**: resolve that skill's `scripts/brand_tokens.py` path.
  3. **No brand skill**: apply neutral defaults (--brand-primary: #2563EB, --brand-bg: #ffffff, font: system-ui).

  Read `CLAUDE_SKILL_DIR[[/scripts/brand_tokens.py]]` from the brand skill — never hard-code color values here.
  ```

- [ ] 2. In `.claude/skills/codi-doc-engine/SKILL.md`, find the equivalent vague brand loading instruction and apply the same replacement. Search for the phrase that contains "category: brand" and replace with the same block as above.

- [ ] 3. Verify both files contain the explicit loading instruction:
  ```bash
  grep -c "brand_tokens.py" .claude/skills/codi-deck-engine/SKILL.md
  grep -c "brand_tokens.py" .claude/skills/codi-doc-engine/SKILL.md
  ```
  Expected: each returns at least `1`.

- [ ] 4. Commit:
  ```bash
  git add .claude/skills/codi-deck-engine/SKILL.md \
          .claude/skills/codi-doc-engine/SKILL.md
  git commit -m "feat(deck-engine,doc-engine): explicit brand_tokens.py loading replacing vague brand check"
  ```

**Verification**: Both SKILL.md files contain `brand_tokens.py` in the brand loading step.

---

### Task 7: Update pptx SKILL.md — brand routing for generate_pptx.py

**Files**:
- `.claude/skills/codi-pptx/SKILL.md`

**Est**: 2 minutes

**Steps**:

- [ ] 1. Read the current QA section in `.claude/skills/codi-pptx/SKILL.md` to find where to insert the brand routing note. Add a new **Brand Integration** section before the QA section:

  Find the `## QA (Required)` header and insert before it:
  ```markdown
  ## Brand Integration

  When the user requests a branded PPTX (mentions a brand name or a brand skill is active):

  1. Check if the brand skill provides `scripts/generate_pptx.py`:
     ```bash
     ls ~/.claude/skills/codi-{brand}-brand/scripts/generate_pptx.py
     ```
  2. **If it exists** — use the brand generator instead of pptxgenjs:
     ```bash
     # Write structured content to a JSON file first
     python ~/.claude/skills/codi-{brand}-brand/scripts/generate_pptx.py \
       --content content.json --output output.pptx
     # Then validate
     python ~/.claude/skills/codi-{brand}-brand/scripts/validators/pptx_validator.py \
       --input output.pptx
     ```
  3. **If no generate_pptx.py exists** — use pptxgenjs and read `brand_tokens.py` for colors/fonts:
     ```python
     import sys
     sys.path.insert(0, "~/.claude/skills/codi-{brand}-brand/scripts")
     import brand_tokens as bt
     # Apply bt.COLORS and bt.FONTS in the pptxgenjs theme configuration
     ```
  4. **No brand skill** — use pptxgenjs with the topic-appropriate color palette from the Design Ideas section.

  ```

- [ ] 2. Verify the Brand Integration section is present:
  ```bash
  grep -c "generate_pptx.py" .claude/skills/codi-pptx/SKILL.md
  grep -c "pptx_validator.py" .claude/skills/codi-pptx/SKILL.md
  ```
  Expected: each returns at least `1`.

- [ ] 3. Commit:
  ```bash
  git add .claude/skills/codi-pptx/SKILL.md
  git commit -m "feat(pptx): add brand routing — use brand generate_pptx.py when available"
  ```

**Verification**: `.claude/skills/codi-pptx/SKILL.md` contains `generate_pptx.py` routing logic.

---

### Task 8: Integration test — end-to-end brand pipeline

**Files**: none (verification only)

**Est**: 3 minutes

**Steps**:

- [ ] 1. Run `codi status` to confirm no drift:
  ```bash
  codi status
  ```
  Expected: no drift alerts.

- [ ] 2. Verify all four scripts are in place in the installed skill:
  ```bash
  ls -la .claude/skills/codi-bbva-brand/scripts/
  ls -la .claude/skills/codi-bbva-brand/scripts/validators/
  ```
  Expected files: `__init__.py`, `brand_tokens.py`, `generate_pptx.py`, `validators/__init__.py`, `validators/pptx_validator.py`

- [ ] 3. Run the full brand pipeline from scratch:
  ```bash
  cat > /tmp/bbva_integration.json << 'EOF'
  {
    "title": "Integration Test",
    "subtitle": "Full brand pipeline verification",
    "author": "Codi Brand Standard",
    "sections": [
      {
        "number": "01",
        "label": "Test",
        "heading": "Brand pipeline works end-to-end",
        "body": "This section verifies the complete pipeline from brand_tokens.py through generate_pptx.py to pptx_validator.py.",
        "items": ["brand_tokens.py loaded", "Colors from examples/", "Fonts: Source Serif 4 + Lato"],
        "callout": "Electric Blue: #001391 — extracted from Plantilla BBVA_16_9.pptx"
      }
    ]
  }
  EOF

  SCRIPTS=".claude/skills/codi-bbva-brand/scripts"
  python "$SCRIPTS/generate_pptx.py" \
    --content /tmp/bbva_integration.json \
    --output /tmp/bbva_integration.pptx && \
  python "$SCRIPTS/validators/pptx_validator.py" \
    --input /tmp/bbva_integration.pptx
  ```
  Expected:
  ```
  Generated: /tmp/bbva_integration.pptx
  {
    "passed": true,
    "errors": [],
    "warnings": []
  }
  ```

- [ ] 4. Confirm the bbva-brand SKILL.md has the correct version number (8) and no `#004481`:
  ```bash
  head -15 .claude/skills/codi-bbva-brand/SKILL.md | grep "version"
  grep "#004481" .claude/skills/codi-bbva-brand/SKILL.md && echo "FAIL: stale color" || echo "OK"
  ```
  Expected: `version: 8`, then `OK`.

- [ ] 5. Confirm brand-identity, deck-engine, doc-engine, and pptx SKILL.md all reference brand_tokens.py:
  ```bash
  for skill in codi-brand-identity codi-deck-engine codi-doc-engine codi-pptx; do
    count=$(grep -c "brand_tokens.py" ".claude/skills/$skill/SKILL.md" 2>/dev/null || echo 0)
    echo "$skill: $count references to brand_tokens.py"
  done
  ```
  Expected: each skill shows at least `1` reference.

**Verification**: All checks above pass without errors.
