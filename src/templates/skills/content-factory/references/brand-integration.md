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

### 6b. Overlay logo (managed by the factory)

The content-factory UI shows a **logo overlay** positioned on top of the
card (controlled by the size/x/y sliders in the inspector). This is
separate from whatever you embed inside the HTML in step 6a.

**The logo convention is documented in full at
`references/logo-convention.md` — read it before creating a project.**
The short version:

**Standard path (brand skill root):**

```
<brand-skill>/assets/logo.svg    <- REQUIRED
<brand-skill>/assets/logo.png    <- accepted when SVG unavailable
```

**Project path (mirrors the brand):**

```
<project>/assets/logo.svg
<project>/assets/logo.png
```

**Resolution order:** project → brand standard path → auto-discovered
candidate in the brand skill → built-in codi mark. First match wins and
is copied into the project on first render, so the project owns the
file from that point.

**Agent pre-flight — MANDATORY before first render:**

1. Call `GET /api/brand/<name>/conformance` — returns `{ conforming,
   standardPath, discovered, advice }`
2. If the brand conforms → proceed, factory handles everything
3. If non-conforming with a strong candidate (score ≥ 100) → auto-fix by
   copying to `<brand>/assets/logo.svg`, note in the brand's README
4. If non-conforming with ambiguous candidates → ask the user
5. If no logo at all → ask the user to supply one

Full decision tree and migration recipes live in `logo-convention.md`.

**Do NOT:**

- Do NOT write files to `<project>/assets/logo.svg` manually during a
  content render — the factory bootstraps it automatically.
- Do NOT embed the overlay logo inside the HTML — that duplicates the
  mark. The overlay is drawn on top by the browser app.
- Do NOT work around a non-conforming brand in content code — fix the
  brand instead (auto-fix or ask the user).

**Brand-skill authors:** ship `<brand>/assets/logo.svg`. That is the
only promise the factory requires.

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
