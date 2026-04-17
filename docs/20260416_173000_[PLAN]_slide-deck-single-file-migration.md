# Slide Deck Single-File Migration + Template Grid + Box-Layout Propagation

- **Date**: 2026-04-16 17:30 (rev. 17:50 — finalized B1 ultra-clean + Choice 1)
- **Document**: 20260416_173000_[PLAN]_slide-deck-single-file-migration.md
- **Category**: PLAN
- **Branch**: feat/box-validator
- **Related specs**:
  - `20260416_165258_[PLAN]_hybrid-box-layout-model.md`
  - `20260416_170500_[PLAN]_hybrid-box-layout-impl.md`
  - `20260413_1955_SPEC_content-factory-animated-deck.md`

---

## 1. Goals

1. **Part A — Migration (ultra-clean, creative-brief authoring)**: The
   coding agent generates a single self-contained HTML deck from scratch,
   guided by a creative brief (principles + structural contract + brand
   alignment). The export pipeline is deleted: the `/api/export-html-bundle`
   server handler streams the source file byte-for-byte; no transformation,
   no inlining, no bundler. Playwright-based exports (PNG / PDF / PPTX) are
   unchanged.
2. **Part B — Template grid pattern**: Apply the hybrid-layout structural
   grid pattern to the 12 built-in templates in
   `src/templates/skills/content-factory/generators/templates/` (Part 3 of
   the hybrid box-layout plan).
3. **Part C — Box-layout CJS propagation gap**: Document the known
   limitation that `codi generate` does not propagate edits to
   `.claude/skills/codi-content-factory/scripts/lib/box-layout/`.

---

## 2. Design Intent (Part A)

### 2.1 Before

- Agent produces `deck.html` + `deck.css` + `deck.js`. The `.css` and `.js` are byte-for-byte copies of `slides-base.css` (545 lines) and `slides-base.js` (191 lines).
- A CLI (`compile-deck.js`, 82 lines) stitches the three files into one standalone HTML.
- A server handler (`bundle.cjs`, ~340 lines) runs a 4-pass pipeline at export time: `bundleHtml` → `inlineFonts` → `inlineImages` → `inlineBundleAssets`, plus a 108-line legacy fallback (`injectCanonicalDeckEngine`) that injects `slides-base.css`/`slides-base.js` into decks that skipped the reference pattern.
- All decks end up structurally identical because the CSS and JS are one shared file duplicated.

### 2.2 After

- Agent produces **one** self-contained HTML file. `<style>` and `<script>` blocks are inline. All SVGs are inline markup. All non-SVG images are data URIs. No references to sibling files, `/api/brand/*`, `/vendor/*`, `/static/*`, or any CDN other than Google Fonts.
- Google Fonts via `<link href="https://fonts.googleapis.com/...">` is allowed — it is the standard way brand typography is referenced on the web, and the file still renders (with fallback) offline.
- The `/api/export-html-bundle` handler reads the source file from disk and streams it byte-for-byte with `Content-Disposition: attachment`. Zero transformation. What the agent wrote is what the user downloads.
- PNG / PDF / PPTX exports unchanged — they render the HTML in Playwright and produce outputs independently. They already work on any valid HTML.
- A new **creative brief** (`references/slide-deck-engine.md`) tells the agent:
  - What is mechanically required for the preview + export pipeline to work.
  - What motion principles make a deck feel premium and modern.
  - How to align with brand tokens and tone.
  - Short illustrative snippets (example keyboard-nav JS, example staggered-reveal CSS) marked as starting points, not as required code to paste.
- The 13 design-system rules in `references/design-system.md` still apply as the quality bar. They constrain quality without prescribing animation style.

### 2.3 What the creative brief contains

New file: `src/templates/skills/content-factory/references/slide-deck-engine.md`

**(a) Intent** (one paragraph): premium, modern, animated, brand-aligned, each one distinct.

**(b) Structural contract — required**

