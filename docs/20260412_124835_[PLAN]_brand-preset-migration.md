# Brand Preset Migration — codi-presets repo
- **Date**: 2026-04-12 12:48
- **Document**: 20260412_124835_[PLAN]_brand-preset-migration.md
- **Category**: PLAN

---

## Goal

Clone `https://github.com/rl3aiboutique-cpu/codi-presets.git`, build a `brands` preset inside
it with two converted brand skills (`bbva-brand` and `rl3-brand`), and push the result.

The conversion means:
- Each skill moves to the new brand standard: `brand/tokens.json` + `brand/tokens.css` + updated `SKILL.md`
- All existing assets (logos, fonts, icons, reference files) are copied verbatim from `recx`
- RL3's Python `scripts/` directory is dropped; all values migrate into `brand/tokens.json`
- Both skills are renamed from their `codi-` prefix form (`codi-bbva-brand` → `bbva-brand`, `codi-rl3-brand` → `rl3-brand`)

---

## Target Repository Structure

```
codi-presets/
  preset.yaml
  skills/
    bbva-brand/
      SKILL.md
      brand/
        tokens.json
        tokens.css
      assets/
        BBVA_RGB.svg
        BBVA_RGB.png
        fonts/
          BentonSansBBVA-Bold.woff2
          BentonSansBBVA-Book.woff2
          BentonSansBBVA-Light.woff2
          BentonSansBBVA-Medium.woff2
          TiemposTextWeb-Regular.woff2
          TiemposTextWeb-RegularItalic.woff2
          tiempos-headline-bold.woff2
          tiempos-headline-bold-italic.woff2
        icons/
          (35 SVGs — account, add, arrows, bank, calendar, card, cart,
           cash, chat, check, close, configuration, delete, document,
           dollar, download, edit, email, euro, favorite, filter, home,
           info, lock, menu, mobile, my-profile, search, send, settings,
           share, transfer, upload, wallet, warning)
      references/
        bbva-deck-reference.html
        bbva-deck-reference.css
        bbva-deck-reference.js
        icon-catalog.md
        values-imagery.md
    rl3-brand/
      SKILL.md
      brand/
        tokens.json
        tokens.css
      assets/
        rl3-logo-dark.svg
        rl3-logo-light.svg
      references/
        brandguide.html
        brand-concept.html
        services.md
        ecosystem.md
```

---

## preset.yaml

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

---

## Conversion: bbva-brand

### brand/tokens.json
Extracted from the inline content in `codi-bbva-brand/SKILL.md`:

```json
{
  "brand": "bbva-brand",
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

### brand/tokens.css
Generated from `tokens.json`. Uses `--brand-*` variables (new standard) alongside `--bbva-*` for
backward compatibility with existing reference HTML files:

```css
/* bbva-brand — Brand CSS Variables */
/* Generated from brand/tokens.json */

:root {
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
  --bbva-blue:         #004481;
  --bbva-navy:         #072146;
  --bbva-aqua:         #2dcccd;
  --bbva-coral:        #f5835a;
  --bbva-dark:         #121212;
  --bbva-white:        #ffffff;
  --bbva-light-gray:   #f4f4f4;
  --bbva-medium-gray:  #bdbdbd;
  --bbva-text:         #333333;
  --bbva-text-secondary: #666666;
  --bbva-heading-font: 'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
  --bbva-body-font:    'BentonSans BBVA', 'Helvetica Neue', Arial, sans-serif;
  --bbva-serif-font:   'Tiempos Text', Georgia, 'Times New Roman', serif;
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

### SKILL.md changes
- Frontmatter: `name: bbva-brand`, `managed_by: user`, keep `category: Brand Identity`
- Add "How to Apply This Brand" section at top (4 steps: read tokens.json, import tokens.css, apply voice, use references)
- Remove inline CSS variables block (now in tokens.css)
- Replace all `${CLAUDE_SKILL_DIR}[[/assets/...]]` markers with plain relative paths (`assets/...`)
- Keep all brand narrative: color table, typography table, logo rules, tone of voice, document standards

---

## Conversion: rl3-brand

### brand/tokens.json
Migrated from `scripts/brand_tokens.py`:

```json
{
  "brand": "rl3-brand",
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
    "headlines": "Space Grotesk",
    "body":      "Instrument Sans",
    "monospace": "Space Mono",
    "fallback_sans": "sans-serif",
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
    { "num": "01", "name": "Estrategia AI",          "en": "Observe", "desc": "Observamos tu entorno, diseñamos la policy óptima" },
    { "num": "02", "name": "Implementación",          "en": "Act",     "desc": "Agentes, automatizaciones y sistemas inteligentes en producción" },
    { "num": "03", "name": "Optimización Continua",   "en": "Iterate", "desc": "Cada dato es una señal de recompensa; iterar y escalar" }
  ]
}
```

### brand/tokens.css
Generated from `tokens.json`. Uses `--brand-*` standard variables alongside `--rl3-*` for backward
compatibility with existing reference HTML files:

```css
/* rl3-brand — Brand CSS Variables */
/* Generated from brand/tokens.json */

:root {
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

### SKILL.md changes
- Frontmatter: `name: rl3-brand`, `managed_by: user`, keep `category: Brand Identity`
- Add "How to Apply This Brand" section at top (read tokens.json, import tokens.css, apply voice, use references)
- Remove routing table with Python script commands (`generate_docx.py`, `generate_pptx.py`, validators)
- Remove `content.json` schema section (Python generator artifact — no longer needed)
- Remove "Validation Rules Summary" and "Testing" sections (Python validator artifact)
- Replace all `${CLAUDE_SKILL_DIR}[[/scripts/brand_tokens.py]]` references with `brand/tokens.json`
- Replace all `${CLAUDE_SKILL_DIR}[[/assets/...]]` markers with plain relative paths
- Keep: visual identity section, tone of voice, document & presentation standards, reference files table, available agents section

---

## Implementation Phases

| Phase | Task |
|-------|------|
| 1 | Clone `codi-presets` repo locally to `/Users/laht/projects/codi-presets` |
| 2 | Check existing repo content — if `skills/` already exists, keep its contents and add alongside; if `preset.yaml` already exists, overwrite it with the new manifest |
| 3 | Write `preset.yaml` |
| 4 | Convert `bbva-brand`: write `brand/tokens.json` + `brand/tokens.css` + updated `SKILL.md` + copy all assets + copy all references |
| 5 | Convert `rl3-brand`: write `brand/tokens.json` + `brand/tokens.css` + updated `SKILL.md` + copy assets + copy references |
| 6 | Verify asset file counts match source (8 fonts, 35 icons, 2 logos, all references) |
| 7 | Commit and push to `main` |

---

## Definition of Done

- `preset.yaml` validates against Codi preset schema (`name: brands`, both skills listed)
- `bbva-brand/brand/tokens.json` contains all 10 colors, 2 font families, voice phrases
- `rl3-brand/brand/tokens.json` contains all 8 colors, 3 font families, voice phrases, service pillars
- Both `tokens.css` include `--brand-*` standard variables AND legacy brand-specific variables
- Asset count matches source exactly: BBVA (2 logo files + 8 fonts + 35 icons), RL3 (2 logo SVGs)
- Reference count matches source: BBVA (5 files), RL3 (4 files)
- No `${CLAUDE_SKILL_DIR}[[/...]]` markers remain in any SKILL.md
- No Python script references remain in `rl3-brand/SKILL.md`
- Repo pushed to `https://github.com/rl3aiboutique-cpu/codi-presets.git`
