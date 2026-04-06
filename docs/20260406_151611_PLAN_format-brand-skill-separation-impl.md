# Format / Brand Skill Separation — Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all file generation logic (PPTX, DOCX, XLSX) into format skills; brand skills become pure token+validator packages; both cooperate via `--tokens` and `--theme` flags.

**Architecture:** Format skill generators exist in BOTH TypeScript (`scripts/ts/`) and Python (`scripts/python/`) — identical CLI interface (`--content`, `--tokens`, `--theme`, `--output`). Agents detect runtime and use TypeScript when `npx` is available (Claude Code), Python otherwise (Claude Code + Claude.ai). Brand skills expose only `brand_tokens.json` (v2 schema with `themes.dark` / `themes.light`) and validators. Brand skill generator scripts (TS + Python) are deleted.

**Tech Stack:** TypeScript (pptxgenjs ^4, docx ^9, exceljs ^4, npx tsx, Node 22) + Python (python-pptx, python-docx, openpyxl)

**Naming convention:** Template directories use short names (`codi-brand`, `rl3-brand`, `bbva-brand`). Installed skill names are prefixed with the project name (`codi-codi-brand`, `codi-rl3-brand`, `codi-bbva-brand`). Template paths reference `src/templates/skills/codi-brand/`; installed paths resolve to `.claude/skills/codi-codi-brand/`.

---

## Task 1: Add ExcelJS dependency

**Files**: `package.json`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Install ExcelJS:
   ```bash
   npm install exceljs
   ```
- [ ] 2. Verify install:
   ```bash
   node -e "import('exceljs').then(m => console.log('exceljs ok:', m.default.version ?? 'loaded'))"
   ```
   Expected: `exceljs ok: loaded` (or version string)
- [ ] 3. Commit:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore(deps): add exceljs for branded xlsx generation"
   ```

> **Python packages required (installed per-agent invocation):** `python-pptx`, `python-docx`, `openpyxl`. These are not installed globally — each agent that uses the Python generators must run `pip install python-pptx python-docx openpyxl` in the project environment before invoking them. No pip install step is required here; this is documented for agent awareness.

---

## Task 2: Update brand_tokens.json to v2 schema — codi-brand

**Files**: `src/templates/skills/codi-brand/scripts/brand_tokens.json`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Replace the file content entirely:
   ```json
   {
     "brand": "codi",
     "version": 2,
     "themes": {
       "dark": {
         "background":     "#070a0f",
         "surface":        "#0d1117",
         "text_primary":   "#e6edf3",
         "text_secondary": "#8b949e",
         "primary":        "#56b6c2",
         "accent":         "#56b6c2",
         "logo":           "logo_dark_bg"
       },
       "light": {
         "background":     "#f5f5f5",
         "surface":        "#ffffff",
         "text_primary":   "#0d1117",
         "text_secondary": "#4a5568",
         "primary":        "#56b6c2",
         "accent":         "#56b6c2",
         "logo":           "logo_light_bg"
       }
     },
     "fonts": {
       "headlines":     "Outfit",
       "body":          "Outfit",
       "fallback_sans": "Arial"
     },
     "layout": {
       "slide_width_in":      "13.333",
       "slide_height_in":     "7.5",
       "content_margin_in":   "0.5",
       "accent_bar_width_in": "0.05"
     },
     "assets": {
       "logo_dark_bg":  "../../assets/logo-dark.svg",
       "logo_light_bg": "../../assets/logo-light.svg"
     },
     "voice": {
       "phrases_use":   ["codi init", "codi generate", "works across Claude Code, Cursor, Codex, Windsurf", "AI-native development"],
       "phrases_avoid": ["revolutionary", "seamless", "robust", "AI-powered", "AI-driven"]
     }
   }
   ```
- [ ] 2. Verify JSON is valid:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('src/templates/skills/codi-brand/scripts/brand_tokens.json','utf-8')); console.log('valid')"
   ```
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/codi-brand/scripts/brand_tokens.json
   git commit -m "feat(codi-brand): migrate brand_tokens.json to v2 schema with light/dark themes"
   ```

---

## Task 3: Update brand_tokens.json to v2 schema — rl3-brand

**Files**: `src/templates/skills/rl3-brand/scripts/brand_tokens.json`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Replace the file content entirely:
   ```json
   {
     "brand": "rl3",
     "version": 2,
     "themes": {
       "dark": {
         "background":     "#0a0a0b",
         "surface":        "#1a1a1b",
         "text_primary":   "#ffffff",
         "text_secondary": "#7a7a7a",
         "primary":        "#c8b88a",
         "accent":         "#c8b88a",
         "logo":           "logo_dark_bg"
       },
       "light": {
         "background":     "#f5f5f5",
         "surface":        "#ffffff",
         "text_primary":   "#0a0a0b",
         "text_secondary": "#4a4a4a",
         "primary":        "#c8b88a",
         "accent":         "#c8b88a",
         "logo":           "logo_light_bg"
       }
     },
     "fonts": {
       "headlines":     "Space Grotesk",
       "body":          "Instrument Sans",
       "fallback_sans": "Arial"
     },
     "layout": {
       "slide_width_in":      "13.333",
       "slide_height_in":     "7.5",
       "content_margin_in":   "0.5",
       "accent_bar_width_in": "0.05"
     },
     "assets": {
       "logo_dark_bg":  "../../assets/logo-dark.svg",
       "logo_light_bg": "../../assets/logo-light.svg"
     },
     "voice": {
       "phrases_use":   ["Cada iteración nos acerca al resultado óptimo", "Observar · Actuar · Iterar", "Agentes en producción", "Inteligencia aplicada"],
       "phrases_avoid": ["Soluciones 360", "Disruptivo", "Cutting-edge", "Inteligencia Artificial genérica"]
     }
   }
   ```
- [ ] 2. Verify:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('src/templates/skills/rl3-brand/scripts/brand_tokens.json','utf-8')); console.log('valid')"
   ```
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/rl3-brand/scripts/brand_tokens.json
   git commit -m "feat(rl3-brand): migrate brand_tokens.json to v2 schema with light/dark themes"
   ```

---

## Task 4: Update brand_tokens.json to v2 schema — bbva-brand

**Files**: `src/templates/skills/bbva-brand/scripts/brand_tokens.json`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Replace the file content entirely:
   ```json
   {
     "brand": "bbva",
     "version": 2,
     "themes": {
       "dark": {
         "background":     "#000519",
         "surface":        "#070E46",
         "text_primary":   "#ffffff",
         "text_secondary": "#8A8AB0",
         "primary":        "#001391",
         "accent":         "#FFE761",
         "logo":           "logo_dark_bg"
       },
       "light": {
         "background":     "#F7F8F8",
         "surface":        "#ffffff",
         "text_primary":   "#1A1A2A",
         "text_secondary": "#4A4A68",
         "primary":        "#001391",
         "accent":         "#001391",
         "logo":           "logo_light_bg"
       }
     },
     "fonts": {
       "headlines":     "Source Serif 4",
       "body":          "Lato",
       "fallback_sans": "Arial"
     },
     "layout": {
       "slide_width_in":      "13.333",
       "slide_height_in":     "7.5",
       "content_margin_in":   "0.5",
       "accent_bar_width_in": "0.08"
     },
     "assets": {
       "logo_dark_bg":  "../../assets/BBVA_RGB_white.svg",
       "logo_light_bg": "../../assets/BBVA_RGB.svg"
     },
     "voice": {
       "phrases_use":   ["Creando oportunidades", "Tu dinero, tus decisiones", "Banca responsable", "Transformacion digital al servicio de las personas"],
       "phrases_avoid": ["Somos lideres en", "Disruptivo", "Cutting-edge", "Nuestro equipo de expertos", "Soluciones 360"]
     }
   }
   ```
- [ ] 2. Verify:
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('src/templates/skills/bbva-brand/scripts/brand_tokens.json','utf-8')); console.log('valid')"
   ```
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/bbva-brand/scripts/brand_tokens.json
   git commit -m "feat(bbva-brand): migrate brand_tokens.json to v2 schema with light/dark themes"
   ```

---

## Task 5: Update brand_tokens.ts to v2 shape — all three brands

**Files**: `src/templates/skills/codi-brand/scripts/ts/brand_tokens.ts`, `src/templates/skills/rl3-brand/scripts/ts/brand_tokens.ts`, `src/templates/skills/bbva-brand/scripts/ts/brand_tokens.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. Replace all three files with the same v2 adapter (only the comment differs per brand). Content for `codi-brand/scripts/ts/brand_tokens.ts`:
   ```typescript
   /**
    * brand_tokens.ts — TypeScript adapter for Codi brand tokens (v2).
    * Reads brand_tokens.json and exports typed theme helpers.
    */
   import { readFileSync } from "node:fs";
   import { join, dirname } from "node:path";
   import { fileURLToPath } from "node:url";

   const __dirname = dirname(fileURLToPath(import.meta.url));

   export interface BrandTheme {
     background:     string;
     surface:        string;
     text_primary:   string;
     text_secondary: string;
     primary:        string;
     accent:         string;
     logo:           string;
   }

   export interface BrandTokens {
     brand:   string;
     version: number;
     themes:  { dark: BrandTheme; light: BrandTheme };
     fonts:   { headlines: string; body: string; fallback_sans: string };
     layout:  { slide_width_in: string; slide_height_in: string; content_margin_in: string; accent_bar_width_in: string };
     assets:  { logo_dark_bg: string; logo_light_bg: string };
     voice:   { phrases_use: string[]; phrases_avoid: string[] };
   }

   export const tokens: BrandTokens = JSON.parse(
     readFileSync(join(__dirname, "..", "brand_tokens.json"), "utf-8")
   ) as BrandTokens;

   export function getTheme(name: "dark" | "light" = "dark"): BrandTheme {
     return tokens.themes[name];
   }

   /** Returns hex color without # prefix (pptxgenjs expects bare hex strings). */
   export function hex(color: string): string {
     return color.replace("#", "");
   }
   ```