- Each slide is `<section class="slide" data-type="...">` inside a `.deck` wrapper at the active canvas size (1280×720 default; other sizes supported by the format selector).
- Exactly one slide is visible at a time. The first slide carries the `active` modifier on page load.
- A visible progress indicator and slide counter are rendered (the agent chooses the visual form — thin bar, dotted row, numeric chip; consistent with the brand).
- Keyboard navigation: `←` / `→` (and `PageUp` / `PageDown`) move between slides; can't advance past the first or last.
- Self-contained: no `<link>` or `<script src>` to sibling files, no `/api/brand/*`, `/vendor/*`, `/static/*`, no non-font CDN references, no assets that require network to resolve (fonts from Google Fonts are the sole exception).
- Respect `prefers-reduced-motion: reduce` — disable transforms and long transitions when set.

**(c) Motion principles — creative, no prescribed CSS or JS**

- Motion directs attention, not decoration.
- Modern easing (spring, `cubic-bezier(0.22, 1, 0.36, 1)` family) — not linear, not default ease.
- Stagger child reveals for depth — 60-120ms between siblings reads as premium; 20ms or less reads as rushed; 300ms or more reads as sluggish.
- Use `transform` and `opacity` to stay on the compositor thread (60fps). Avoid animating `width`, `height`, `top`, `left`.
- Replay entry animations on every slide change — the viewer should not see a stale mid-animation state.
- Transitions between slides can be a crossfade, a slide-in, a scale, a mask reveal — agent's choice, consistent within one deck.
- Feel premium: this is a pitch deck, not a slideshow.

**(d) Brand alignment — required**

- Colors, typography, and spacing come from brand tokens (`brand/tokens.json`, `brand/tokens.css`).
- Voice and copy follow `references/tone-and-copy.md`.
- The 13 design-system rules in `references/design-system.md` still apply.
- If a brand defines a motion language, honor it; otherwise apply the motion principles above.

**(e) Illustrative snippets — labeled as examples, not as required code**

- ~15-line CSS example showing a staggered reveal using `animation-delay` on `nth-child` selectors + `@keyframes`.
- ~20-line JS example showing keyboard navigation + animation replay on slide change.

Both are wrapped in prose that says: *"This is one way to implement the contract — you are free to replace it entirely with Web Animations API, View Transitions API, scroll-driven animations, or any other approach that meets the brief."*

**(f) Anti-patterns (explicit)**

- No `<link rel="stylesheet">` pointing at anything except `https://fonts.googleapis.com/...`.
- No `<script src>`.
- No `/api/brand/*`, `/vendor/*`, `/static/*` URLs in the output.
- No CDN references for JS libraries.
- No `fetch`, `XMLHttpRequest`, or network calls at runtime.
- No `eval` or dynamic code generation.
- Images: either inline `<svg>` markup or `<img src="data:image/...;base64,...">`. Never a server-relative path.

**(g) Per-slide verification**

Cross-reference the existing `references/design-system.md` checklist (frame locked, chrome matched, text tiers, overflow, etc.). No duplication.

---

## 3. Current State (Evidence)

### 3.1 Files to delete

| File | Lines | Current role |
|------|-------|--------------|
| `src/templates/skills/content-factory/generators/slides-base.html` | 225 | HTML shell that links `deck.css` + `deck.js` |
| `src/templates/skills/content-factory/generators/slides-base.css` | 545 | Brand tokens + full slide styles |
| `src/templates/skills/content-factory/generators/slides-base.js` | 191 | Deck navigation engine |
| `src/templates/skills/content-factory/scripts/export/compile-deck.js` | 82 | CLI wrapping the bundler pipeline |
| `src/templates/skills/content-factory/scripts/export/lib/bundle-html.js` | — | `bundleHtml()` — inlines `<link>` and `<script src>` refs |
| `src/templates/skills/content-factory/scripts/export/lib/inline-assets.js` | — | `inlineFonts()` + `inlineImages()` |
| `src/templates/skills/content-factory/scripts/export/lib/` | (dir) | Empty after the above deletions |
| `src/templates/skills/content-factory/scripts/export/` | (dir) | Empty after the above deletions |

### 3.2 Files to create

| File | Purpose |
|------|---------|
| `src/templates/skills/content-factory/references/slide-deck-engine.md` | Creative brief — intent + contract + principles + brand alignment + illustrative snippets + anti-patterns |

### 3.3 Files to edit

