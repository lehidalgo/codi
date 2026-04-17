# Codi Brand Migration to New Standard

- **Date**: 2026-04-14 02:00
- **Document**: 20260414_0200_REPORT_codi-brand-migration.md
- **Category**: REPORT

## Summary

The `codi-brand` skill was migrated from the legacy brand-skill-owns-pipeline model
to the new brand-creator standard where brand skills are **pure content** and
rendering/export is owned by `codi-content-factory`. This report documents what
moved, what was removed, and how consumers should adapt.

## Motivation

Prior to 2026-04-12, every brand skill shipped its own preview server, generators,
and export pipeline (`scripts/preview-shell.js`, `scripts/server.cjs`,
`scripts/export/*.js`, `generators/*.html`). This produced heavy skill directories,
duplicated the same infrastructure across every brand, and put 1300+ LOC JavaScript
inside each brand skill.

On 2026-04-12 the `brand-creator` skill introduced the new standard: brand skills
are pure content (`brand/tokens.json`, `brand/tokens.css`, `assets/`, `references/`,
`templates/`, `evals/`) consumed by `codi-content-factory` via its `/api/brands`
discovery endpoint. Rendering, preview, iteration, and export to HTML/PDF/PPTX/DOCX
are centralized in the content factory.

`codi-brand` was the last built-in brand skill still on the legacy model.

## What Was Removed

| Path | Reason |
|------|--------|
| `src/templates/skills/codi-brand/scripts/preview-shell.js` (1318 LOC) | Content factory owns the preview server |
| `src/templates/skills/codi-brand/scripts/server.cjs` (414 LOC) | Content factory owns the HTTP server |
| `src/templates/skills/codi-brand/scripts/start-server.sh` / `stop-server.sh` | No standalone server anymore |
| `src/templates/skills/codi-brand/scripts/helper.js` | Live-reload handled by content factory |
| `src/templates/skills/codi-brand/scripts/frame-template.html` | Iframe shell replaced by content factory app shell |
| `src/templates/skills/codi-brand/scripts/brand_tokens.json` | Duplicated `brand/tokens.json` |
| `src/templates/skills/codi-brand/scripts/export/*` | Export pipeline moved to `codi-content-factory/scripts/lib/exports.cjs` + `bundle.cjs` |
| `src/templates/skills/codi-brand/scripts/ts/*` | TypeScript validators consumed by deleted export pipeline |
| `src/templates/skills/codi-brand/scripts/vendor/html2canvas.min.js` | Content factory ships its own vendor bundle |
| `src/templates/skills/codi-brand/scripts/vendor/jszip.min.js` | Same |
| `src/templates/skills/codi-brand/generators/slides-base.html` | Content factory owns the slide template |
| `src/templates/skills/codi-brand/generators/document-base.html` | Content factory owns the document template |
| `src/templates/skills/codi-brand/generators/social-base.html` | Content factory owns the social template |
| `src/templates/skills/codi-brand/brand/tokens.ts` | TypeScript adapter consumed only by deleted exports |
| `src/templates/skills/codi-brand/README.md` | Replaced by new `template.ts` body |

Total: ~16,000 LOC removed from the codi-brand skill, including vendor bundles.

## What Was Added

| Path | Purpose |
|------|---------|
| `src/templates/skills/codi-brand/assets/logo-dark.svg` | SVG fallback of the CSS gradient wordmark (dark-background contexts) |
| `src/templates/skills/codi-brand/assets/logo-light.svg` | SVG fallback of the CSS gradient wordmark (light-background contexts) |
| `src/templates/skills/codi-brand/LICENSE.txt` | Brand asset usage license |

The logos are SVG fallbacks for contexts that cannot render the CSS gradient
wordmark (PDF metadata, PPTX image embeds, social media open-graph previews).
The primary Codi logo remains a CSS gradient span rendered inline — see the
`logo_note` field in `brand/tokens.json` for the exact HTML pattern.

## What Was Modified

### `brand/tokens.json`

- **Added** `fonts.google_fonts_url` (required by the brand-skill validator)
- **Updated** `assets.logo_dark_bg` / `logo_light_bg` to point to the new SVG files
- **Kept** `assets.logo_note` explaining the CSS wordmark approach
- **Removed** the `layout` section — content factory templates own slide/document/social dimensions now
- **Bumped** `version` from 2 to 3

### `brand/tokens.css`