- [ ] 2. Apply the same content to `rl3-brand/scripts/ts/brand_tokens.ts` (change comment to "RL3 brand tokens") and `bbva-brand/scripts/ts/brand_tokens.ts` (change comment to "BBVA brand tokens").
- [ ] 3. Verify TypeScript compiles:
   ```bash
   npx tsc --noEmit --target ESNext --module NodeNext --moduleResolution NodeNext src/templates/skills/codi-brand/scripts/ts/brand_tokens.ts 2>&1 | head -20
   ```
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/codi-brand/scripts/ts/brand_tokens.ts \
           src/templates/skills/rl3-brand/scripts/ts/brand_tokens.ts \
           src/templates/skills/bbva-brand/scripts/ts/brand_tokens.ts
   git commit -m "feat(brand-skills): update brand_tokens.ts to v2 typed theme shape"
   ```

---

## Task 6: Create bundled Codi default brand_tokens.json in format skills

**Files**: `src/templates/skills/pptx/scripts/brand_tokens.json`, `src/templates/skills/docx/scripts/brand_tokens.json`, `src/templates/skills/xlsx/scripts/brand_tokens.json`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Create `src/templates/skills/pptx/scripts/brand_tokens.json` (same content as codi-brand v2 above — copy exactly from Task 2 output).
- [ ] 2. Copy to docx and xlsx:
   ```bash
   cp src/templates/skills/pptx/scripts/brand_tokens.json src/templates/skills/docx/scripts/brand_tokens.json
   cp src/templates/skills/pptx/scripts/brand_tokens.json src/templates/skills/xlsx/scripts/brand_tokens.json
   ```
- [ ] 3. Verify all three exist and are valid JSON:
   ```bash
   for f in pptx docx xlsx; do
     node -e "JSON.parse(require('fs').readFileSync('src/templates/skills/$f/scripts/brand_tokens.json','utf-8')); console.log('$f: valid')"
   done
   ```
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/pptx/scripts/brand_tokens.json \
           src/templates/skills/docx/scripts/brand_tokens.json \
           src/templates/skills/xlsx/scripts/brand_tokens.json
   git commit -m "feat(format-skills): bundle Codi default brand_tokens.json in pptx, docx, xlsx"
   ```

---

## Task 7: Create generate_pptx.ts (TypeScript) in pptx format skill

**Files**: `src/templates/skills/pptx/scripts/ts/generate_pptx.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/pptx/scripts/ts
   ```
