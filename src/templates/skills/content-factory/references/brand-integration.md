# Brand Integration

How to detect, activate, and apply a brand skill to generated content. This runs
as **Step 1c** of the Content Factory workflow — after creating a project, before
generating any HTML.

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

Determine the card's background color:

- If dark: use `assets.logo_light_bg` (light logo on dark background)
- If light: use `assets.logo_dark_bg` (dark logo on light background)

Fetch the SVG file via the brand asset route:
```
GET http://localhost:PORT/api/brand/<brand-name>/assets/<logo-filename>
```

Inline the SVG source directly in the HTML. Do NOT use `<img src="...">` with a
file path — the path will not resolve inside an iframe.

## 7. Visual style reference

Read the brand's `references/` directory. Open HTML reference files (e.g.
`references/brandguide.html`, `references/deck-reference.html`) to understand the
brand's CSS patterns, layout, component structure, and visual identity. Use these
as the style guide when writing card HTML and CSS.

## 8. Gallery templates (if available)

If the brand has a `templates/` directory, those files appear in the Gallery →
Templates tab. Ask the user if they want to start from one of those instead of a
generic built-in.

## 9. Copy and voice

Write all copy using `voice.tone` as the style guide. Use `voice.phrases_use`
phrases where natural. Never use `voice.phrases_avoid` phrases.