| File | Reason |
|------|--------|
| `src/templates/skills/content-factory/template.ts` | Remove 3-file asset-map rows (L46-48, L51); add new reference row; rewrite deck generation section (L520-553) to single-file authoring instructions; bump `version:` |
| `src/templates/skills/content-factory/scripts/lib/bundle.cjs` | Trim from ~340 lines to ~95 lines: keep `resolveSourceFromPayload` + `resolveActiveSource`; replace `handleExportHtmlBundle` body with a simple "read file + stream as attachment" handler. Delete `inlineBundleAssets`, `isSlideDeck`, `hasCanonicalDeckEngine`, `readCanonicalFile`, `injectChromeElements`, `DECK_SPECIFICITY_BOOSTER`, `injectCanonicalDeckEngine`, and all `bundleHtml`/`inlineFonts`/`inlineImages` requires + calls. |
| `src/templates/skills/content-factory/generators/templates/*.html` | Part B — apply structural grid pattern |

### 3.4 Files kept unchanged

| File | Role |
|------|------|
| `src/templates/skills/content-factory/scripts/server.cjs` + route files | Still serve `/api/export-html-bundle` (dispatches to the trimmed handler). Playwright-based export endpoints (`/api/export-pdf`, PNG, PPTX) unchanged. |
| `src/templates/skills/content-factory/scripts/lib/*.cjs` (everything except `bundle.cjs`) | Unrelated to the export pipeline. |
| `src/templates/skills/codi-brand/**` | No references to `slides-base` or `compile-deck`. |
| The 14 existing templates (`codi-slides-pitch`, `codi-social-dark`, 12 generator templates) | Already single-file; use Google Fonts via `<link>` which is explicitly allowed under Choice 1. No migration needed. |

### 3.5 Test coverage

- `grep` for `slides-base`, `compile-deck`, `injectCanonicalDeckEngine`, `bundleHtml`, `inlineFonts`, `inlineImages` across `tests/` and `src/templates/skills/content-factory/tests/` → no hits.
- No existing tests break on deletion.

---

## 4. Blast Radius

| Area | Impact | Mitigation |
|------|--------|------------|
| Agent instructions (SKILL.md) | Rewritten from "copy these files" to "author one file per the brief". Existing in-flight sessions that already wrote `deck.css`/`deck.js` still render in the preview (the server just serves files; Playwright resolves `<link>` refs during PNG/PDF export). "HTML · all" export on such legacy files will return them with the sibling references intact — the user gets a 3-file deck in their download, not a bundled one. | Bump template `version:` so the skill reloads. Legacy decks re-generate cleanly via agent. |
| `POST /api/export-html-bundle` | No more inlining. For self-contained HTML written per the new brief, the exported file is byte-equivalent to the source. For older decks that still reference `deck.css`/`deck.js`, the download is no longer self-contained. | Built-in templates are already single-file. Workspace decks re-generate via agent after the version bump. |
| `scripts/export/compile-deck.js` CLI | Deleted. | Remove the `node ...compile-deck.js` bash example at L552 of `template.ts`. |
| `bundleHtml`, `inlineFonts`, `inlineImages`, `inlineBundleAssets` callers | Only caller is `bundle.cjs`. All callers removed in the same commit. | Grep verifies zero external callers before delete. |
| Build output (`dist/`) | Auto-regenerates from `src/` on `pnpm build`. | Run `pnpm build` after edits. |
| Box-layout CJS files | Not touched in Part A or Part B. | No propagation needed. |
| Agent variance | Without a canonical engine, decks look different across sessions. | Part of the goal — not a regression. Quality bar held by the 13 design rules + box-validator + per-slide verification in the brief. |
| Animation bugs | Agent could write broken navigation JS. | Illustrative snippet in the brief gives a working baseline; smoke test in A7 catches regressions. |
| Font portability | Exported HTML depends on network for Google Fonts. Offline opening falls back to system stack. | Choice 1 — accepted trade-off. The creative brief can optionally instruct the agent to inline fonts if the user explicitly requests offline portability. |

---

## 5. Part A — Migration Steps

### A1. Create the creative brief

**New file**: `src/templates/skills/content-factory/references/slide-deck-engine.md`