- [ ] 2. Write `src/templates/skills/pptx/scripts/ts/generate_pptx.ts`:
   ```typescript
   #!/usr/bin/env npx tsx
   /**
    * generate_pptx.ts — Brand+theme-aware PPTX generator.
    * Usage: npx tsx generate_pptx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.pptx
    * When --tokens is omitted, uses bundled Codi brand tokens.
    */
   import PptxGenJSDefault from "pptxgenjs";
   const PptxGenJS = ((PptxGenJSDefault as unknown as { default: typeof PptxGenJSDefault }).default ?? PptxGenJSDefault) as typeof PptxGenJSDefault;
   import { readFileSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   import { dirname, join, resolve } from "node:path";

   const __dirname = dirname(fileURLToPath(import.meta.url));

   interface BrandTheme { background: string; surface: string; text_primary: string; text_secondary: string; primary: string; accent: string; logo: string; }
   interface BrandTokens { brand: string; version: number; themes: { dark: BrandTheme; light: BrandTheme }; fonts: { headlines: string; body: string; fallback_sans: string }; layout: { slide_width_in: string; slide_height_in: string; content_margin_in: string; accent_bar_width_in: string }; assets: { logo_dark_bg: string; logo_light_bg: string }; }
   interface Section { number?: string; label?: string; heading: string; body?: string; items?: string[]; callout?: string; }
   interface Content { title: string; subtitle?: string; author?: string; sections: Section[]; }

   function parseArgs(): { content: string; tokens?: string; theme: "dark" | "light"; output: string } {
     const argv = process.argv.slice(2);
     const get = (flag: string) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined; };
     const content = get("--content");
     const output = get("--output");
     if (!content || !output) { console.error("Usage: npx tsx generate_pptx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.pptx"); process.exit(1); }
     const theme = get("--theme") === "light" ? "light" : "dark";
     return { content, tokens: get("--tokens"), theme, output };
   }

   const args = parseArgs();
   const tokensPath = args.tokens ? resolve(process.cwd(), args.tokens) : join(__dirname, "../brand_tokens.json");
   const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
   const T = tokens.themes[args.theme];
   const F = tokens.fonts;
   const L = tokens.layout;
   const W = parseFloat(L.slide_width_in);
   const H = parseFloat(L.slide_height_in);
   const M = parseFloat(L.content_margin_in);
   const BAR = parseFloat(L.accent_bar_width_in);
   const h = (c: string) => c.replace("#", "");
   const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

   const pres = new PptxGenJS();
   pres.layout = "LAYOUT_WIDE";
   pres.title  = content.title;
   pres.author = content.author ?? tokens.brand;

   // Title slide
   function buildTitleSlide(): void {
     const s = pres.addSlide();
     s.background = { color: h(T.background) };
     s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: BAR, h: H, fill: { color: h(T.accent) }, line: { type: "none" } });
     s.addText(tokens.brand.toUpperCase(), { x: M, y: 0.3, w: W - M * 2, h: 0.4, color: h(T.accent), fontFace: F.headlines, fontSize: 11, bold: true, charSpacing: 3 });
     s.addText(content.title, { x: M, y: H * 0.3, w: W - M * 2, h: 2.4, color: h(T.text_primary), fontFace: F.headlines, fontSize: 40, bold: true, wrap: true });
     if (content.subtitle) s.addText(content.subtitle, { x: M, y: H * 0.3 + 2.5, w: W - M * 2, h: 0.8, color: h(T.text_secondary), fontFace: F.body, fontSize: 18, wrap: true });
     if (content.author)   s.addText(content.author,   { x: M, y: H - 0.55, w: W - M * 2, h: 0.35, color: h(T.text_secondary), fontFace: F.body, fontSize: 12 });
   }

   // Section slide
   function buildSectionSlide(sec: Section): void {
     const s = pres.addSlide();
     s.background = { color: h(T.background) };
     s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: BAR, h: H, fill: { color: h(T.accent) }, line: { type: "none" } });
     if (sec.number || sec.label) {
       s.addText([sec.number, sec.label].filter(Boolean).join("  ·  "), { x: M, y: 0.3, w: W - M * 2, h: 0.35, color: h(T.accent), fontFace: F.body, fontSize: 11, bold: true, charSpacing: 2 });
     }
     s.addText(sec.heading, { x: M, y: 0.9, w: W - M * 2, h: 1.4, color: h(T.text_primary), fontFace: F.headlines, fontSize: 32, bold: true, wrap: true });
     let y = 2.5;
     if (sec.body) { s.addText(sec.body, { x: M, y, w: W - M * 2, h: 1.0, color: h(T.text_secondary), fontFace: F.body, fontSize: 16, wrap: true }); y += 1.15; }
     if (sec.items?.length) {
       const bullets = sec.items.map(item => ({ text: item, options: { bullet: { type: "bullet" as const }, color: h(T.text_primary), fontSize: 15 } }));
       s.addText(bullets, { x: M, y, w: W - M * 2, h: sec.items.length * 0.45 + 0.2, fontFace: F.body, wrap: true });
       y += sec.items.length * 0.45 + 0.35;
     }
     if (sec.callout) {
       s.addShape(pres.ShapeType.rect, { x: M, y, w: W - M * 2, h: 0.75, fill: { color: h(T.surface) }, line: { color: h(T.accent), width: 1 } });
       s.addText(sec.callout, { x: M + 0.2, y: y + 0.12, w: W - M * 2 - 0.4, h: 0.5, color: h(T.accent), fontFace: F.body, fontSize: 14, italic: true, wrap: true });
     }
   }

   buildTitleSlide();
   content.sections.forEach(buildSectionSlide);
   await pres.writeFile({ fileName: resolve(process.cwd(), args.output) });
   console.log(`PPTX written: ${args.output} (${content.sections.length} sections)`);
   ```
- [ ] 3. Smoke-test with existing Codi example:
   ```bash
   cd examples/codi-brand && npx tsx ../../src/templates/skills/pptx/scripts/ts/generate_pptx.ts \
     --content content.json --theme dark --output test-deck-dark.pptx 2>&1
   ```
   Expected: `PPTX written: test-deck-dark.pptx (2 sections)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/pptx/scripts/ts/generate_pptx.ts
   git commit -m "feat(codi-pptx): add brand+theme-aware generate_pptx.ts to format skill"
   ```

---

## Task 8: Create generate_pptx.py (Python) in pptx format skill

