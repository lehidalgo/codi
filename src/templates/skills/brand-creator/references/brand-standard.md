# Brand Creator — Implementation Reference

## Directory Structure

A brand skill must follow this layout exactly:

```
<brand-name>/
  SKILL.md                ← generated from brand-creator template
  LICENSE.txt             ← usage license for brand assets
  brand/
    tokens.json           ← canonical brand data (single source of truth)
    tokens.css            ← CSS variable definitions — inline in HTML outputs
  assets/
    logo-dark.svg         ← logo for use on dark backgrounds
    logo-light.svg        ← logo for use on light backgrounds
    fonts/                ← optional: local font files (woff2) for offline brands
  references/             ← visual HTML style guides for the agent
    brandguide.html       ← brand colors, type, and component reference
    deck-reference.html   ← slide deck visual reference
  evals/
    evals.json            ← evaluation prompts and expected brand outputs
  templates/              ← optional: Gallery-ready Content Factory HTML templates
    *.html                ← pre-styled templates (see Template Requirements below)
```

Files in `references/` are visual HTML style guides — no `<meta name="codi:template">` required.
Files in `templates/` must include `<meta name="codi:template">` and follow the Content Factory template spec.

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
    "headlines":        "Font Name",
    "body":             "Font Name",
    "monospace":        "Courier New",
    "fallback_serif":   "Georgia",
    "fallback_sans":    "Arial",
    "google_fonts_url": null
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
| `fonts.google_fonts_url` | string \| null | Full Google Fonts CSS URL — `null` if brand uses local fonts |
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
| `google_fonts_url` | Full CSS URL for Google Fonts import — `null` if brand ships local fonts | `"https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap"` |

**Font loading rule used by Content Factory:**
- If `google_fonts_url` is not null: inject `<link rel="stylesheet" href="...">` in generated HTML — Google Fonts loads inside iframes from the web.
- If `google_fonts_url` is null: generate `@font-face` blocks pointing to `/api/brand/<name>/assets/fonts/<file>` — served by the Content Factory server at runtime.

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

## Content Factory Integration

The Content Factory server discovers brand skills automatically and exposes them through the UI brand selector. When a user picks a brand, the Content Factory agent follows this process:

### Asset serving

The server exposes all files under a brand's `assets/` directory at:

```
GET http://localhost:PORT/api/brand/<brand-name>/assets/<relative-path>
```

Examples:
- `GET .../api/brand/codi-codi-brand/assets/logo-light.svg`
- `GET .../api/brand/codi-codi-brand/assets/fonts/BrandFont-Bold.woff2`

The agent must use these URLs — never file system paths — inside generated HTML, because iframes cannot resolve local paths.

### Logo embedding

The agent fetches the SVG source via the asset route above and inlines it directly in the HTML. Using `<img src="file://...">` will not work inside an iframe.

### CSS variables

The agent reads `brand/tokens.css` from disk and pastes its full content into a `<style>` block. Using `<link href="...">` does not work inside iframes.

### Font loading

The agent checks `tokens.json.fonts.google_fonts_url`:
- **Not null**: inject `<link rel="stylesheet" href="<google_fonts_url>">` — Google Fonts resolves inside iframes.
- **null**: read `assets/fonts/` directory, generate one `@font-face` block per file using the asset serving URL pattern above.

### Visual references

The agent reads HTML files from `references/` to understand the brand's CSS patterns, color use, and layout conventions before writing card content. These files are not shown in the Gallery — they are private style guides for the agent.

---

## Validation Checklist

Before shipping a brand skill, check:

- [ ] `brand/tokens.json` exists with all required fields
- [ ] `brand` field matches the skill folder name prefix (e.g. `"acme"` for `acme-brand`)
- [ ] `display_name` is set to the human-readable brand name
- [ ] Both `themes.dark` and `themes.light` are defined with all 6 color tokens
- [ ] `fonts.google_fonts_url` is set (string URL) or explicitly `null` (local fonts in `assets/fonts/`)
- [ ] `voice.tone` is a single sentence describing the brand writing style
- [ ] `assets/logo-dark.svg` and `assets/logo-light.svg` exist (or logo_note documents an alternative)
- [ ] `brand/tokens.css` is generated and matches `tokens.json`
- [ ] `references/` contains at least one HTML visual style guide
- [ ] `evals/evals.json` exists with at least one evaluation entry
- [ ] `LICENSE.txt` exists describing usage rights for brand assets
- [ ] If `templates/` exists — all HTML files have a valid `<meta name="codi:template">` tag
- [ ] No color or font values are hardcoded outside `tokens.json`
