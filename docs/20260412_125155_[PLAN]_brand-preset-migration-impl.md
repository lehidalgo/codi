# Brand Preset Migration Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone `https://github.com/rl3aiboutique-cpu/codi-presets.git`, convert `codi-bbva-brand` and `codi-rl3-brand` from `/Users/laht/projects/recx/` to the new brand standard, and push the result as a `brands` preset.

**Architecture:** Single preset repo with two skills (`bbva-brand`, `rl3-brand`) each following the new standard: `brand/tokens.json` (single source of truth) + `brand/tokens.css` + updated `SKILL.md`. All existing assets (logos, fonts, icons, references) copied verbatim. RL3 Python scripts dropped; values migrated to JSON.

**Tech Stack:** Bash (cp, mkdir, git), JSON, CSS, Markdown

**Source:** `/Users/laht/projects/recx/.codi/skills/codi-bbva-brand/` and `/Users/laht/projects/recx/.codi/skills/codi-rl3-brand/`
**Target:** `/Users/laht/projects/codi-presets/`

---

- [ ] **Task 1** — Clone repo and check existing content
- [ ] **Task 2** — Write preset.yaml
- [ ] **Task 3** — Create bbva-brand token files
- [ ] **Task 4** — Write bbva-brand/SKILL.md
- [ ] **Task 5** — Copy bbva-brand assets and references
- [ ] **Task 6** — Verify bbva-brand completeness
- [ ] **Task 7** — Create rl3-brand token files
- [ ] **Task 8** — Write rl3-brand/SKILL.md
- [ ] **Task 9** — Copy rl3-brand assets and references
- [ ] **Task 10** — Final verification, commit, push

---

### Task 1: Clone repo and check existing content

**Files**: `/Users/laht/projects/codi-presets/` (new)
**Est**: 2 minutes

**Steps**:
1. Clone the repo:
   ```bash
   cd /Users/laht/projects
   git clone https://github.com/rl3aiboutique-cpu/codi-presets.git
   cd codi-presets
   ```
2. Check what already exists:
   ```bash
   ls -la
   find . -not -path './.git/*' | sort
   ```
3. If `skills/bbva-brand/` or `skills/rl3-brand/` already exist, remove them (they will be rebuilt from scratch):
   ```bash
   rm -rf skills/bbva-brand skills/rl3-brand
   ```
4. If `preset.yaml` already exists, note its content, then it will be overwritten in Task 2.
5. Create the required directory structure:
   ```bash
   mkdir -p skills/bbva-brand/brand
   mkdir -p skills/bbva-brand/assets/fonts
   mkdir -p skills/bbva-brand/assets/icons
   mkdir -p skills/bbva-brand/references
   mkdir -p skills/rl3-brand/brand
   mkdir -p skills/rl3-brand/assets
   mkdir -p skills/rl3-brand/references
   ```

**Verification**: `find skills -type d | sort` — expected output:
```
skills/bbva-brand
skills/bbva-brand/assets
skills/bbva-brand/assets/fonts
skills/bbva-brand/assets/icons
skills/bbva-brand/brand
skills/bbva-brand/references
skills/rl3-brand
skills/rl3-brand/assets
skills/rl3-brand/brand
skills/rl3-brand/references
```

---

### Task 2: Write preset.yaml

**Files**: `/Users/laht/projects/codi-presets/preset.yaml`
**Est**: 2 minutes

**Steps**:
1. Write `preset.yaml`:
   ```yaml
   name: brands
   description: Brand identity skills for BBVA and RL3 AI Agency
   version: 1.0.0
   author: rl3aiboutique-cpu
   category: design
   artifacts:
     skills:
       - bbva-brand
       - rl3-brand
   ```

**Verification**: `cat preset.yaml` — confirm all 8 fields present with correct values.

---

### Task 3: Create bbva-brand token files

**Files**: `skills/bbva-brand/brand/tokens.json`, `skills/bbva-brand/brand/tokens.css`
**Est**: 3 minutes