**Files**: `src/templates/skills/pptx/scripts/python/generate_pptx.py`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/pptx/scripts/python
   ```
- [ ] 2. Write `src/templates/skills/pptx/scripts/python/generate_pptx.py`:
   ```python
   #!/usr/bin/env python3
   """
   generate_pptx.py — Brand+theme-aware PPTX generator.
   Usage: python3 generate_pptx.py --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.pptx
   """
   import argparse
   import json
   import sys
   from pathlib import Path

   try:
       from pptx import Presentation
       from pptx.util import Inches, Pt
       from pptx.dml.color import RGBColor
   except ImportError:
       print("Error: python-pptx not installed. Run: pip install python-pptx", file=sys.stderr)
       sys.exit(1)


   def hex_rgb(hex_color: str) -> RGBColor:
       h = hex_color.lstrip("#")
       return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


   def parse_args():
       p = argparse.ArgumentParser()
       p.add_argument("--content", required=True)
       p.add_argument("--tokens")
       p.add_argument("--theme", default="dark", choices=["dark", "light"])
       p.add_argument("--output", required=True)
       return p.parse_args()


   def add_rect(slide, x, y, w, h, fill_hex):
       shape = slide.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
       shape.fill.solid()
       shape.fill.fore_color.rgb = hex_rgb(fill_hex)
       shape.line.fill.background()
       return shape


   def add_textbox(slide, text, x, y, w, h, color_hex, size, font_name, bold=False, italic=False):
       tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
       tf = tb.text_frame
       tf.word_wrap = True
       p = tf.paragraphs[0]
       run = p.add_run()
       run.text = text
       run.font.size = Pt(size)
       run.font.bold = bold
       run.font.italic = italic
       run.font.color.rgb = hex_rgb(color_hex)
       run.font.name = font_name
       return tb


   def build_title_slide(prs, content, T, F, W, H, M, BAR, brand):
       slide = prs.slides.add_slide(prs.slide_layouts[6])
       slide.background.fill.solid()
       slide.background.fill.fore_color.rgb = hex_rgb(T["background"])
       add_rect(slide, 0, 0, BAR, H, T["accent"])
       add_textbox(slide, brand.upper(), M, 0.3, W - M * 2, 0.4, T["accent"], 11, F["fallback_sans"], bold=True)
       add_textbox(slide, content["title"], M, H * 0.3, W - M * 2, 2.4, T["text_primary"], 40, F["fallback_sans"], bold=True)
       if content.get("subtitle"):
           add_textbox(slide, content["subtitle"], M, H * 0.3 + 2.5, W - M * 2, 0.8, T["text_secondary"], 18, F["fallback_sans"])
       if content.get("author"):
           add_textbox(slide, content["author"], M, H - 0.55, W - M * 2, 0.35, T["text_secondary"], 12, F["fallback_sans"])


   def build_section_slide(prs, sec, T, F, W, H, M, BAR):
       slide = prs.slides.add_slide(prs.slide_layouts[6])
       slide.background.fill.solid()
       slide.background.fill.fore_color.rgb = hex_rgb(T["background"])
       add_rect(slide, 0, 0, BAR, H, T["accent"])
       label_parts = [x for x in [sec.get("number"), sec.get("label")] if x]
       if label_parts:
           add_textbox(slide, "  ·  ".join(label_parts), M, 0.3, W - M * 2, 0.35, T["accent"], 11, F["fallback_sans"], bold=True)
       add_textbox(slide, sec["heading"], M, 0.9, W - M * 2, 1.4, T["text_primary"], 32, F["fallback_sans"], bold=True)
       y = 2.5
       if sec.get("body"):
           add_textbox(slide, sec["body"], M, y, W - M * 2, 1.0, T["text_secondary"], 16, F["fallback_sans"])
           y += 1.15
       for item in sec.get("items", []):
           add_textbox(slide, f"• {item}", M + 0.2, y, W - M * 2 - 0.2, 0.4, T["text_primary"], 15, F["fallback_sans"])
           y += 0.45
       if sec.get("callout"):
           add_rect(slide, M, y, W - M * 2, 0.75, T["surface"])
           add_textbox(slide, sec["callout"], M + 0.2, y + 0.12, W - M * 2 - 0.4, 0.5, T["accent"], 14, F["fallback_sans"], italic=True)


   def main():
       args = parse_args()
       default_tokens = Path(__file__).parent.parent / "brand_tokens.json"
       tokens_path = Path(args.tokens) if args.tokens else default_tokens
       tokens = json.loads(tokens_path.read_text())
       T = tokens["themes"][args.theme]
       F = tokens["fonts"]
       L = tokens["layout"]
       content = json.loads(Path(args.content).read_text())
       W, H, M, BAR = float(L["slide_width_in"]), float(L["slide_height_in"]), float(L["content_margin_in"]), float(L["accent_bar_width_in"])

       prs = Presentation()
       prs.slide_width = Inches(W)
       prs.slide_height = Inches(H)

       build_title_slide(prs, content, T, F, W, H, M, BAR, tokens["brand"])
       for sec in content["sections"]:
           build_section_slide(prs, sec, T, F, W, H, M, BAR)

       prs.save(args.output)
       print(f"PPTX written: {args.output} ({len(content['sections'])} sections)")


   if __name__ == "__main__":
       main()
   ```
- [ ] 3. Smoke-test:
   ```bash
   cd examples/codi-brand && python3 ../../src/templates/skills/pptx/scripts/python/generate_pptx.py \
     --content content.json --theme dark --output test-deck-dark-py.pptx 2>&1
   ```
   Expected: `PPTX written: test-deck-dark-py.pptx (2 sections)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/pptx/scripts/python/generate_pptx.py
   git commit -m "feat(codi-pptx): add Python fallback generate_pptx.py for Claude.ai compatibility"
   ```

---

## Task 9: Create generate_docx.ts (TypeScript) in docx format skill

**Files**: `src/templates/skills/docx/scripts/ts/generate_docx.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/docx/scripts/ts
   ```
- [ ] 2. Write `src/templates/skills/docx/scripts/ts/generate_docx.ts`:
   ```typescript
   #!/usr/bin/env npx tsx
   /**
    * generate_docx.ts — Brand+theme-aware DOCX generator.
    * Usage: npx tsx generate_docx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.docx
    */
   import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ShadingType, PageBreak, convertInchesToTwip } from "docx";
   import { readFileSync, writeFileSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   import { dirname, join, resolve } from "node:path";

   const __dirname = dirname(fileURLToPath(import.meta.url));

   interface BrandTheme { background: string; surface: string; text_primary: string; text_secondary: string; primary: string; accent: string; }
   interface BrandTokens { brand: string; version: number; themes: { dark: BrandTheme; light: BrandTheme }; fonts: { headlines: string; body: string; fallback_sans: string }; }
   interface Section { number?: string; label?: string; heading: string; body?: string; items?: string[]; callout?: string; }
   interface Content { title: string; subtitle?: string; author?: string; sections: Section[]; }

   function parseArgs(): { content: string; tokens?: string; theme: "dark" | "light"; output: string } {
     const argv = process.argv.slice(2);
     const get = (flag: string) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined; };
     const content = get("--content"); const output = get("--output");
     if (!content || !output) { console.error("Usage: npx tsx generate_docx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.docx"); process.exit(1); }
     return { content, tokens: get("--tokens"), theme: get("--theme") === "light" ? "light" : "dark", output };
   }

   const args = parseArgs();
   const tokensPath = args.tokens ? resolve(process.cwd(), args.tokens) : join(__dirname, "../brand_tokens.json");
   const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
   const T = tokens.themes[args.theme];
   const F = tokens.fonts;
   const d = (c: string) => c.replace("#", "").toUpperCase();
   const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

   function coverPage(): Paragraph[] {
     return [
       new Paragraph({
         children: [new TextRun({ text: tokens.brand.toUpperCase(), bold: true, size: 18, color: d(T.accent), font: F.fallback_sans })],
         spacing: { after: 480 },
       }),
       new Paragraph({
         children: [new TextRun({ text: content.title, bold: true, size: 56, color: d(T.primary), font: F.headlines })],
         heading: HeadingLevel.TITLE,
         spacing: { after: 240 },
       }),
       ...(content.subtitle ? [new Paragraph({ children: [new TextRun({ text: content.subtitle, size: 28, color: d(T.text_secondary), font: F.body })], spacing: { after: 240 } })] : []),
       ...(content.author   ? [new Paragraph({ children: [new TextRun({ text: content.author,   size: 22, color: d(T.text_secondary), font: F.body })], spacing: { after: 0 } })] : []),
       new Paragraph({ children: [new PageBreak()] }),
     ];
   }

   function sectionPages(sec: Section): Paragraph[] {
     const paras: Paragraph[] = [];
     if (sec.number || sec.label) {
       paras.push(new Paragraph({ children: [new TextRun({ text: [sec.number, sec.label].filter(Boolean).join("  ·  "), bold: true, size: 18, color: d(T.accent), font: F.body })], spacing: { after: 120 } }));
     }
     paras.push(new Paragraph({ children: [new TextRun({ text: sec.heading, bold: true, size: 40, color: d(T.primary), font: F.headlines })], heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));
     if (sec.body) paras.push(new Paragraph({ children: [new TextRun({ text: sec.body, size: 24, color: d(T.text_secondary), font: F.body })], spacing: { after: 200 } }));
     for (const item of sec.items ?? []) {
       paras.push(new Paragraph({ children: [new TextRun({ text: item, size: 24, color: d(T.text_primary), font: F.body })], bullet: { level: 0 }, spacing: { after: 100 } }));
     }
     if (sec.callout) {
       paras.push(new Paragraph({
         children: [new TextRun({ text: sec.callout, italics: true, size: 24, color: d(T.accent), font: F.body })],
         border: { left: { style: BorderStyle.SINGLE, size: 12, color: d(T.accent) } },
         shading: { type: ShadingType.CLEAR, fill: d(T.surface) },
         indent: { left: convertInchesToTwip(0.3) },
         spacing: { after: 200 },
       }));
     }
     paras.push(new Paragraph({ children: [new PageBreak()] }));
     return paras;
   }

   const doc = new Document({
     styles: { default: { document: { run: { font: F.body, size: 24, color: d(T.text_primary) } } } },
     sections: [{ properties: {}, children: [...coverPage(), ...content.sections.flatMap(sectionPages)] }],
   });

   const buffer = await Packer.toBuffer(doc);
   writeFileSync(resolve(process.cwd(), args.output), buffer);
   console.log(`DOCX written: ${args.output} (${content.sections.length} sections)`);
   ```
- [ ] 3. Smoke-test:
   ```bash
   cd examples/codi-brand && npx tsx ../../src/templates/skills/docx/scripts/ts/generate_docx.ts \
     --content content.json --theme dark --output test-doc-dark.docx 2>&1
   ```
   Expected: `DOCX written: test-doc-dark.docx (2 sections)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/docx/scripts/ts/generate_docx.ts
   git commit -m "feat(codi-docx): add brand+theme-aware generate_docx.ts to format skill"
   ```

---

## Task 10: Create generate_docx.py (Python) in docx format skill

**Files**: `src/templates/skills/docx/scripts/python/generate_docx.py`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/docx/scripts/python
   ```
- [ ] 2. Write `src/templates/skills/docx/scripts/python/generate_docx.py`:
   ```python
   #!/usr/bin/env python3
   """
   generate_docx.py — Brand+theme-aware DOCX generator.
   Usage: python3 generate_docx.py --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.docx
   """
   import argparse
   import json
   import sys
   from pathlib import Path

   try:
       from docx import Document
       from docx.shared import Pt, RGBColor, Inches
   except ImportError:
       print("Error: python-docx not installed. Run: pip install python-docx", file=sys.stderr)
       sys.exit(1)


   def hex_rgb(hex_color: str) -> RGBColor:
       h = hex_color.lstrip("#")
       return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


   def set_para_color(para, color_hex, size_pt, font_name, bold=False, italic=False):
       for run in para.runs:
           run.font.color.rgb = hex_rgb(color_hex)
           run.font.size = Pt(size_pt)
           run.font.name = font_name
           run.font.bold = bold
           run.font.italic = italic


   def parse_args():
       p = argparse.ArgumentParser()
       p.add_argument("--content", required=True)
       p.add_argument("--tokens")
       p.add_argument("--theme", default="dark", choices=["dark", "light"])
       p.add_argument("--output", required=True)
       return p.parse_args()


   def main():
       args = parse_args()
       default_tokens = Path(__file__).parent.parent / "brand_tokens.json"
       tokens_path = Path(args.tokens) if args.tokens else default_tokens
       tokens = json.loads(tokens_path.read_text())
       T = tokens["themes"][args.theme]
       F = tokens["fonts"]
       content = json.loads(Path(args.content).read_text())

       doc = Document()

       title_para = doc.add_heading(content["title"], level=0)
       set_para_color(title_para, T["text_primary"], 28, F["fallback_sans"], bold=True)

       if content.get("subtitle"):
           sub = doc.add_paragraph(content["subtitle"])
           set_para_color(sub, T["text_secondary"], 16, F["fallback_sans"], italic=True)

       if content.get("author"):
           auth = doc.add_paragraph(f"By {content['author']}")
           set_para_color(auth, T["text_secondary"], 11, F["fallback_sans"])

       doc.add_paragraph()

       for sec in content["sections"]:
           h = doc.add_heading(sec["heading"], level=1)
           set_para_color(h, T["primary"], 20, F["fallback_sans"], bold=True)

           if sec.get("body"):
               body_para = doc.add_paragraph(sec["body"])
               set_para_color(body_para, T["text_primary"], 11, F["fallback_sans"])

           for item in sec.get("items", []):
               bullet = doc.add_paragraph(item, style="List Bullet")
               set_para_color(bullet, T["text_primary"], 11, F["fallback_sans"])

           if sec.get("callout"):
               callout_para = doc.add_paragraph(sec["callout"])
               callout_para.paragraph_format.left_indent = Inches(0.3)
               callout_para.paragraph_format.right_indent = Inches(0.3)
               set_para_color(callout_para, T["accent"], 12, F["fallback_sans"], italic=True)

       doc.save(args.output)
       print(f"DOCX written: {args.output} ({len(content['sections'])} sections)")


   if __name__ == "__main__":
       main()
   ```
- [ ] 3. Smoke-test:
   ```bash
   cd examples/codi-brand && python3 ../../src/templates/skills/docx/scripts/python/generate_docx.py \
     --content content.json --theme dark --output test-doc-dark-py.docx 2>&1
   ```
   Expected: `DOCX written: test-doc-dark-py.docx (2 sections)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/docx/scripts/python/generate_docx.py
   git commit -m "feat(codi-docx): add Python fallback generate_docx.py for Claude.ai compatibility"
   ```

---

## Task 11: Create generate_xlsx.ts (TypeScript) in xlsx format skill

**Files**: `src/templates/skills/xlsx/scripts/ts/generate_xlsx.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/xlsx/scripts/ts
   ```
- [ ] 2. Write `src/templates/skills/xlsx/scripts/ts/generate_xlsx.ts`:
   ```typescript
   #!/usr/bin/env npx tsx
   /**
    * generate_xlsx.ts — Brand+theme-aware XLSX generator.
    * Usage: npx tsx generate_xlsx.ts --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.xlsx
    * Each section in content.json becomes a worksheet. section.heading = sheet name, section.items = data rows.
    */
   import ExcelJS from "exceljs";
   import { readFileSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   import { dirname, join, resolve } from "node:path";

   const __dirname = dirname(fileURLToPath(import.meta.url));

   interface BrandTheme { background: string; surface: string; text_primary: string; text_secondary: string; primary: string; accent: string; }
   interface BrandTokens { brand: string; version: number; themes: { dark: BrandTheme; light: BrandTheme }; fonts: { headlines: string; body: string; fallback_sans: string }; }
   interface Section { number?: string; label?: string; heading: string; body?: string; items?: string[]; callout?: string; }
   interface Content { title: string; subtitle?: string; author?: string; sections: Section[]; }

   function parseArgs(): { content: string; tokens?: string; theme: "dark" | "light"; output: string } {
     const argv = process.argv.slice(2);
     const get = (flag: string) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined; };
     const content = get("--content"); const output = get("--output");
     if (!content || !output) { console.error("Usage: npx tsx generate_xlsx.ts --content content.json [--tokens tokens.json] [--theme dark|light] --output out.xlsx"); process.exit(1); }
     return { content, tokens: get("--tokens"), theme: get("--theme") === "light" ? "light" : "dark", output };
   }

   const args = parseArgs();
   const tokensPath = args.tokens ? resolve(process.cwd(), args.tokens) : join(__dirname, "../brand_tokens.json");
   const tokens: BrandTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
   const T = tokens.themes[args.theme];
   const F = tokens.fonts;
   const content: Content = JSON.parse(readFileSync(resolve(process.cwd(), args.content), "utf-8"));

   // Strip # from hex for ExcelJS ARGB (expects AARRGGBB)
   const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();

   const wb = new ExcelJS.Workbook();
   wb.creator  = content.author ?? tokens.brand;
   wb.created  = new Date();
   wb.modified = new Date();

   for (const sec of content.sections) {
     const sheetName = (sec.heading ?? sec.label ?? "Sheet").slice(0, 31); // Excel 31-char limit
     const ws = wb.addWorksheet(sheetName, { properties: { tabColor: { argb: argb(T.accent) } } });

     // Header row — section label + number as columns
     const headerValues = [`#`, `Item`, `Details`];
     const headerRow = ws.addRow(headerValues);
     headerRow.eachCell(cell => {
       cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: argb(T.primary) } };
       cell.font   = { bold: true, color: { argb: argb(T.text_primary) }, name: F.fallback_sans, size: 11 };
       cell.border = { bottom: { style: "thin", color: { argb: argb(T.accent) } } };
       cell.alignment = { vertical: "middle" };
     });
     ws.getRow(1).height = 22;

     // Data rows from items
     const items = sec.items ?? [];
     items.forEach((item, idx) => {
       const row = ws.addRow([idx + 1, item, sec.body ?? ""]);
       const isAlt = idx % 2 === 1;
       row.eachCell(cell => {
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isAlt ? argb(T.surface) : argb(T.background) } };
         cell.font = { color: { argb: argb(T.text_primary) }, name: F.fallback_sans, size: 10 };
       });
     });

     // Callout note in a merged cell below data
     if (sec.callout) {
       const noteRow = ws.addRow([sec.callout]);
       ws.mergeCells(`A${noteRow.number}:C${noteRow.number}`);
       noteRow.getCell(1).font = { italic: true, color: { argb: argb(T.accent) }, name: F.fallback_sans, size: 10 };
     }

     // Column widths
     ws.getColumn(1).width = 6;
     ws.getColumn(2).width = 40;
     ws.getColumn(3).width = 40;
   }

   await wb.xlsx.writeFile(resolve(process.cwd(), args.output));
   console.log(`XLSX written: ${args.output} (${content.sections.length} sheets)`);
   ```
- [ ] 3. Smoke-test:
   ```bash
   cd examples/codi-brand && npx tsx ../../src/templates/skills/xlsx/scripts/ts/generate_xlsx.ts \
     --content content.json --theme dark --output test-sheet-dark.xlsx 2>&1
   ```
   Expected: `XLSX written: test-sheet-dark.xlsx (2 sheets)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/xlsx/scripts/ts/generate_xlsx.ts
   git commit -m "feat(codi-xlsx): add brand+theme-aware generate_xlsx.ts to format skill"
   ```

---

## Task 12: Create generate_xlsx.py (Python) in xlsx format skill

**Files**: `src/templates/skills/xlsx/scripts/python/generate_xlsx.py`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/xlsx/scripts/python
   ```