Structure: sections (a)–(g) from section 2.3 above. Keep the file under ~250 lines; it is a brief, not a reference manual.

### A2. Update `template.ts`

**File**: `src/templates/skills/content-factory/template.ts`

1. Remove Asset Map rows L46-48 (slides-base.html/css/js) and L51 (compile-deck.js).
2. Add Asset Map row for the new brief:
   ```
   | ${CLAUDE_SKILL_DIR}[[/references/slide-deck-engine.md]] | Slide decks | Structural contract + motion principles + brand alignment for single-file animated decks |
   ```
3. Rewrite deck generation section L520-553:
   - Header: *"Slide deck generation — single-file authoring (MANDATORY)"*.
   - Body: generate ONE self-contained HTML file. Read `references/slide-deck-engine.md` for the contract and principles. Read `references/design-system.md` for the quality rules. Read `brand/tokens.*` for colors and fonts. Author the CSS and JS inline. Do not create sibling `.css` / `.js` files. Do not link to sibling files. Google Fonts via `<link>` is allowed; all other external references are forbidden.
   - Preserve the slide-type table (L536-548) and the narrative arc guidance (L532) — content guidance, orthogonal to the engine.
   - Remove the `node ...compile-deck.js` bash example (L552). Standalone export is now just downloading the file via `/api/export-html-bundle` or opening it directly.
4. Bump `version:` in the template frontmatter.

### A3. Rewrite `bundle.cjs`

**File**: `src/templates/skills/content-factory/scripts/lib/bundle.cjs`

New shape (~95 lines total):

1. Rewrite the top doc comment (~15 lines): "Stream the active source file as an attachment. The agent produces self-contained HTML; this handler does not transform it."
2. Remove the requires for `./export/lib/bundle-html.js` and `./export/lib/inline-assets.js`.
3. **Delete** `fileToDataUri`, `ASSET_URL_PATTERNS`, `resolveBrandAsset`, `resolveVendorAsset`, `resolveStaticAsset`, `resolveAssetUrl`, `inlineBundleAssets` (L44-102).
4. **Delete** the legacy block L104-212: `isSlideDeck`, `hasCanonicalDeckEngine`, `readCanonicalFile`, `injectChromeElements`, `DECK_SPECIFICITY_BOOSTER`, `injectCanonicalDeckEngine`.
5. **Keep** `resolveActiveSource(ctx)` (L214-245) and `resolveSourceFromPayload(payload, ctx)` (L247-281) — these still resolve template / session / content / brand sources.
6. **Rewrite** `handleExportHtmlBundle` (L285-337) to:
   - Parse body (if any).
   - Resolve source via `resolveSourceFromPayload` or fallback to `resolveActiveSource`.
   - 400 if no source; 404 if file does not exist.
   - Write the response headers: `Content-Type: text/html; charset=utf-8`, `Content-Disposition: attachment; filename="<baseName>.html"`, `Cache-Control: no-store`.
   - Stream the file via `fs.createReadStream(filePath).pipe(res)`.
   - Handle stream errors with a 500.
7. Confirm `module.exports` still only exports `handleExportHtmlBundle`.

### A4. Delete files

```bash
rm src/templates/skills/content-factory/generators/slides-base.html
rm src/templates/skills/content-factory/generators/slides-base.css
rm src/templates/skills/content-factory/generators/slides-base.js
rm src/templates/skills/content-factory/scripts/export/compile-deck.js
rm src/templates/skills/content-factory/scripts/export/lib/bundle-html.js
rm src/templates/skills/content-factory/scripts/export/lib/inline-assets.js
rmdir src/templates/skills/content-factory/scripts/export/lib
rmdir src/templates/skills/content-factory/scripts/export
```

### A5. Verify no orphan references

```bash
grep -rn "slides-base\|compile-deck\|bundleHtml\|bundle-html\|inline-assets\|inlineFonts\|inlineImages\|inlineBundleAssets\|injectCanonicalDeckEngine" src/ | grep -v node_modules
# Expect: zero hits
```

### A6. Build + verify dist

```bash
pnpm build
# Expect the deleted files to be gone from dist/templates/skills/content-factory/...
# Expect references/slide-deck-engine.md to appear in dist
```

