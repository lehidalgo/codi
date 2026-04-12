# Brand Creator — Implementation Reference

## Directory Structure

A brand skill must follow this layout exactly:

```
<brand-name>/
  SKILL.md                ← generated from brand-creator template
  brand/
    tokens.json           ← canonical brand data (single source of truth)
    tokens.css            ← CSS variable definitions — import in HTML outputs
  assets/
    logo-dark.svg         ← logo for use on dark backgrounds
    logo-light.svg        ← logo for use on light backgrounds
  templates/              ← optional: Content Factory HTML templates
    *.html                ← pre-styled templates (see Template Requirements below)
```

No colors, fonts, or voice phrases are hardcoded anywhere outside `brand/tokens.json`.

---

## brand/tokens.json — Full Schema

```json
{
  "brand":        "brand-name",
  "display_name": "Human-Readable Brand Name",
  "version": 1,
  "themes": {
    "dark": {
      "background":     "#000000",
      "surface":        "#111111",
      "text_primary":   "#ffffff",
      "text_secondary": "#aaaaaa",
      "primary":        "#000000",
      "accent":         "#000000",
      "logo":           "logo_dark_bg"
    },
    "light": {
      "background":     "#ffffff",
      "surface":        "#f5f5f5",
      "text_primary":   "#111111",
      "text_secondary": "#555555",
      "primary":        "#000000",
      "accent":         "#000000",
      "logo":           "logo_light_bg"
    }
  },
  "fonts": {
    "headlines":      "Font Name",
    "body":           "Font Name",
    "monospace":      "Courier New",
    "fallback_serif": "Georgia",
    "fallback_sans":  "Arial"
  },
  "assets": {
    "logo_dark_bg":  "assets/logo-light.svg",
    "logo_light_bg": "assets/logo-dark.svg",
    "fonts_dir":     null
  },
  "voice": {
    "tone":          "One sentence describing the brand's writing personality.",
    "phrases_use":   ["Characteristic phrase 1", "Characteristic phrase 2"],
    "phrases_avoid": ["phrase to avoid 1", "phrase to avoid 2"]
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `brand` | string | Kebab-case brand identifier — must match the skill folder name prefix |
| `display_name` | string | Human-readable name shown in UI (e.g. "Codi Platform") |
| `version` | number | Increment when schema or values change |
| `themes.dark` | object | Color tokens for dark-background content |
| `themes.light` | object | Color tokens for light-background content |
| `fonts.headlines` | string | Google Fonts or system font name for headings |
| `fonts.body` | string | Font name for body text |
| `fonts.monospace` | string | Monospace font for code blocks |
| `assets.logo_dark_bg` | string | Path to logo file for dark backgrounds (relative to skill root) |
| `assets.logo_light_bg` | string | Path to logo file for light backgrounds (relative to skill root) |
| `voice.tone` | string | One sentence describing writing style and personality |
| `voice.phrases_use` | string[] | Characteristic brand phrases to include in copy |
| `voice.phrases_avoid` | string[] | Phrases that clash with the brand voice |

### Color Token Roles

| Token | Role |
|-------|------|
| `background` | Page or card background fill |
| `surface` | Raised surface (cards, panels, code blocks) |
| `text_primary` | Main body text |
| `text_secondary` | Labels, captions, muted text |
| `primary` | Key accent color — buttons, highlights, links |
| `accent` | Secondary accent — decorative elements, borders |
| `logo` | Reference key into `assets` — which logo to use on this background |

---

## brand/tokens.css — Generation Rule

After editing `tokens.json`, generate `brand/tokens.css` from the dark theme values.
Add a `[data-theme="light"]` override block for light theme values.

```css
/* <brand-name> — Brand CSS Variables */
/* Generated from brand/tokens.json — do not edit manually */

:root {
  /* Dark theme (default) */
  --brand-bg:         /* themes.dark.background */;
  --brand-surface:    /* themes.dark.surface */;
  --brand-text:       /* themes.dark.text_primary */;
  --brand-text-muted: /* themes.dark.text_secondary */;
  --brand-primary:    /* themes.dark.primary */;
  --brand-accent:     /* themes.dark.accent */;

  /* Typography */
  --brand-font-headline: 'FontName', sans-serif;
  --brand-font-body:     'FontName', sans-serif;
  --brand-font-mono:     'MonoFont', monospace;
}

[data-theme="light"] {
  --brand-bg:         /* themes.light.background */;
  --brand-surface:    /* themes.light.surface */;
  --brand-text:       /* themes.light.text_primary */;
  --brand-text-muted: /* themes.light.text_secondary */;
  --brand-primary:    /* themes.light.primary */;
  --brand-accent:     /* themes.light.accent */;
}
```

---

## Logo Files

Place SVG logo files in `assets/`. Two variants are required:

| File | Background | Usage |
|------|------------|-------|
| `assets/logo-dark.svg` | Light | Use on light/white backgrounds |
| `assets/logo-light.svg` | Dark | Use on dark/black backgrounds |

If the brand logo is implemented as a CSS construct (gradient wordmark, text logo), document this in `assets.logo_note` and set `logo_dark_bg` / `logo_light_bg` to a string descriptor like `"css-wordmark"`.

---

## Typography

List every font used under `fonts`. Fonts must be loadable via Google Fonts or bundled in `assets/fonts/`.

| Field | Role | Example |
|-------|------|---------|
| `headlines` | Display and heading text | Outfit, Roboto Slab |
| `body` | Paragraph and UI text | Outfit, Inter |
| `monospace` | Code blocks, technical labels | Geist Mono, JetBrains Mono |
| `fallback_serif` | Serif fallback when brand font unavailable | Georgia |
| `fallback_sans` | Sans fallback when brand font unavailable | Arial |

---

## Content Factory Templates

Files in `templates/` appear in the Gallery → Templates tab of the Content Factory viewer.
Each file must include a `<meta name="codi:template">` tag in `<head>`:

```json
{"id":"<kebab-id>","name":"<Human Name>","type":"<social|slides|document>","format":{"w":<w>,"h":<h>}}
```

Name templates descriptively after their purpose:
- `social-cover.html` — branded social card cover
- `slides-intro.html` — branded slide deck introduction
- `document-report.html` — branded A4 report

See the Content Factory skill for full template authoring spec and clipping rules.

---

## Validation Checklist

Before shipping a brand skill, check:

- [ ] `brand/tokens.json` exists with all required fields
- [ ] `brand` field matches the skill folder name prefix (e.g. `"acme"` for `acme-brand`)
- [ ] `display_name` is set to the human-readable brand name
- [ ] Both `themes.dark` and `themes.light` are defined with all 6 color tokens
- [ ] `voice.tone` is a single sentence describing the brand writing style
- [ ] `assets/logo-dark.svg` and `assets/logo-light.svg` exist (or logo_note documents an alternative)
- [ ] `brand/tokens.css` is generated and matches `tokens.json`
- [ ] If `templates/` exists — all HTML files have a valid `<meta name="codi:template">` tag
- [ ] No color or font values are hardcoded outside `tokens.json`