**Steps**:
1. Write `skills/bbva-brand/brand/tokens.json`:
   ```json
   {
     "brand":        "bbva-brand",
     "display_name": "BBVA",
     "version": 1,
     "themes": {
       "dark": {
         "background":     "#121212",
         "surface":        "#1e1e1e",
         "text_primary":   "#ffffff",
         "text_secondary": "#bdbdbd",
         "primary":        "#004481",
         "accent":         "#2dcccd",
         "logo":           "logo_dark_bg"
       },
       "light": {
         "background":     "#ffffff",
         "surface":        "#f4f4f4",
         "text_primary":   "#333333",
         "text_secondary": "#666666",
         "primary":        "#004481",
         "accent":         "#2dcccd",
         "logo":           "logo_light_bg"
       }
     },
     "colors": {
       "bbva_blue":       "#004481",
       "bbva_navy":       "#072146",
       "bbva_aqua":       "#2dcccd",
       "bbva_coral":      "#f5835a",
       "bbva_dark":       "#121212",
       "bbva_white":      "#ffffff",
       "bbva_light_gray": "#f4f4f4",
       "bbva_mid_gray":   "#bdbdbd",
       "bbva_text":       "#333333",
       "bbva_text_sec":   "#666666"
     },
     "fonts": {
       "headlines":      "BentonSans BBVA",
       "body":           "BentonSans BBVA",
       "monospace":      "Courier New",
       "fallback_serif": "Georgia",
       "fallback_sans":  "Helvetica Neue, Arial"
     },
     "assets": {
       "logo_dark_bg":  "assets/BBVA_RGB.svg",
       "logo_light_bg": "assets/BBVA_RGB.svg",
       "fonts_dir":     "assets/fonts",
       "icons_dir":     "assets/icons"
     },
     "voice": {
       "language":      "es",
       "tone":          "Clear and simple. Warm and human. Forward-looking. Inclusive. Lead with benefits, not features. Active voice.",
       "phrases_use": [
         "Creando oportunidades",
         "Tu dinero, tus decisiones",
         "Banca responsable",
         "Transformación digital al servicio de las personas"
       ],
       "phrases_avoid": [
         "Somos líderes en",
         "Soluciones innovadoras",
         "Regulatory language without plain-language alternatives"
       ]
     }
   }
   ```

2. Write `skills/bbva-brand/brand/tokens.css`:
   ```css
   /* bbva-brand — Brand CSS Variables */
   /* Generated from brand/tokens.json — do not edit manually */

   :root {
     /* Light theme (default for BBVA) */
     --brand-bg:         #ffffff;
     --brand-surface:    #f4f4f4;
     --brand-text:       #333333;
     --brand-text-muted: #666666;
     --brand-primary:    #004481;
     --brand-accent:     #2dcccd;

     --brand-font-headline: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
     --brand-font-body:     'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
     --brand-font-mono:     'Courier New', monospace;

     /* Legacy BBVA-specific variables (for reference HTML files) */
     --bbva-blue:           #004481;
     --bbva-navy:           #072146;
     --bbva-aqua:           #2dcccd;
     --bbva-coral:          #f5835a;
     --bbva-dark:           #121212;
     --bbva-white:          #ffffff;
     --bbva-light-gray:     #f4f4f4;
     --bbva-medium-gray:    #bdbdbd;
     --bbva-text:           #333333;
     --bbva-text-secondary: #666666;
     --bbva-heading-font:   'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
     --bbva-body-font:      'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
     --bbva-serif-font:     'Tiempos Text', Georgia, 'Times New Roman', serif;
   }

   [data-theme="dark"] {
     --brand-bg:         #121212;
     --brand-surface:    #1e1e1e;
     --brand-text:       #ffffff;
     --brand-text-muted: #bdbdbd;
     --brand-primary:    #004481;
     --brand-accent:     #2dcccd;
   }
   ```

**Verification**:
```bash
python3 -c "import json; d=json.load(open('skills/bbva-brand/brand/tokens.json')); print('colors:', len(d['colors']), '| fonts:', len(d['fonts']), '| phrases_use:', len(d['voice']['phrases_use']))"
```
Expected: `colors: 10 | fonts: 5 | phrases_use: 4`

---

### Task 4: Write bbva-brand/SKILL.md

**Files**: `skills/bbva-brand/SKILL.md`
**Est**: 5 minutes

**Steps**:
1. Write `skills/bbva-brand/SKILL.md` with this exact content:

```markdown
---
name: bbva-brand
description: BBVA brand identity skill. Use when creating any branded deliverable — social cards, slides, documents, or any visual output that must carry BBVA brand identity. Provides design tokens (colors, fonts), voice guidelines, and reference templates.
category: Brand Identity
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: user
user-invocable: true
disable-model-invocation: false
version: 1
---

## When to Activate

- User mentions 'BBVA', 'marca BBVA', or asks for BBVA-branded output
- User needs a client-facing or internal deliverable (presentation, report, dashboard) for BBVA
- User is creating any document or visual that should carry the BBVA corporate identity

---

# BBVA — Brand Identity System

## How to Apply This Brand

When creating content that must carry BBVA identity:

1. Read `brand/tokens.json` for colors, fonts, and voice
2. Import `brand/tokens.css` into any HTML output for CSS variable definitions
3. Apply `voice.tone` when writing copy — clear, warm, and human
4. Use phrases from `voice.phrases_use`; avoid `voice.phrases_avoid`
5. Check `references/bbva-deck-reference.html` for a presentation layout example

---

BBVA is a global financial group with a purpose: to bring the age of opportunity to everyone. The brand identity reflects digital transformation, customer-centricity, and trust through a clean, modern visual system.

## Brand Essence

**Purpose**: To bring the age of opportunity to everyone.

**Core values**:
1. **El cliente es lo primero** (Customer comes first) — Every decision starts with the customer
2. **Pensamos en grande** (We think big) — Ambitious goals, bold execution
3. **Somos un solo equipo** (We are one team) — Collaboration across boundaries

---

## Visual Identity

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bbva-blue` | `#004481` | Primary brand color — headers, CTAs, key elements |
| `--bbva-navy` | `#072146` | Dark variant — backgrounds, text on light surfaces |
| `--bbva-aqua` | `#2DCCCD` | Secondary accent — highlights, data visualization, interactive elements |
| `--bbva-coral` | `#F5835A` | Tertiary accent — alerts, warm highlights, badges |
| `--bbva-dark` | `#121212` | Dark mode backgrounds |
| `--bbva-white` | `#FFFFFF` | Light backgrounds, text on dark |
| `--bbva-light-gray` | `#F4F4F4` | Subtle backgrounds, card surfaces |
| `--bbva-medium-gray` | `#BDBDBD` | Borders, dividers, disabled states |
| `--bbva-text` | `#333333` | Primary text on light backgrounds |
| `--bbva-text-secondary` | `#666666` | Secondary text, descriptions |