- [ ] 2. Write `src/templates/skills/xlsx/scripts/python/generate_xlsx.py`:
   ```python
   #!/usr/bin/env python3
   """
   generate_xlsx.py — Brand+theme-aware XLSX generator.
   Usage: python3 generate_xlsx.py --content content.json [--tokens brand_tokens.json] [--theme dark|light] --output out.xlsx
   """
   import argparse
   import json
   import sys
   from pathlib import Path

   try:
       from openpyxl import Workbook
       from openpyxl.styles import PatternFill, Font, Border, Side, Alignment
   except ImportError:
       print("Error: openpyxl not installed. Run: pip install openpyxl", file=sys.stderr)
       sys.exit(1)


   def to_hex8(hex_color: str) -> str:
       """Convert #RRGGBB to FFRRGGBB for openpyxl."""
       return "FF" + hex_color.lstrip("#").upper()


   def parse_args():
       p = argparse.ArgumentParser()
       p.add_argument("--content", required=True)
       p.add_argument("--tokens")
       p.add_argument("--theme", default="dark", choices=["dark", "light"])
       p.add_argument("--output", required=True)
       return p.parse_args()


   def main():
       args = parse_args()
       default_tokens = Path(__file__).parent.parent / "brand_tokens.json"
       tokens_path = Path(args.tokens) if args.tokens else default_tokens
       tokens = json.loads(tokens_path.read_text())
       T = tokens["themes"][args.theme]
       F = tokens["fonts"]
       content = json.loads(Path(args.content).read_text())

       wb = Workbook()
       wb.remove(wb.active)

       for sec in content["sections"]:
           sheet_name = (sec.get("heading") or sec.get("label") or "Sheet")[:31]
           ws = wb.create_sheet(title=sheet_name)
           ws.sheet_properties.tabColor = T["accent"].lstrip("#")

           header_fill = PatternFill("solid", fgColor=to_hex8(T["primary"]))
           header_font = Font(bold=True, color=to_hex8(T["text_primary"]), name=F["fallback_sans"], size=11)
           accent_border = Border(bottom=Side(style="thin", color=T["accent"].lstrip("#")))

           ws.append(["#", "Item", "Details"])
           for cell in ws[ws.max_row]:
               cell.fill = header_fill
               cell.font = header_font
               cell.border = accent_border
               cell.alignment = Alignment(vertical="center")
           ws.row_dimensions[ws.max_row].height = 22

           for idx, item in enumerate(sec.get("items", [])):
               fill_hex = T["surface"] if idx % 2 == 1 else T["background"]
               row_fill = PatternFill("solid", fgColor=to_hex8(fill_hex))
               row_font = Font(color=to_hex8(T["text_primary"]), name=F["fallback_sans"], size=10)
               ws.append([idx + 1, item, sec.get("body", "")])
               for cell in ws[ws.max_row]:
                   cell.fill = row_fill
                   cell.font = row_font

           if sec.get("callout"):
               ws.append([sec["callout"]])
               note_row = ws.max_row
               ws.merge_cells(f"A{note_row}:C{note_row}")
               ws[f"A{note_row}"].font = Font(italic=True, color=to_hex8(T["accent"]), name=F["fallback_sans"], size=10)

           ws.column_dimensions["A"].width = 6
           ws.column_dimensions["B"].width = 40
           ws.column_dimensions["C"].width = 40

       wb.save(args.output)
       print(f"XLSX written: {args.output} ({len(content['sections'])} sheets)")


   if __name__ == "__main__":
       main()
   ```
