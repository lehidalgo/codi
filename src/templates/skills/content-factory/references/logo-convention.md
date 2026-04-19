# Logo convention

> **The brand logo lives at `<brand-skill>/assets/logo.{svg,png}`. Always. If a brand doesn't have it there, fix the brand before using it — do not add workarounds in content code.**

This is the canonical rule. Everything else in this document is the
mechanics that support it.

## The overlay is the only logo — never embed a second one

Content Factory renders the brand logo as an **overlay** on every card
(preview, PNG, PDF, PPTX). The overlay is:

- Sourced from the discovery chain below (project → brand → built-in).
- Auto-sized to the canvas: **≈20% of the shortest side** by default
  (159px on A4 document, 216px on 1080 social, 144px on 16:9 slide).
  Positioned at **top-right** (x=85%, y=15%) by default. Visual weight
  at this size depends on the SVG's own viewBox padding — brand marks
  with tight bounding boxes read larger than marks with generous
  internal whitespace. The user can adjust size and position per format
  / per card via the inspector; their value persists.
- Inlined as SVG in exports, so there is no external `<img src>`.

**Do NOT embed the brand logo in content HTML.** No `<img src=".../logo.svg">`,
no `background-image: url(.../logo.svg)`, no inline `<svg>` of the brand
mark in a page header or hero block. Any of these creates a duplicate —
the factory's overlay AND the authored mark — which on export
produces two logos, desyncs when the brand changes, and forces export
sizes you can't tune from the inspector.

```html
BAD — brand logo hardcoded into the hero
<header class="hero">
  <img src="/api/brand/.../assets/logo.svg" alt="BBVA">
  <h1>Title</h1>
</header>

GOOD — chrome only; the factory overlays the logo on top
<header class="hero">
  <h1>Title</h1>
</header>
```

Exceptions (write-up, not a carve-out): content that *describes* or
compares multiple brands (e.g. a competitive deck showing several
marks) may inline the OTHER brands' logos — never the active brand's.
If you need the active brand inline for a semantic reason, that's a
design flag, not a workaround: surface it to the user before shipping.

---

## The standard

### Brand skill layout (SKILL ROOT, not under `brand/`)

```
<brand-skill>/
  SKILL.md
  assets/
    logo.svg          <- REQUIRED (primary)
    logo.png          <- accepted when SVG is unavailable
    logo-light.svg    <- optional, use on dark backgrounds
    logo-dark.svg     <- optional, use on light backgrounds
    fonts/
    icons/
  references/
  ...
```

SVG is strongly preferred — it scales perfectly for every canvas size
(A4 document, 1080 social, 16:9 slide) and can be inlined in exports
without pixelation. PNG is accepted for raster-only corporate marks
that cannot be vectorized.

### Content project layout (mirrors the brand)

```
<project>/
  assets/
    logo.svg          <- primary
    logo.png          <- fallback
  content/
  state/
  exports/
```

The project layout is identical to the brand layout so a project is
fully portable — zip it and the identity travels with it.

---

## Resolution chain

The server's `/api/project/logo` endpoint walks this chain on every
render. First match wins:

| Step | Path | `source` | Conforming |
|------|------|----------|:----------:|
| 1 | `<project>/assets/logo.svg` | `project` | yes |
| 2 | `<project>/assets/logo.png` | `project` | yes |
| 3 | `<brand>/assets/logo.svg` | `brand` | yes |
| 4 | `<brand>/assets/logo.png` | `brand` | yes |
| 5 | `<brand>` recursive — top candidate by filename signal | `brand-discovered` | **no** |
| 6 | `<brand>` recursive — fallback to best remaining `.svg` | `brand-discovered` | **no** |
| 7 | built-in codi mark | `builtin` | yes |

Response headers reveal which step fired:

```
X-Logo-Source: project | brand | brand-discovered | builtin
X-Logo-Conforming: true | false
```

When any of steps 3-6 fire, the server **also copies** the resolved
bytes into the project's canonical path as `assets/logo.svg` or
`.png` (matching the source format). After the first render, the
project owns the file — the brand is no longer consulted unless the
project file is deleted.

## Auto-discovery ranking (steps 5-6)

When the standard paths miss, the scanner walks the brand skill
recursively (max depth 4; skips `node_modules`, `.git`, `dist`,
`build`, `evals`) and scores every `.svg` and `.png`:

| Signal | Weight |
|--------|--------|
| Filename is exactly `logo.svg` or `logo.png` | +100 |
| Filename starts with `logo` (e.g. `logo-light.svg`) | +90 |
| Filename contains the brand name (e.g. `bbva-mark.svg`) | +80 |
| Filename matches brand-style pattern (`<BRAND>_RGB.svg`, `_CMYK`, `_LOGO`, `_MARK`) | +70 |
| Filename mentions "logo" anywhere | +20 |
| Lives in `assets/` | +20 |
| Lives in `brand/` | +15 |
| Is SVG | +10 |
| Shallow path (depth ≤ 2) | +5 |

Highest total wins. Ties broken by shortest path. Files scoring 0 are
ignored entirely. When a non-conforming logo is used, the server logs
a warning naming the exact file and the standard path to move it to.

---

## Agent pre-flight — MANDATORY before first render

When creating a project or switching the active brand, run this
decision tree **before** generating any content HTML:

```
1. Determine the active brand (or "none").

2. Call: GET /api/brand/<name>/conformance
   Response: { conforming, standardPath, discovered, advice }

3. If conforming === true
     -> proceed. The factory will seed <project>/assets/logo.svg
        on first render automatically.

4. If conforming === false AND discovered[0].score >= 100
     -> AUTO-FIX: copy discovered[0].path to
        <brand>/assets/logo.svg, record the change in the brand's
        README or CHANGELOG, inform the user.

5. If conforming === false AND discovered has results but top score < 100
     -> ASK THE USER: present the top candidates with their scores
        and let the user pick which should become assets/logo.svg.

6. If conforming === false AND discovered is empty
     -> ASK THE USER: "Brand <name> ships no logo. Paste SVG markup,
        point me at a file path, or skip to use the built-in mark."

7. If there is no active brand
     -> check <project>/assets/logo.{svg,png}.
        Missing? Ask the user if they want to supply one.
        Otherwise the built-in codi mark is used.

Only proceed with content generation once the standard path exists
(steps 3-5) or the user has explicitly accepted the built-in fallback.
```

The auto-fix step (4) is the preferred path for unambiguous cases —
every minute saved here is a minute the agent doesn't spend asking
questions the user already answered by picking a brand.

---

## Migration recipes for non-conforming brands

### Pattern 1 — Brand-named SVG at `assets/<BRAND>_RGB.svg`

Example: `codi-bbva-brand/assets/BBVA_RGB.svg`

```sh
cp <brand>/assets/BBVA_RGB.svg <brand>/assets/logo.svg
```

Keep the original file for backwards-compat if other tooling reads
it by name; the new `logo.svg` is the canonical entry point.

### Pattern 2 — Theme-split logos at `assets/logo-{light,dark}.svg`

Example: `codi-codi-brand/assets/logo-light.svg` + `logo-dark.svg`

Pick the default variant (usually light) and copy it to `logo.svg`:

```sh
cp <brand>/assets/logo-light.svg <brand>/assets/logo.svg
```

Keep the variants for theme-aware callers.

### Pattern 3 — Logo buried somewhere weird

If the scanner ranks the top candidate with a low score (< 100), do
not auto-fix — ask the user to confirm before renaming anything.

---

## FAQ

**Why not keep the `brand/assets/logo.svg` path?**
Because no brand in the wild uses it. Every real brand (internal and
external) ships assets at the skill root under `assets/`. The
convention should match the observed reality, not invent a new one.

**What about multiple variants (light, dark, horizontal, stacked)?**
Add them as `assets/logo-<variant>.svg`. The resolver ignores them
unless the consumer explicitly asks for a variant; `logo.svg` stays
the single default.

**Can I link a hosted logo (CDN URL)?**
Not today. The convention is a local file so projects stay portable
(zip and ship). If you need a hosted logo, inline its SVG markup into
`<project>/assets/logo.svg` once.

**What happens to exports (PNG, PDF, PPTX, DOCX)?**
All exporters read the same `/api/project/logo` endpoint so they
pick up exactly the mark the preview shows. No separate pipeline.

**Does the auto-discovery slow down renders?**
Scan runs only when the standard paths miss. Results are cached
per-brand per-server-lifetime. For conforming brands the cost is one
`fs.access` call.