**Usage rules**:
- BBVA Blue (#004481) is the primary brand color — use for headers, primary buttons, and key UI elements
- BBVA Aqua (#2DCCCD) is the secondary accent — use for data highlights, links, and interactive states. Never use as a primary background fill.
- Maintain high contrast ratios (WCAG AA minimum) for all text/background combinations
- Light mode is the default for corporate materials. Dark mode is available for digital dashboards and presentations.

### Typography

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| **Headlines** | BentonSans BBVA | Bold (700) | 'Helvetica Neue', Arial, sans-serif |
| **Body** | BentonSans BBVA | Book (400) / Medium (500) | 'Helvetica Neue', Arial, sans-serif |
| **Editorial / Long-form** | Tiempos Text | Regular (400) | Georgia, 'Times New Roman', serif |
| **Data / Numbers** | BentonSans BBVA | Medium (500) | 'Helvetica Neue', Arial, sans-serif |

**Available font files** (in `assets/fonts/`):
- `BentonSansBBVA-Light.woff2` (300)
- `BentonSansBBVA-Book.woff2` (400)
- `BentonSansBBVA-Medium.woff2` (500)
- `BentonSansBBVA-Bold.woff2` (700)
- `TiemposTextWeb-Regular.woff2` (400)
- `TiemposTextWeb-RegularItalic.woff2` (400 italic)
- `tiempos-headline-bold.woff2` (700)
- `tiempos-headline-bold-italic.woff2` (700 italic)

**Typography rules**:
- BentonSans BBVA is the primary typeface for all digital and print materials
- Tiempos is reserved for editorial contexts, long-form reading, and premium communications
- Headlines: BentonSans Bold, tight letter-spacing
- Body: BentonSans Book/Medium, comfortable line-height (1.5-1.6)
- When BentonSans is unavailable, fallback to Helvetica Neue or Arial

### Logo

**Primary logo**: The BBVA wordmark in BBVA Blue (#004481) on white backgrounds, or white on dark backgrounds.

**Logo files available** in `assets/`:
- `assets/BBVA_RGB.svg` — Vector logo (preferred for web)
- `assets/BBVA_RGB.png` — Raster logo (for contexts requiring PNG)

**Logo rules**:
- Always use the official BBVA wordmark — never recreate or modify
- Minimum clear space around the logo: height of the "B" character on all sides
- On dark backgrounds, use white version of the logo
- Never stretch, rotate, or add effects to the logo

### Icon Library

A curated subset of 35 commonly-used SVG icons is bundled in `assets/icons/`:
- Finance: account, bank, card, cart, cash, dollar, euro, transfer, wallet
- Navigation: arrows, menu, search, filter, home, settings, download, upload
- Communication: chat, email, send, share
- Status: check, close, info, warning, lock, delete
- User: my-profile, mobile, calendar, document, edit, favorite, configuration, add

The full 600+ icon library is cataloged in `references/icon-catalog.md`. Additional icons can be obtained from the BBVA corporate design portal.

---

## Tone of Voice

**Language**: Spanish by default for Spain/LATAM markets. English for global communications.

**Personality**:
- **Clear and simple** — Complex financial products explained in everyday language
- **Warm and human** — Banking is personal; write as a trusted advisor, not an institution
- **Forward-looking** — Focus on opportunity, growth, and digital innovation
- **Inclusive** — Language that welcomes everyone, avoids jargon

**Writing patterns**:
- Lead with benefits, not features
- Use active voice: "Te ayudamos a..." not "Los servicios son proporcionados..."
- Short paragraphs, clear headings
- Address the customer directly ("tú" in Spain, "usted" in formal/LATAM contexts)

**Phrases to USE**:
- "Creando oportunidades"
- "Tu dinero, tus decisiones"
- "Banca responsable"
- "Transformación digital al servicio de las personas"

**Phrases to AVOID**:
- Excessive financial jargon without explanation
- "Somos líderes en..." (corporate cliché)
- Condescending language about financial literacy
- Complex regulatory language without plain-language alternatives

---

## Document & Presentation Standards

When creating **documents** for BBVA:
- Header: BBVA logo top-left, blue accent line
- Footer: "BBVA" in BentonSans, page number
- Headings: BentonSans Bold, BBVA Navy
- Body: BentonSans Book, adequate line spacing
- Accent color (BBVA Blue) for highlights and section markers

When creating **presentations** for BBVA:
- Reference `references/bbva-deck-reference.html` for an example of BBVA-branded slide structure and styling
- Light backgrounds as default (white or light gray)
- BBVA Blue for titles and key data
- Aqua for secondary highlights and data visualization
- Clean layouts with generous whitespace

When creating **web content** for BBVA:
- Import `brand/tokens.css` for CSS variables
- Light mode default
- Use BentonSans with appropriate fallbacks
- Follow BBVA icon library for UI elements
- Ensure WCAG AA accessibility compliance

---

## Bundled Assets

- `assets/BBVA_RGB.svg` — Official logo, vector format (preferred for web)
- `assets/BBVA_RGB.png` — Official logo, raster format
- `assets/fonts/` — BentonSans BBVA (4 weights) and Tiempos (4 variants), all in WOFF2
- `assets/icons/` — Curated subset of 35 commonly-used SVG icons

## Reference Files

- `references/icon-catalog.md` — Complete listing of all 600+ icons in the BBVA library
- `references/values-imagery.md` — Corporate values image catalog with descriptions
- `references/bbva-deck-reference.html` — BBVA-branded presentation example (with .css and .js)

## External Resources (BBVA Corporate Design Portal)

- Full 600+ SVG icon library
- Corporate values imagery (ES/EN, plain and microillustration variants)
- SPHERICA PowerPoint template (16:9)
- SPHERICA Excel chart/table template
- Adobe Illustrator source files
```

**Verification**:
```bash
# No marker syntax remaining
grep -c '\[\[' skills/bbva-brand/SKILL.md && echo "FAIL: markers found" || echo "PASS: no markers"
# Has correct frontmatter name
grep "^name: bbva-brand" skills/bbva-brand/SKILL.md && echo "PASS" || echo "FAIL: wrong name"
# Has How to Apply section
grep "How to Apply" skills/bbva-brand/SKILL.md && echo "PASS" || echo "FAIL: missing section"
```
All three must output PASS.

---

### Task 5: Copy bbva-brand assets and references

**Files**: all files under `skills/bbva-brand/assets/` and `skills/bbva-brand/references/`
**Est**: 2 minutes

**Steps**:
1. Copy logo files:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/assets/BBVA_RGB.svg skills/bbva-brand/assets/
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/assets/BBVA_RGB.png skills/bbva-brand/assets/
   ```
2. Copy all font files:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/assets/fonts/*.woff2 skills/bbva-brand/assets/fonts/
   ```
3. Copy all icon SVGs:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/assets/icons/*.svg skills/bbva-brand/assets/icons/
   ```
4. Copy all reference files:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/references/bbva-deck-reference.html skills/bbva-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/references/bbva-deck-reference.css  skills/bbva-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/references/bbva-deck-reference.js   skills/bbva-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/references/icon-catalog.md          skills/bbva-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-bbva-brand/references/values-imagery.md        skills/bbva-brand/references/
   ```

**Verification**:
```bash
echo "Fonts:      $(ls skills/bbva-brand/assets/fonts/ | wc -l) (expect 8)"
echo "Icons:      $(ls skills/bbva-brand/assets/icons/ | wc -l) (expect 35)"
echo "Logos:      $(ls skills/bbva-brand/assets/*.{svg,png} 2>/dev/null | wc -l) (expect 2)"
echo "References: $(ls skills/bbva-brand/references/ | wc -l) (expect 5)"
```

---

### Task 6: Verify bbva-brand completeness

**Files**: read-only check
**Est**: 2 minutes

**Steps**:
1. Run full file inventory:
   ```bash
   find skills/bbva-brand -type f | sort
   ```
2. Confirm expected file count:
   ```bash
   echo "Total files: $(find skills/bbva-brand -type f | wc -l) (expect 53)"
   # 1 SKILL.md + 2 brand files + 2 logos + 8 fonts + 35 icons + 5 references = 53
   ```
3. Validate tokens.json parses:
   ```bash
   python3 -m json.tool skills/bbva-brand/brand/tokens.json > /dev/null && echo "PASS: valid JSON" || echo "FAIL: invalid JSON"
   ```
4. Confirm no `${CLAUDE_SKILL_DIR}` or `[[/` markers in SKILL.md:
   ```bash
   grep -E '\$\{CLAUDE_SKILL_DIR\}|\[\[/' skills/bbva-brand/SKILL.md && echo "FAIL: markers found" || echo "PASS: clean"
   ```

---

### Task 7: Create rl3-brand token files

**Files**: `skills/rl3-brand/brand/tokens.json`, `skills/rl3-brand/brand/tokens.css`
**Est**: 3 minutes

**Steps**:
1. Write `skills/rl3-brand/brand/tokens.json` (values migrated from `brand_tokens.py`):
   ```json
   {
     "brand":        "rl3-brand",
     "display_name": "RL3 AI Agency",
     "version": 1,
     "themes": {
       "dark": {
         "background":     "#0a0a0b",
         "surface":        "#1a1a1b",
         "text_primary":   "#ffffff",
         "text_secondary": "#7a7a7a",
         "primary":        "#0a0a0b",
         "accent":         "#c8b88a",
         "logo":           "logo_dark_bg"
       },
       "light": {
         "background":     "#f5f5f5",
         "surface":        "#ffffff",
         "text_primary":   "#0a0a0b",
         "text_secondary": "#7a7a7a",
         "primary":        "#0a0a0b",
         "accent":         "#c8b88a",
         "logo":           "logo_light_bg"
       }
     },
     "colors": {
       "black":      "#0a0a0b",
       "white":      "#ffffff",
       "accent":     "#c8b88a",
       "accent_dim": "#c8b88a33",
       "gray":       "#7a7a7a",
       "dark_gray":  "#1a1a1b",
       "mid_gray":   "#2a2a2b",
       "light_bg":   "#f5f5f5"
     },
     "fonts": {
       "headlines":        "Space Grotesk",
       "body":             "Instrument Sans",
       "monospace":        "Space Mono",
       "fallback_sans":    "sans-serif",
       "google_fonts_url": "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
     },
     "typography": {
       "headline_weight":   "600-700",
       "headline_tracking": "-0.02em",
       "label_tracking":    "0.3em",
       "label_size":        "0.65rem",
       "body_weight":       "400-600",
       "body_line_height":  "1.7"
     },
     "layout": {
       "max_width":         "1200px",
       "grid_size":         "60px",
       "card_padding":      "3rem",
       "section_padding":   "8rem",
       "mobile_breakpoint": "768px"
     },
     "assets": {
       "logo_dark_bg":  "assets/rl3-logo-dark.svg",
       "logo_light_bg": "assets/rl3-logo-light.svg",
       "fonts_dir":     null
     },
     "voice": {
       "language": "es",
       "tagline":  "Cada iteración nos acerca al resultado óptimo.",
       "cycle":    "Observar · Actuar · Iterar",
       "tone":     "Confident but not arrogant. Technical but accessible. Direct and concise. Data-driven. Short punchy sentences. Active voice.",
       "section_label_format": "01 — Section Name",
       "phrases_use": [
         "Cada iteración nos acerca al resultado óptimo",
         "Observar · Actuar · Iterar",
         "No demos. Soluciones en producción",
         "Cada dato es una señal de mejora",
         "Sistemas que mejoran con el tiempo"
       ],
       "phrases_avoid": [
         "Revolucionamos",
         "Disruptivo",
         "Cutting-edge",
         "Nuestro equipo de expertos",
         "Soluciones 360",
         "End-to-end",
         "Inteligencia artificial al servicio de"
       ]
     },
     "service_pillars": [
       { "num": "01", "name": "Estrategia AI",        "en": "Observe", "desc": "Observamos tu entorno, diseñamos la policy óptima" },
       { "num": "02", "name": "Implementación",        "en": "Act",     "desc": "Agentes, automatizaciones y sistemas inteligentes en producción" },
       { "num": "03", "name": "Optimización Continua", "en": "Iterate", "desc": "Cada dato es una señal de recompensa; iterar y escalar" }
     ]
   }
   ```

2. Write `skills/rl3-brand/brand/tokens.css`:
   ```css
   /* rl3-brand — Brand CSS Variables */
   /* Generated from brand/tokens.json — do not edit manually */

   :root {
     /* Dark theme (default for RL3) */
     --brand-bg:         #0a0a0b;
     --brand-surface:    #1a1a1b;
     --brand-text:       #ffffff;
     --brand-text-muted: #7a7a7a;
     --brand-primary:    #0a0a0b;
     --brand-accent:     #c8b88a;

     --brand-font-headline: 'Space Grotesk', sans-serif;
     --brand-font-body:     'Instrument Sans', sans-serif;
     --brand-font-mono:     'Space Mono', monospace;

     /* Legacy RL3-specific variables (for reference HTML files) */
     --rl3-black:      #0a0a0b;
     --rl3-white:      #ffffff;
     --rl3-accent:     #c8b88a;
     --rl3-accent-dim: #c8b88a33;
     --rl3-gray:       #7a7a7a;
     --rl3-dark-gray:  #1a1a1b;
     --rl3-mid-gray:   #2a2a2b;
     --rl3-light-bg:   #f5f5f5;
   }

   [data-theme="light"] {
     --brand-bg:         #f5f5f5;
     --brand-surface:    #ffffff;
     --brand-text:       #0a0a0b;
     --brand-text-muted: #7a7a7a;
   }
   ```

**Verification**:
```bash
python3 -c "import json; d=json.load(open('skills/rl3-brand/brand/tokens.json')); print('colors:', len(d['colors']), '| pillars:', len(d['service_pillars']), '| phrases_use:', len(d['voice']['phrases_use']))"
```
Expected: `colors: 8 | pillars: 3 | phrases_use: 5`

---

### Task 8: Write rl3-brand/SKILL.md

**Files**: `skills/rl3-brand/SKILL.md`
**Est**: 5 minutes

**Steps**:
1. Write `skills/rl3-brand/SKILL.md` with this exact content:

```markdown
---
name: rl3-brand
description: RL3 AI Agency brand identity skill. Use when creating any branded deliverable — HTML pages, slides, documents, or any visual/written output that must carry RL3 brand identity. Provides design tokens (colors, fonts), voice guidelines, and reference templates.
category: Brand Identity
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: user
user-invocable: true
disable-model-invocation: false
version: 1
---

## When to Activate

- User mentions 'RL3', 'nuestra marca', 'RL3 branding', or asks for RL3-branded output
- User needs a client-facing deliverable (proposal, deck, landing page) for RL3
- User is creating any document or visual that should carry the RL3 identity

---

# RL3 AI Agency — Brand System

## How to Apply This Brand

When creating content that must carry RL3 identity:

1. Read `brand/tokens.json` for colors, fonts, voice, and service pillars
2. Import `brand/tokens.css` into any HTML output for CSS variable definitions
3. Apply `voice.tone` when writing copy — confident, direct, data-driven
4. Use phrases from `voice.phrases_use`; avoid `voice.phrases_avoid`
5. Check `references/brandguide.html` for visual implementation reference and component demos

---

## Brand Essence

**RL3** = **R**einforcement **L**earning. The **3** represents the three project phases:

> **Observar · Actuar · Iterar**

Tagline: *"Cada iteración nos acerca al resultado óptimo."*

**Core positioning**: Production AI systems that improve with every iteration. Not demos — systems that generate value from day one.

**Three service pillars**:

| # | Pilar | Phase | Description |
|---|-------|-------|-------------|
| 01 | Estrategia AI | Observe | Observamos tu entorno, diseñamos la policy óptima |
| 02 | Implementación | Act | Agentes, automatizaciones y sistemas inteligentes en producción |
| 03 | Optimización Continua | Iterate | Cada dato es una señal de recompensa; iterar y escalar |

---

## Visual Identity

### Color Palette

| Token | CSS Variable | Hex | Usage |
|-------|-------------|-----|-------|
| black | `--rl3-black` | `#0a0a0b` | Primary dark / backgrounds |
| white | `--rl3-white` | `#ffffff` | Primary light / text on dark |
| accent | `--rl3-accent` | `#c8b88a` | Gold: the "3", highlights, CTAs |
| accent_dim | `--rl3-accent-dim` | `#c8b88a33` | Accent at 20% opacity: glows, subtle backgrounds |
| gray | `--rl3-gray` | `#7a7a7a` | Secondary text, descriptions |
| dark_gray | `--rl3-dark-gray` | `#1a1a1b` | Cards, elevated surfaces on dark backgrounds |
| mid_gray | `--rl3-mid-gray` | `#2a2a2b` | Borders, dividers on dark backgrounds |
| light_bg | `--rl3-light-bg` | `#f5f5f5` | Light mode background alternative |

**Usage rules**:
- Gold accent is for the "3", highlights, interactive elements, and section labels. Never for large background fills.
- Default to dark mode (dark background, light text). Light mode is secondary.
- Dark mode backgrounds use the `black` token, never pure `#000`.
- Maintain high contrast: body text on dark backgrounds uses `white` or `light_bg`.

### Typography

| Role | Font | Weight |
|------|------|--------|
| Headlines / Logo | Space Grotesk | 500-700 |
| Monospace / Labels | Space Mono | 400-700 |
| Body text | Instrument Sans | 400-600 |

Google Fonts URL (from `brand/tokens.json` → `fonts.google_fonts_url`):
```
https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap
```

- Headlines: Space Grotesk, weight 600-700, tight letter-spacing (-0.02em)
- Section labels: Space Mono, all caps, wide letter-spacing (0.3em), small size (0.65rem), gold color
- Section label format: `01 — Section Name`
- Body: Instrument Sans, generous line-height (1.7), gray for secondary text

### Logo Rules

The logo is pure typography: **RL** + **3** on a single shared baseline, with "AI AGENCY" subtitle in Space Mono below.

**Critical rules**:
1. "RL" and "3" MUST sit on the exact same baseline — one word, one line, one level.
2. Use a single `<text>` element with a `<tspan>` for the color change. **Never** two separate elements.
3. The "3" is ALWAYS in gold (`#c8b88a`). Never the same color as "RL".
4. SVG files available in `assets/rl3-logo-dark.svg` (for light backgrounds) and `assets/rl3-logo-light.svg` (for dark backgrounds).

### Design Patterns

- **Hover**: gold top-border reveal (scaleX from 0), background shift to slightly lighter
- **Entrance**: fadeUp animation (opacity + translateY) with staggered delays
- **Pulse**: subtle glow behind the "3" element using radial-gradient + blur
- **Cursor**: `crosshair` on body (signature detail)
- **Grain overlay**: SVG feTurbulence filter at very low opacity (0.02)
- **Grid**: subtle 60px background grid with radial-gradient masks for hero sections
- **Cards**: 1px gap separators; max content width 1200px centered; responsive below 768px

---

## Tone of Voice

**Language**: Spanish by default (primary market: Spain/EU). Switch to English when explicitly requested or for US/UAE markets.

**Personality**: Confident but not arrogant. Technical but accessible. Direct and concise. Data-driven.

**Writing patterns**:
- Short, punchy sentences. Break long ideas into fragments.
- Prefer active voice: "Construimos agentes" not "Los agentes son construidos".
- Em dash (—) ONLY in section labels (`01 — Contexto`). Never use em dashes to connect clauses.
- RL metaphors woven naturally: "cada dato es una señal de mejora", "la policy óptima".

**Approved phrases**:
- "Cada iteración nos acerca al resultado óptimo"
- "Observar · Actuar · Iterar"
- "No demos. Soluciones en producción"
- "Cada dato es una señal de mejora"
- "Sistemas que mejoran con el tiempo"

**Phrases to AVOID**:
- "Revolucionamos" / "Disruptivo" / "Cutting-edge"
- "Nuestro equipo de expertos"
- "Soluciones 360" / "End-to-end" without specifics
- "Inteligencia artificial al servicio de..."

---

## Document & Presentation Standards

**Documents (DOCX/PDF)**:
- Header: RL3 logo top-left, gold accent line below
- Footer: "RL3 AI AGENCY" in Space Mono, page number
- Headings: Space Grotesk, weight 600-700
- Section numbering: 01, 02, 03... format

**Presentations (PPTX)**:
- Dark slides (near-black background) as default
- Title slide: Logo centered, gold "3" on same baseline as "RL", subtitle in Space Mono
- Section dividers: large number in gold + section title in Space Grotesk
- Use the 3-pillar structure (Observe / Act / Iterate) when presenting methodology

**Web content (HTML)**:
- Import `brand/tokens.css` for CSS variables and Google Fonts link from `fonts.google_fonts_url`
- Dark mode default with grain overlay
- Logo renders RL3 on one baseline — use `<tspan>` for the gold "3", never a separate element
- Include fadeUp animations and hover gold borders
- Responsive: single column below 768px

---

## Available Agents

For automated brand quality evaluation (see `agents/` directory):

- **codi-rl3-grader** — Evaluates branded outputs against RL3 brand expectations. Runs a core brand checklist (logo baseline, gold usage, dark mode, fonts, no em dashes, no banned phrases, correct cycle name "Iterar" not "Aprender", section label format) and grades each expectation pass/fail with evidence.
- **codi-rl3-comparator** — Blind A/B comparison of two branded outputs across 6 weighted dimensions: Logo Integrity, Color Fidelity, Typography, Tone & Copy, Layout & Motion, Overall Brand Coherence. Flags critical violations that override scores.
- **codi-rl3-analyzer** — Root-cause analysis of why one output outperformed another. Identifies failures by category (missing/ambiguous/buried instruction, missing example/warning) and generates concrete SKILL.md improvement suggestions with priority levels.

---

## Reference Files

| File | When to read |
|------|-------------|
| `references/services.md` | Writing proposals, service descriptions, pricing tiers, deliverables |
| `references/ecosystem.md` | Regional targeting (Spain, UAE, US), use case matrix, technology platform catalog |
| `references/brandguide.html` | Visual implementation reference: logo, colors, typography, component demos |
| `references/brand-concept.html` | Layout patterns, animations, full service section structure |
| `assets/rl3-logo-dark.svg` | Logo for use on light backgrounds |
| `assets/rl3-logo-light.svg` | Logo for use on dark backgrounds |
```

**Verification**:
```bash
# No marker syntax remaining
grep -c '\[\[' skills/rl3-brand/SKILL.md && echo "FAIL: markers found" || echo "PASS: no markers"
# No Python script references
grep -c 'brand_tokens.py\|generate_docx\|generate_pptx\|html_validator\|run_tests' skills/rl3-brand/SKILL.md && echo "FAIL: Python refs found" || echo "PASS: clean"
# Has How to Apply section
grep "How to Apply" skills/rl3-brand/SKILL.md && echo "PASS" || echo "FAIL: missing section"
# Has correct name
grep "^name: rl3-brand" skills/rl3-brand/SKILL.md && echo "PASS" || echo "FAIL: wrong name"
```
All four must output PASS.

---

### Task 9: Copy rl3-brand assets and references

**Files**: all files under `skills/rl3-brand/assets/` and `skills/rl3-brand/references/`
**Est**: 2 minutes

**Steps**:
1. Copy logo SVG files:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/assets/rl3-logo-dark.svg  skills/rl3-brand/assets/
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/assets/rl3-logo-light.svg skills/rl3-brand/assets/
   ```
2. Copy all reference files:
   ```bash
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/references/brandguide.html    skills/rl3-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/references/brand-concept.html skills/rl3-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/references/services.md        skills/rl3-brand/references/
   cp /Users/laht/projects/recx/.codi/skills/codi-rl3-brand/references/ecosystem.md       skills/rl3-brand/references/
   ```

**Verification**:
```bash
echo "Logos:      $(ls skills/rl3-brand/assets/*.svg | wc -l) (expect 2)"
echo "References: $(ls skills/rl3-brand/references/ | wc -l) (expect 4)"
```

---

### Task 10: Final verification, commit, push

**Files**: all (read-only check + git)
**Est**: 3 minutes

**Steps**:
1. Run full asset verification:
   ```bash
   echo "=== bbva-brand ==="
   echo "Fonts:      $(ls skills/bbva-brand/assets/fonts/ | wc -l | tr -d ' ') (expect 8)"
   echo "Icons:      $(ls skills/bbva-brand/assets/icons/ | wc -l | tr -d ' ') (expect 35)"
   echo "Logos:      $(ls skills/bbva-brand/assets/ | grep -v '/' | wc -l | tr -d ' ') (expect 2)"
   echo "References: $(ls skills/bbva-brand/references/ | wc -l | tr -d ' ') (expect 5)"
   echo ""
   echo "=== rl3-brand ==="
   echo "Logos:      $(ls skills/rl3-brand/assets/ | wc -l | tr -d ' ') (expect 2)"
   echo "References: $(ls skills/rl3-brand/references/ | wc -l | tr -d ' ') (expect 4)"
   ```
2. Validate both JSON files:
   ```bash
   python3 -m json.tool skills/bbva-brand/brand/tokens.json > /dev/null && echo "bbva tokens.json: PASS" || echo "bbva tokens.json: FAIL"
   python3 -m json.tool skills/rl3-brand/brand/tokens.json  > /dev/null && echo "rl3  tokens.json: PASS" || echo "rl3  tokens.json: FAIL"
   ```
3. Check no markers remain in any SKILL.md:
   ```bash
   grep -rn '\[\[' skills/*/SKILL.md && echo "FAIL: markers found" || echo "PASS: no markers in any SKILL.md"
   grep -rn '\$\{CLAUDE_SKILL_DIR\}' skills/*/SKILL.md && echo "FAIL: CLAUDE_SKILL_DIR found" || echo "PASS: no CLAUDE_SKILL_DIR"
   ```
4. Check no Python script refs in rl3-brand:
   ```bash
   grep -n 'brand_tokens.py\|generate_docx\|generate_pptx\|html_validator\|run_tests' skills/rl3-brand/SKILL.md && echo "FAIL" || echo "PASS: no Python refs"
   ```
5. Commit and push:
   ```bash
   git add .
   git status
   git commit -m "feat(brands): add bbva-brand and rl3-brand skills converted to new standard

   - Rename codi-bbva-brand → bbva-brand, codi-rl3-brand → rl3-brand
   - Add brand/tokens.json and brand/tokens.css to each skill
   - Update SKILL.md to new How-to-Apply format with tokens.json references
   - Copy all assets: 8 BBVA fonts, 35 BBVA icons, 2 BBVA logos, 2 RL3 logos
   - Copy all references: 5 BBVA files, 4 RL3 files
   - Drop RL3 Python scripts; migrate values into tokens.json"
   git push origin main
   ```

**Verification**: `git log --oneline -1` — confirms commit created. `git push` exits 0.
