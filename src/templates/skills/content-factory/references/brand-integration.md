# Brand Integration

How to detect, activate, and apply a brand skill to generated content. Runs
after creating a project, before authoring any HTML — whether that HTML is
an anchor article, a distilled variant, or a fast-path one-off.

The brand layer is orthogonal to the anchor-first methodology. An anchor
inherits brand tokens, voice, fonts, and logo just like any other content
type. Every distilled variant re-inlines the same tokens — the brand is the
single source of truth across the anchor and all its derivatives. See
`[[/references/methodology.md]]` for when anchor-first applies; this reference covers the
brand-application mechanics for every case.

## 1. Discover installed brands

```bash
curl -s <url>/api/brands
```

Response example:
```json
[
  { "name": "codi-codi-brand", "display_name": "Codi Platform", "version": 2,
    "dir": "/abs/path/.claude/skills/codi-codi-brand" }
]
```

If brands are available and the user has not specified one, ask:
> "I found these brand skills: [list]. Should I apply one to this content?"

**Skip brand integration entirely** if the user explicitly provides a template or
says "no brand".

## 2. Activate the chosen brand

```bash
curl -s -X POST <url>/api/active-brand \
  -H "Content-Type: application/json" \
  -d '{"name": "codi-codi-brand"}'
```

Once a brand is active, apply it fully across every generated HTML file using
the following steps.

## 3. Read tokens

Read `brand/tokens.json` from the brand's skill directory. Extract:

- `colors` and `themes` for CSS values
- `fonts` for typography
- `assets.logo_dark_bg` / `assets.logo_light_bg` for the logo file paths
- `voice.tone`, `voice.phrases_use`, `voice.phrases_avoid` for copy

## 4. Inline CSS variables

Fetch `brand/tokens.css` from disk and paste its full content into a `<style>`
block in every generated HTML file. Do NOT use `<link href="...">` — iframes have
no access to file paths, only inline styles work reliably.

## 5. Load fonts

Check `tokens.json.fonts.google_fonts_url`:

- **If set** (e.g. Codi, any brand using Google Fonts): add a
  `<link rel="stylesheet">` tag pointing to that URL — Google Fonts loads
  correctly inside iframes from the web.
- **If null** (local fonts — brand ships its own font files): generate
  `@font-face` declarations using the brand asset serving URL:
  ```css
  @font-face {
    font-family: 'Acme Sans';
    src: url('http://localhost:PORT/api/brand/codi-acme-brand/assets/fonts/AcmeSans-Bold.woff2') format('woff2');
    font-weight: 700;
  }
  ```
  Enumerate the font files present in `assets/fonts/` and generate one
  `@font-face` block per file. Replace `PORT` with the actual server port from
  the startup JSON.

## 6. Embed the logo

There are two distinct logo concerns — they serve different purposes and
read from different paths.

### 6a. In-content logos (inside the HTML you author)

These are the logos that appear **inside the card design** — e.g. a
header mark in a document, a corner mark in a slide.

Determine the card's background color:

- If dark: use `assets.logo_light_bg` (light logo on dark background)
- If light: use `assets.logo_dark_bg` (dark logo on light background)

Fetch the SVG file via the brand asset route:
```
GET http://localhost:PORT/api/brand/<brand-name>/assets/<logo-filename>
```

Inline the SVG source directly in the HTML. Do NOT use `<img src="...">`
with a file path — the path will not resolve inside an iframe.

### 6b. Overlay logo (managed by the factory, not by you)

The content-factory UI shows a **logo overlay** positioned on top of the
card (controlled by the size/x/y sliders in the inspector). This is
separate from whatever you embed inside the HTML.

The overlay resolves its SVG **automatically**, in this order:

1. `.codi_output/<project>/assets/logo.svg` — project-level canonical path
2. `<active-brand>/brand/assets/logo.svg` — brand-skill default
3. Built-in `codi` mark — last resort

On the first request for a project with no logo, the server copies the
active brand's logo into the project path — from that moment the project
owns the file. This lazy bootstrap is handled by `scripts/lib/logo-resolver.cjs`;
you do NOT manage the copy step yourself.

**Agent responsibilities for the overlay logo:**

- Do NOT write files to `<project>/assets/logo.svg` manually as part of a
  content render — the factory handles it.
- If you want a specific non-brand logo for a one-off project, drop the
  SVG at that exact path before running the preview. Any SVG there wins.
- Do NOT embed the overlay's logo inside the HTML — that duplicates the
  mark. The overlay is drawn on top by the browser app.

**Brand-skill authors:**

If you are building a brand skill and want projects created under it to
inherit the overlay mark, ship `brand/assets/logo.svg` in your brand
skill. The factory will copy it into each new project on first render.

## 7. Visual style reference

Read the brand's `references/` directory. Open HTML reference files (e.g.
`references/brandguide.html`, `references/deck-reference.html`) to understand the
brand's CSS patterns, layout, component structure, and visual identity. Use these
as the style guide when writing card HTML and CSS.

## 8. Gallery templates (if available)

If the brand has a `templates/` directory, those files appear in the Gallery
alongside the built-in templates, grouped under the Social / Slides / Document
filters by each template's `type` meta. Ask the user if they want to start
from one of those instead of a generic built-in.

## 9. Copy and voice

Write all copy using `voice.tone` as the style guide. Use `voice.phrases_use`
phrases where natural. Never use `voice.phrases_avoid` phrases.