### A7. Manual smoke

In a Codi-installed test project:

1. Start the content-factory server.
2. Load `codi-slides-pitch.html` in Gallery. Verify preview animates + navigates.
3. Click "Export → HTML · all". Verify:
   - The download is a single `.html` file.
   - `diff <downloaded-file> <source-template>` shows only the expected differences (basically zero — the handler is byte-for-byte).
4. Open the downloaded file directly in a browser (online). Verify deck renders with Outfit + Geist Mono.
5. Open offline (airplane mode). Verify deck still animates + navigates; fonts degrade to system fallback (expected per Choice 1).
6. Ask an agent (with the updated skill installed) to "create a 4-slide pitch deck on topic X". Verify:
   - Output is one `.html` file. No sibling `deck.css` / `deck.js` / any CSS/JS files.
   - `grep -E '<link|<script src|/api/brand|/vendor|/static' <output-file>` → at most a single Google Fonts `<link>` line.
   - Slides animate on entry.
   - Arrow keys navigate.
   - Progress indicator + slide counter update.
   - `prefers-reduced-motion` simulation disables transitions.
   - Brand tokens applied.
7. Export PNG of a single slide. Verify it renders correctly (Playwright path, should be unaffected).
8. Export PDF of the deck. Verify (Playwright path, should be unaffected).
9. Export PPTX. Verify (Playwright path, should be unaffected).

### A8. Audit docs for stale references

```bash
grep -rn "slides-base\|compile-deck" docs/ README.md
```

Historical hits in `docs/20260413_*` SPEC/REPORT files are acceptable as archive. If any currently-referenced doc contradicts the new single-file pattern, add a banner note: *"Superseded — see `docs/20260416_173000_[PLAN]_slide-deck-single-file-migration.md`."*

### A9. Commit

One atomic commit at end of session:

```
refactor(content-factory): ultra-clean single-file deck authoring

- Delete slides-base.{html,css,js}, compile-deck.js, bundle-html.js, inline-assets.js
- Trim bundle.cjs to source resolution + file streaming (no transformation)
- Add references/slide-deck-engine.md (creative brief: contract + motion principles + brand alignment)
- Rewrite template.ts slide-deck section for single-file authoring
- Bump content-factory template version
```

---

## 6. Part B — 12 Template Grid Pattern Refactor

Follows Part 3 of `20260416_165258_[PLAN]_hybrid-box-layout-model.md`. Independent of Part A.

### B1. Template order

1. `minimal-mono.html` (simplest, reference baseline)
2. `minimal-carousel.html` (already tested in current session)
3. `dark-editorial.html`
4. `earthy-bold.html`
5. `clean-slides.html`
6. `doc-article.html`
7. `glass-card.html`
8. `navy-waves.html`
9. `poster-bold.html`
10. `purple-split.html`
11. `split-photo.html`
12. `terminal-green.html`

### B2. Per-template checklist

- [ ] Replace `<br>` with block `<span>` in headlines.
- [ ] Replace `justify-content: space-between` with flex children that own their spacing.
- [ ] Replace absolute-positioned decorative elements with CSS properties (`box-shadow`, `border`, gradients).
- [ ] Set `padding = gap` on all flex containers.
- [ ] Wrap all text in leaf elements (no bare text in flex containers).
- [ ] Run box-validator; confirm score ≥ 0.80.
  ```bash
  node ~/.claude/skills/codi-box-validator/scripts/validate.mjs \
    --input <template.html> --width 1280 --height 720 --threshold 0.80
  ```
- [ ] Visual diff: open in content-factory Gallery; confirm no regression.

### B3. Validation pass

Batch validation via `/api/validate-cards`; every card ≥ 0.80.

### B4. Commit

```
refactor(content-factory): apply structural grid pattern to 12 built-in templates
```

---

## 7. Part C — Box-Layout CJS Propagation Gap

### C1. Known limitation

`codi generate` does not copy edits from `src/templates/skills/content-factory/scripts/lib/box-layout/*.cjs` into the installed `.claude/skills/codi-content-factory/scripts/lib/box-layout/*.cjs`. Manual sync required after any `.cjs` edit in that directory.