- **Removed** the `SKILL_FONTS_DIR` / `SKILL_ASSETS_DIR` placeholder comments — those were resolved by the old preview server which no longer exists
- **Kept** all CSS variables, both `:root` dark theme and `.theme-light`, and the Codi-specific custom properties (`--grad`, `--c0`, `--c1`, `--surface-2/3`, `--border`, `--text-1/2/3`)
- **Dropped** the slide/document/social geometry variables — those belong to content factory templates

### `template.ts`

Full rewrite following the `brand-creator` template shape. The new content:

- Opens with `## When to Activate`
- Has a `## How to Apply This Brand` section with 6 numbered steps: read tokens → inline CSS → add Google Fonts link → apply voice → study references → hand off to content factory
- Has an `## Asset Map` table listing every file the agent should read
- Has a `## Brand Context Loading` section with the mental model (dark/light themes, fonts, gradient, voice)
- Has a `## The Codi Logo` section explaining the CSS wordmark pattern and when to use the SVG fallbacks
- Has a `## Gallery Templates` table listing the Content Factory gallery templates this brand provides
- Has a `## Directory Structure` block showing the new (flat) layout
- Has a `## Voice Guidelines` table
- Closes with `## Handoff to Content Factory` instructions (set `/api/active-brand`, load gallery template, iterate, export)

Version bumped from 16 to 17.

## Impact on Consumers

**Agents reading the skill:** Nothing to change. Agents discover the skill
through the normal SKILL.md routing and get the new instructions automatically
on the next `codi generate` run.

**Content factory:** Already compatible. The brand discovery endpoint
(`GET /api/brands`) looks for any sibling `*-brand` skill directory with
`brand/tokens.json`, which codi-brand still has. The gallery discovery
endpoint (`GET /api/templates`) looks in each brand's `templates/` directory,
which codi-brand already provides (`codi-slides-pitch.html`, `codi-social-dark.html`).

**Old script paths:** Any external script that referenced
`.claude/skills/codi-codi-brand/scripts/*` or `.claude/skills/codi-codi-brand/generators/*`
will break. Grep the workspace before upgrading:

```bash
grep -rn "codi-codi-brand/scripts\|codi-codi-brand/generators" <your-repo>
```

Replace any such references with content factory equivalents:

- Preview server → `codi content-factory start`
- Slide template → content factory `/api/template?file=...`
- HTML export → content factory `/api/export-html-bundle`
- PDF/PPTX/DOCX export → content factory `/api/export-pdf` / `/api/export-pptx` / `/api/export-docx`

## Migration Workflow (for dogfooded installs)

```bash
# 1. Rebuild so dist/ has the new template content
npm run build

# 2. Refresh .codi/skills/codi-codi-brand/ from the updated template
codi update --skills --on-conflict keep-incoming

# 3. Regenerate agent-specific copies AND prune deleted files
codi generate --on-conflict keep-incoming
```

Step 3 uses the new prune behavior added alongside this migration: orphaned
files from the old `scripts/` and `generators/` directories that no longer
exist in the source template will be automatically deleted.

## Related Changes

- **Hook exclusion list** (`src/core/hooks/hook-templates.ts`) now excludes
  `/\/vendor\//` and `\.css$` and no longer blanket-excludes `^src/templates/`
  — JavaScript under skill templates is now size-checked.
- **Content factory server split** — `scripts/server.cjs` was split from 820
  lines into a thin 199-line entry point + 9 route/lib modules, each under
  300 lines. This was prerequisite work to make content factory a credible
  home for the rendering pipeline that brand skills no longer ship.
- **`codi generate` prune** — new `StateManager.detectOrphans()` +
  `deleteOrphans()` automatically clean up files removed from source templates.
  Without this, migrating codi-brand would leave orphaned `scripts/` and
  `generators/` directories in every installed agent tree forever.
- **`codi generate` conflict flag rename** — `ConflictOptions.json` →
  `keepCurrent` to decouple from the CLI global `--json` output flag.

## References

- [brand-creator template](../src/templates/skills/brand-creator/template.ts) — the schema this migration conforms to
- [brand-standard.md](../src/templates/skills/brand-creator/references/brand-standard.md) — full brand skill schema reference
- [brand-skill-validate hook](../src/core/hooks/brand-skill-validate-template.ts) — validator enforcing the schema
- [content-factory brand discovery](../src/templates/skills/content-factory/scripts/lib/brand-discovery.cjs) — how the content factory finds brand skills
- [codi-brand template.ts](../src/templates/skills/codi-brand/template.ts) — the migrated template body