- [ ] 3. Smoke-test:
   ```bash
   cd examples/codi-brand && python3 ../../src/templates/skills/xlsx/scripts/python/generate_xlsx.py \
     --content content.json --theme dark --output test-sheet-dark-py.xlsx 2>&1
   ```
   Expected: `XLSX written: test-sheet-dark-py.xlsx (2 sheets)`
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/xlsx/scripts/python/generate_xlsx.py
   git commit -m "feat(codi-xlsx): add Python fallback generate_xlsx.py for Claude.ai compatibility"
   ```

---

## Task 13: Delete generator scripts from brand skill templates

**Files**: brand skill `scripts/ts/` and `scripts/python/` directories
**Est**: 3 minutes

**Steps**:
- [ ] 1. Delete TS generators from all three brands:
   ```bash
   rm src/templates/skills/codi-brand/scripts/ts/generate_pptx.ts
   rm src/templates/skills/codi-brand/scripts/ts/generate_docx.ts
   rm src/templates/skills/rl3-brand/scripts/ts/generate_pptx.ts
   rm src/templates/skills/bbva-brand/scripts/ts/generate_pptx.ts
   rm src/templates/skills/bbva-brand/scripts/ts/generate_docx.ts
   ```
- [ ] 2. Delete Python directories entirely:
   ```bash
   rm -rf src/templates/skills/codi-brand/scripts/python/
   rm -rf src/templates/skills/rl3-brand/scripts/python/
   rm -rf src/templates/skills/bbva-brand/scripts/python/
   ```
- [ ] 3. Delete root-level stray Python files in rl3-brand:
   ```bash
   rm -f src/templates/skills/rl3-brand/scripts/generate_pptx.py
   rm -f src/templates/skills/rl3-brand/scripts/generate_docx.py
   rm -f src/templates/skills/rl3-brand/scripts/__init__.py
   rm -f src/templates/skills/rl3-brand/scripts/__pycache__ -rf
   ```
- [ ] 4. Verify remaining structure for each brand:
   ```bash
   for b in codi-brand rl3-brand bbva-brand; do
     echo "=== $b ===" && ls src/templates/skills/$b/scripts/ts/
   done
   ```
   Expected: only `brand_tokens.ts` and `validators/` in each `scripts/ts/`
- [ ] 5. Commit:
   ```bash
   git add -A src/templates/skills/codi-brand/scripts/ \
              src/templates/skills/rl3-brand/scripts/ \
              src/templates/skills/bbva-brand/scripts/
   git commit -m "refactor(brand-skills): remove generator scripts — generation now owned by format skills"
   ```

---

## Task 14: Update brand skill template.ts routing tables

**Files**: `src/templates/skills/codi-brand/template.ts`, `src/templates/skills/rl3-brand/template.ts`, `src/templates/skills/bbva-brand/template.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. In each brand's `template.ts`, replace the `## Generator Routing` section (or equivalent routing table) with the following pattern. Example for `codi-brand/template.ts`:
   - Find the section that shows `npx tsx ${CLAUDE_SKILL_DIR}/scripts/ts/generate_pptx.ts`
   - Replace routing commands with runtime detection logic:
   ```
   | Format | Command |
   |--------|---------|
   | PPTX | Use runtime detection (see below) |
   | DOCX | Use runtime detection (see below) |
   | XLSX | Use runtime detection (see below) |
   ```
   Runtime detection pattern (apply for PPTX, DOCX, and XLSX):
   ```bash
   if command -v npx &>/dev/null && npx tsx --version &>/dev/null 2>&1; then
     npx tsx ${CODI_PPTX_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] --content content.json --tokens ${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme dark --output out.pptx
   else
     python3 ${CODI_PPTX_SKILL_DIR}[[/scripts/python/generate_pptx.py]] --content content.json --tokens ${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.json]] --theme dark --output out.pptx
   fi
   ```
   Apply the same pattern for DOCX (replacing `PPTX_SKILL_DIR` with `DOCX_SKILL_DIR`, `generate_pptx` with `generate_docx`, and `out.pptx` with `out.docx`) and for XLSX (replacing with `XLSX_SKILL_DIR`, `generate_xlsx`, and `out.xlsx`).
   - `${CLAUDE_SKILL_DIR}` resolves to the brand skill directory (provides tokens)
   - `${CODI_PPTX_SKILL_DIR}`, `${CODI_DOCX_SKILL_DIR}`, `${CODI_XLSX_SKILL_DIR}` resolve to the respective format skill directories
   - Replace `--theme dark` with `--theme ${BRAND_THEME}` to pass the user-selected theme at runtime