### C2. In-scope workaround

Neither Part A nor Part B touches the box-layout `.cjs` files — no manual sync needed for this plan.

### C3. Follow-up (separate plan doc)

1. Trace the build script responsible for copying skill assets.
2. Ensure `scripts/lib/box-layout/**/*.cjs` is included in the copy glob.
3. Add a verification test: edit a `.cjs` file, run `codi generate`, assert the installed copy matches.

---

## 8. Ordered Execution

Part A lands first; Parts B and C are independent.

1. **Part A** (A1 – A9; one commit). No tests to update.
2. **Part B** (one commit per template or one bundled commit). Validator-gated.
3. **Part C** (docs only; no code changes in this plan).

### Pause points for approval

- **After A1** (creative brief drafted) — review the brief before it becomes the canonical instruction source.
- **After A2-A5** (edits + deletes, before `pnpm build`) — review the diff.
- **After A6-A7** (build + smoke) — review the generated single-file deck before committing.
- **After B1** (first template refactored) — confirm the pattern before rolling across the other 11.

---

## 9. Success Criteria

### Part A

- `ls src/templates/skills/content-factory/generators/` shows no `slides-base.*`.
- `ls src/templates/skills/content-factory/scripts/` does not contain an `export/` directory.
- `grep -rn slides-base src/` returns zero hits.
- `grep -rn bundleHtml src/ | grep -v node_modules` returns zero hits.
- `src/templates/skills/content-factory/references/slide-deck-engine.md` exists.
- `src/templates/skills/content-factory/scripts/lib/bundle.cjs` is ≤ 100 lines and contains no references to `bundleHtml`, `inlineFonts`, `inlineImages`, `injectCanonicalDeckEngine`.
- `pnpm build` succeeds.
- `POST /api/export-html-bundle` on `codi-slides-pitch.html` returns the source file byte-for-byte.
- Agent-generated deck from the new instructions:
  - Single `.html` file, no sibling CSS/JS.
  - No server-relative URLs (`/api/brand`, `/vendor`, `/static`).
  - At most one `<link>` to Google Fonts; otherwise no external references.
  - Animates on entry, responds to arrow keys, progress + counter update.
  - Respects `prefers-reduced-motion`.
  - Applies brand tokens.
  - Passes a spot-check of the 13 design-system rules.
- PNG / PDF / PPTX export paths unchanged and verified working on a generated deck.

### Part B

- All 12 templates pass box-validator at ≥ 0.80.
- No visual regression on Gallery cards.
- R2/R10 do not oscillate on any template.

### Part C

- Follow-up plan doc created for the build-pipeline fix.

---

## 10. Risks and Rollback

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Legacy workspace decks lose engine auto-injection | Low | Built-ins already inline; workspace decks re-generated via agent. |
| Agent drift — still writes `deck.css` / `deck.js` | Medium | Bump `version:`; explicit "single file only, no sibling CSS/JS" guardrail in rewritten L520-553 and in the creative brief's anti-patterns section. |
| Animation inconsistency across decks | Medium | Expected. Quality floor held by 13 design rules + validator + illustrative snippets. |
| Agent writes broken navigation JS | Low | Illustrative snippet gives a working baseline; smoke test catches regressions. |
| `pnpm build` regression | Low | Build has no coupling to `slides-base.*` or `scripts/export/` beyond the copy glob. |
| Grid refactor breaks a preset visually (Part B) | Medium | Per-template validation + visual diff before moving on. |
| Orphan callers of deleted pipeline functions | Low | A5 grep gate; nothing outside `bundle.cjs` imports them. |

**Rollback**: `git revert <commit>` per part. Part A is one commit; Part B can be per-template if needed.

---

## 11. Out of Scope

- Fixing `codi generate` build-pipeline gap for `scripts/lib/box-layout/*.cjs` (Part C follow-up).
- Migrating existing workspace `.codi_output/*/content/deck.html` files.
- `codi-brand` skill changes (no references to deleted files).
- `app.html` / `app.js` / `app.css` changes (content-factory app UI unrelated).
- Changes to the `design-system.md` 13 rules.
- Font-inlining for offline portability (Choice 1 accepts network dependency for Google Fonts).