- [ ] 2. Remove any remaining references to `scripts/python/` in brand template routing.
- [ ] 3. Bump versions in all three brand template.ts files (e.g. +1 from current).
- [ ] 4. Verify no `generate_pptx\|generate_docx\|python` references remain in brand templates:
   ```bash
   grep -n "generate_pptx\|generate_docx\|python" \
     src/templates/skills/codi-brand/template.ts \
     src/templates/skills/rl3-brand/template.ts \
     src/templates/skills/bbva-brand/template.ts
   ```
   Expected: no matches (or only the new routing table references via CODI_*_SKILL_DIR)
- [ ] 5. Commit:
   ```bash
   git add src/templates/skills/codi-brand/template.ts \
           src/templates/skills/rl3-brand/template.ts \
           src/templates/skills/bbva-brand/template.ts
   git commit -m "feat(brand-skills): update routing to use format skill generators with --tokens and --theme"
   ```

---

## Task 15: Update format skill template.ts files with brand+theme prompt

**Files**: `src/templates/skills/pptx/template.ts`, `src/templates/skills/docx/template.ts`, `src/templates/skills/xlsx/template.ts`
**Est**: 4 minutes

**Steps**:
- [ ] 1. In each format skill `template.ts`, add a `## Creating Branded Output` section after the existing Quick Reference or equivalent, with this content (shown for `pptx/template.ts`, adapt wording for docx/xlsx):
   ```
   ## Creating Branded Output

   When the user asks to create a branded PPTX, ask two questions if not already stated:

   **Step 1 — Brand** (skip if brand already named):
   \`\`\`
   Which brand styling would you like to apply?
     1. Codi (default — uses bundled tokens)
     2. BBVA  — requires codi-bbva-brand skill active
     3. RL3   — requires codi-rl3-brand skill active
     4. Custom — provide a path to brand_tokens.json
   \`\`\`

   **Step 2 — Theme** (skip if theme already named):
   \`\`\`
   Which color theme?
     1. Dark (default)
     2. Light
   \`\`\`

   Then run:
   \`\`\`bash
   npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/ts/generate_pptx.ts]] \\
     --content content.json \\
     --tokens /path/to/brand_tokens.json \\
     --theme dark \\
     --output output.pptx
   \`\`\`

   Omit \`--tokens\` to use Codi default brand. Replace \`dark\` with \`light\` for the light theme.
   ```
- [ ] 2. Bump versions in all three format `template.ts` files.
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/pptx/template.ts \
           src/templates/skills/docx/template.ts \
           src/templates/skills/xlsx/template.ts
   git commit -m "feat(format-skills): add brand+theme prompt step to pptx, docx, xlsx SKILL.md"
   ```

---

## Task 16: Build, reinstall, and propagate

**Files**: `dist/` (generated)
**Est**: 5 minutes

**Steps**:
- [ ] 1. Build:
   ```bash
   npm run build 2>&1 | grep -E "success|error|fail" -i
   ```
   Expected: `ESM ⚡️ Build success` and `DTS ⚡️ Build success`
- [ ] 2. Reinstall all 6 affected skills:
   ```bash
   codi add skill codi-pptx --template codi-pptx && \
   codi add skill codi-docx --template codi-docx && \
   codi add skill codi-xlsx --template codi-xlsx && \
   codi add skill codi-bbva-brand --template codi-bbva-brand && \
   codi add skill codi-rl3-brand --template codi-rl3-brand && \
   codi add skill codi-codi-brand --template codi-codi-brand
   ```
   Expected: `ok` for each
- [ ] 3. Propagate:
   ```bash
   codi generate --force 2>&1 | tail -5
   ```
- [ ] 4. Commit:
   ```bash
   git add -A && git commit -m "chore: rebuild and propagate after format/brand skill separation"
   ```

---

## Task 17: Validate — run all 18 output combinations

**Files**: `examples/` (generated outputs)
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create example content for brands that don't have it yet (rl3, bbva already exist; verify codi too):
   ```bash
   ls examples/codi-brand/content.json examples/rl3-brand/content.json examples/bbva-brand/content.json
   ```
- [ ] 2. Run all 18 combinations (TypeScript runtime):
   ```bash
   PPTX_GEN=".claude/skills/codi-pptx/scripts/ts/generate_pptx.ts"
   DOCX_GEN=".claude/skills/codi-docx/scripts/ts/generate_docx.ts"
   XLSX_GEN=".claude/skills/codi-xlsx/scripts/ts/generate_xlsx.ts"

   for BRAND in codi bbva rl3; do
     TOKENS=".claude/skills/codi-${BRAND}-brand/scripts/brand_tokens.json"
     CONTENT="examples/${BRAND}-brand/content.json"
     for THEME in dark light; do
       npx tsx $PPTX_GEN --content $CONTENT --tokens $TOKENS --theme $THEME --output examples/${BRAND}-brand/deck-${THEME}.pptx
       npx tsx $DOCX_GEN --content $CONTENT --tokens $TOKENS --theme $THEME --output examples/${BRAND}-brand/doc-${THEME}.docx
       npx tsx $XLSX_GEN --content $CONTENT --tokens $TOKENS --theme $THEME --output examples/${BRAND}-brand/sheet-${THEME}.xlsx
     done
   done
   ```
- [ ] 3. Verify Python runtime for at least one brand (e.g., codi dark):
   ```bash
   PPTX_GEN_PY=".claude/skills/codi-pptx/scripts/python/generate_pptx.py"
   DOCX_GEN_PY=".claude/skills/codi-docx/scripts/python/generate_docx.py"
   XLSX_GEN_PY=".claude/skills/codi-xlsx/scripts/python/generate_xlsx.py"
   TOKENS=".claude/skills/codi-codi-brand/scripts/brand_tokens.json"
   CONTENT="examples/codi-brand/content.json"

   python3 $PPTX_GEN_PY --content $CONTENT --tokens $TOKENS --theme dark --output examples/codi-brand/deck-dark-py.pptx
   python3 $DOCX_GEN_PY --content $CONTENT --tokens $TOKENS --theme dark --output examples/codi-brand/doc-dark-py.docx
   python3 $XLSX_GEN_PY --content $CONTENT --tokens $TOKENS --theme dark --output examples/codi-brand/sheet-dark-py.xlsx
   ```
   Expected: `PPTX written`, `DOCX written`, `XLSX written` for all three Python generators
- [ ] 4. Verify all 18 TS-generated files exist:
   ```bash
   ls examples/codi-brand/ examples/bbva-brand/ examples/rl3-brand/ | grep -E "\.(pptx|docx|xlsx)$" | wc -l
   ```
   Expected: `18` (or more, including the Python smoke-test outputs)
- [ ] 5. Spot-check file sizes (all must be > 0 bytes):
   ```bash
   find examples/ -name "*.pptx" -o -name "*.docx" -o -name "*.xlsx" | xargs ls -lh | awk '{print $5, $9}'
   ```
- [ ] 6. Commit:
   ```bash
   git add examples/
   git commit -m "test(validation): add 18 brand+theme output examples for format/brand skill separation"
   ```
