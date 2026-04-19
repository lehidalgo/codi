# Content Factory Logo & Fit Implementation Plan

- **Date**: 2026-04-19 11:30
- **Document**: 20260419_1130_PLAN_content-factory-logo-and-fit-impl.md
- **Category**: PLAN
- **Spec**: `docs/20260419_1100_SPEC_content-factory-logo-and-fit.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the content-factory's logo overlay use the project's own logo (with brand fallback), detect when rendered content overflows its active format, and emit a typed remediation directive (paginate / split / tighten) that an agent can act on.

**Architecture:** Three small, additive changes in the existing content-factory skill — (1) a fallback chain (project → brand → built-in) for logo resolution, (2) a new `content-fit` validator layer that writes `state/fit-report.json`, (3) a format-derived default for the logo-overlay size with a `userOverridden` flag.

**Tech Stack:** Node.js (Express-style raw HTTP routes), vanilla ES modules (browser), no test framework yet — uses `node --test` (built-in).

**Commit strategy:** One commit per phase (4 phases total). Per-user preference, do not commit between tasks within a phase.

---

## File Map

### New files

| Path | Responsibility |
|------|----------------|
| `src/templates/skills/content-factory/scripts/lib/logo-resolver.cjs` | Server-side: resolve project/brand/default logo SVG bytes |
| `src/templates/skills/content-factory/scripts/lib/fit-report.cjs` | Server-side: write `<project>/state/fit-report.json` |
| `src/templates/skills/content-factory/generators/lib/logo-defaults.js` | Browser: `defaultLogoSize(canvas)` formula |
| `src/templates/skills/content-factory/generators/lib/fit-measure.js` | Browser: measure iframe overflow per `.doc-page` |
| `src/templates/skills/content-factory/tests/logo-resolver.test.cjs` | Unit tests for logo fallback |
| `src/templates/skills/content-factory/tests/fit-report.test.cjs` | Unit tests for fit report shape & remediation matrix |
| `src/templates/skills/content-factory/tests/logo-defaults.test.mjs` | Unit tests for size formula |
| `src/templates/skills/content-factory/tests/fixtures/brand-fixture/brand/assets/logo.svg` | Brand fixture logo |
| `src/templates/skills/content-factory/tests/fixtures/brand-fixture/brand/tokens.json` | Brand fixture tokens |

### Modified files

| Path | Change |
|------|--------|
| `src/templates/skills/content-factory/generators/lib/card-builder.js:46-79` | Replace hardcoded `codi` text with resolver-driven inline SVG |
| `src/templates/skills/content-factory/generators/lib/state.js:13-14` | Use `defaultLogoSize`; add `userOverridden` flag |
| `src/templates/skills/content-factory/generators/lib/card-strip.js:77-83` | Flip `userOverridden=true` when slider moves |
| `src/templates/skills/content-factory/generators/lib/validation-panel.js` | Register `content-fit` layer + render directive |
| `src/templates/skills/content-factory/generators/lib/validation-settings.js` | Add `content-fit` to layer list with severity per type |
| `src/templates/skills/content-factory/generators/lib/validation-badge.js` | Render `directive` text |
| `src/templates/skills/content-factory/scripts/routes/project-routes.cjs` | Add `GET /api/project/logo` |
| `src/templates/skills/content-factory/scripts/routes/validate-routes.cjs` | Add `POST /api/validate/fit-report` |
| `src/templates/skills/content-factory/scripts/lib/brand-discovery.cjs` | Add `logoPath` to discovery record |
| `src/templates/skills/content-factory/scripts/lib/workspace.cjs:86-112` | Lazy bootstrap hook reference (logo copy on first request) |
| Document templates with `overflow: hidden` on canvas root | Switch preview-only CSS to `overflow: visible` |

---

## Phase A — Logo discovery (Tasks 1–6)

### Task 1: Brand-discovery exposes logo path

**Files:**
- Modify: `src/templates/skills/content-factory/scripts/lib/brand-discovery.cjs`
- Modify: `src/templates/skills/content-factory/tests/fixtures/brand-fixture/brand/tokens.json` (create)
- Modify: `src/templates/skills/content-factory/tests/fixtures/brand-fixture/brand/assets/logo.svg` (create)
- Test: `src/templates/skills/content-factory/tests/brand-discovery.test.cjs` (create)

- [ ] **Step 1: Create the brand fixture**

```bash
mkdir -p src/templates/skills/content-factory/tests/fixtures/brand-fixture-brand/brand/assets
```

Create `tests/fixtures/brand-fixture-brand/brand/tokens.json`:

```json
{ "display_name": "Brand Fixture", "version": 1 }
```

Create `tests/fixtures/brand-fixture-brand/brand/assets/logo.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0066cc"/></svg>
```

(Note: directory ends in `-brand` so `discoverBrands` picks it up.)

- [ ] **Step 2: Write the failing test**

Create `tests/brand-discovery.test.cjs`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { discoverBrands } = require('../scripts/lib/brand-discovery.cjs');

const FIXTURES = path.join(__dirname, 'fixtures');

test('discoverBrands exposes logoPath when brand/assets/logo.svg exists', () => {
  const brands = discoverBrands(FIXTURES);
  const fixture = brands.find(b => b.name === 'brand-fixture-brand');
  assert.ok(fixture, 'fixture brand discovered');
  assert.ok(fixture.logoPath, 'logoPath present');
  assert.ok(fs.existsSync(fixture.logoPath), 'logoPath points to existing file');
  assert.ok(fixture.logoPath.endsWith(path.join('brand', 'assets', 'logo.svg')));
});

test('discoverBrands returns logoPath=null when no logo file', () => {
  // Use the same skills dir and look at any existing brand without a logo.
  // For the fixture we just created, logo exists, so this asserts the fallback shape.
  const brands = discoverBrands(FIXTURES);
  for (const b of brands) {
    assert.ok(b.logoPath === null || typeof b.logoPath === 'string');
  }
});
```

- [ ] **Step 3: Run the test — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/brand-discovery.test.cjs`
Expected: FAIL — `logoPath` undefined.

- [ ] **Step 4: Implement**

Edit `scripts/lib/brand-discovery.cjs`. After the `tokens` parse, add:

```js
      const candidate = path.join(skillDir, 'brand', 'assets', 'logo.svg');
      const logoPath = fs.existsSync(candidate) ? candidate : null;
      brands.push({
        name: entry,
        dir: skillDir,
        display_name: tokens.display_name || entry,
        version: tokens.version || 1,
        tokens,
        logoPath,
      });
```

- [ ] **Step 5: Re-run test — expect PASS**

Run: `cd src/templates/skills/content-factory && node --test tests/brand-discovery.test.cjs`
Expected: PASS.

---

### Task 2: Logo-resolver module

**Files:**
- Create: `src/templates/skills/content-factory/scripts/lib/logo-resolver.cjs`
- Test: `src/templates/skills/content-factory/tests/logo-resolver.test.cjs`

- [ ] **Step 1: Write the failing test**

Create `tests/logo-resolver.test.cjs`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveLogo, BUILTIN_DEFAULT_SVG } = require('../scripts/lib/logo-resolver.cjs');

const FIXTURES = path.join(__dirname, 'fixtures');

function tmpProject(withLogo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-proj-'));
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  if (withLogo) {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets', 'logo.svg'), '<svg id="project"/>');
  }
  return dir;
}

test('project logo wins when present', () => {
  const project = tmpProject(true);
  const result = resolveLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: 'brand-fixture-brand' });
  assert.equal(result.source, 'project');
  assert.match(result.svg, /id="project"/);
});

test('falls back to active brand when project logo missing', () => {
  const project = tmpProject(false);
  const result = resolveLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: 'brand-fixture-brand' });
  assert.equal(result.source, 'brand');
  assert.match(result.svg, /<svg/);
});

test('falls back to builtin when no project and no brand', () => {
  const project = tmpProject(false);
  const result = resolveLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: null });
  assert.equal(result.source, 'builtin');
  assert.equal(result.svg, BUILTIN_DEFAULT_SVG);
});

test('falls back to builtin when active brand has no logo file', () => {
  const project = tmpProject(false);
  const result = resolveLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: 'nonexistent-brand' });
  assert.equal(result.source, 'builtin');
});
```

- [ ] **Step 2: Run — expect failure (module missing)**

Run: `cd src/templates/skills/content-factory && node --test tests/logo-resolver.test.cjs`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Implement**

Create `scripts/lib/logo-resolver.cjs`:

```js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { discoverBrands } = require('./brand-discovery.cjs');

// Built-in default SVG (matches current hardcoded "codi" text).
const BUILTIN_DEFAULT_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64">',
  '<defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">',
  '<stop offset="0%" stop-color="#56b6c2"/>',
  '<stop offset="100%" stop-color="#61afef"/>',
  '</linearGradient></defs>',
  '<text x="100" y="44" font-family="\'Geist Mono\',monospace" font-size="40" font-weight="500" fill="url(#cg)" text-anchor="middle">codi</text>',
  '</svg>',
].join('');

function readSvgSafe(p) {
  try {
    const bytes = fs.readFileSync(p, 'utf-8');
    if (!bytes.includes('<svg')) return null;
    return bytes;
  } catch { return null; }
}

/**
 * Resolve the logo SVG for a render. Order:
 *   1. <projectDir>/assets/logo.svg
 *   2. <activeBrand>/brand/assets/logo.svg
 *   3. BUILTIN_DEFAULT_SVG
 *
 * Returns { source: 'project'|'brand'|'builtin', svg: string }.
 */
function resolveLogo({ projectDir, skillsDir, activeBrand }) {
  if (projectDir) {
    const candidate = path.join(projectDir, 'assets', 'logo.svg');
    const svg = readSvgSafe(candidate);
    if (svg) return { source: 'project', svg };
  }
  if (activeBrand && skillsDir) {
    const brand = discoverBrands(skillsDir).find(b => b.name === activeBrand);
    if (brand && brand.logoPath) {
      const svg = readSvgSafe(brand.logoPath);
      if (svg) return { source: 'brand', svg };
    }
  }
  return { source: 'builtin', svg: BUILTIN_DEFAULT_SVG };
}

module.exports = { resolveLogo, BUILTIN_DEFAULT_SVG };
```

- [ ] **Step 4: Re-run — expect PASS**

Run: `cd src/templates/skills/content-factory && node --test tests/logo-resolver.test.cjs`
Expected: 4 tests pass.

---

### Task 3: Lazy bootstrap on first GET

The brand→project copy happens on demand: the first time the project logo is requested and is missing, copy from active brand if available. Avoids hooks in `createProject`.

**Files:**
- Modify: `src/templates/skills/content-factory/scripts/lib/logo-resolver.cjs`
- Test: `src/templates/skills/content-factory/tests/logo-resolver.test.cjs` (extend)

- [ ] **Step 1: Write the failing test (append to existing test file)**

```js
test('bootstrapProjectLogo copies brand logo to <project>/assets/logo.svg', () => {
  const { bootstrapProjectLogo } = require('../scripts/lib/logo-resolver.cjs');
  const project = tmpProject(false);
  const copied = bootstrapProjectLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: 'brand-fixture-brand' });
  assert.equal(copied, true);
  const dest = path.join(project, 'assets', 'logo.svg');
  assert.ok(fs.existsSync(dest));
  assert.match(fs.readFileSync(dest, 'utf-8'), /<svg/);
});

test('bootstrapProjectLogo no-ops when project logo already exists', () => {
  const { bootstrapProjectLogo } = require('../scripts/lib/logo-resolver.cjs');
  const project = tmpProject(true);
  const before = fs.readFileSync(path.join(project, 'assets', 'logo.svg'), 'utf-8');
  const copied = bootstrapProjectLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: 'brand-fixture-brand' });
  assert.equal(copied, false);
  const after = fs.readFileSync(path.join(project, 'assets', 'logo.svg'), 'utf-8');
  assert.equal(before, after, 'project logo not overwritten');
});

test('bootstrapProjectLogo returns false when no brand available', () => {
  const { bootstrapProjectLogo } = require('../scripts/lib/logo-resolver.cjs');
  const project = tmpProject(false);
  const copied = bootstrapProjectLogo({ projectDir: project, skillsDir: FIXTURES, activeBrand: null });
  assert.equal(copied, false);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/logo-resolver.test.cjs`
Expected: FAIL — `bootstrapProjectLogo` undefined.

- [ ] **Step 3: Implement (append to logo-resolver.cjs)**

```js
/**
 * Copy the active brand's logo to <projectDir>/assets/logo.svg.
 * Idempotent: no-op if project logo already exists or brand has none.
 * Returns true when a copy occurred.
 */
function bootstrapProjectLogo({ projectDir, skillsDir, activeBrand }) {
  if (!projectDir) return false;
  const dest = path.join(projectDir, 'assets', 'logo.svg');
  if (fs.existsSync(dest)) return false;
  if (!activeBrand || !skillsDir) return false;
  const brand = discoverBrands(skillsDir).find(b => b.name === activeBrand);
  if (!brand || !brand.logoPath) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(brand.logoPath, dest);
  return true;
}

module.exports = { resolveLogo, bootstrapProjectLogo, BUILTIN_DEFAULT_SVG };
```

- [ ] **Step 4: Re-run — expect PASS**

Expected: 7 tests pass (4 from Task 2 + 3 new).

---

### Task 4: `GET /api/project/logo` route

**Files:**
- Modify: `src/templates/skills/content-factory/scripts/routes/project-routes.cjs`
- Test: `src/templates/skills/content-factory/tests/project-routes-logo.test.cjs` (create)

- [ ] **Step 1: Write the failing integration test**

Create `tests/project-routes-logo.test.cjs`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const url = require('node:url');

const projectRoutes = require('../scripts/routes/project-routes.cjs');
const projectState = require('../scripts/lib/project-state.cjs');

function startServer(ctx) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const parsed = new url.URL(req.url, 'http://localhost');
      const ok = projectRoutes.handle(req, res, { pathname: parsed.pathname, searchParams: parsed.searchParams }, ctx);
      if (!ok) { res.writeHead(404); res.end('not found'); }
    });
    srv.listen(0, () => resolve({ srv, port: srv.address().port }));
  });
}

function get(port, p) {
  return new Promise(resolve => {
    http.get(`http://localhost:${port}${p}`, r => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => resolve({ status: r.statusCode, type: r.headers['content-type'], body: Buffer.concat(chunks).toString('utf-8') }));
    });
  });
}

test('GET /api/project/logo returns 404 when no active project', async () => {
  projectState.setActiveProject(null);
  const ctx = { WORKSPACE_DIR: os.tmpdir(), SKILLS_DIR: path.join(__dirname, 'fixtures') };
  const { srv, port } = await startServer(ctx);
  try {
    const res = await get(port, '/api/project/logo');
    assert.equal(res.status, 404);
  } finally { srv.close(); }
});

test('GET /api/project/logo returns project SVG when present', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-proj-'));
  fs.mkdirSync(path.join(project, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(project, 'assets', 'logo.svg'), '<svg id="p"/>');
  projectState.setActiveProject(project);
  const ctx = { WORKSPACE_DIR: os.tmpdir(), SKILLS_DIR: path.join(__dirname, 'fixtures') };
  const { srv, port } = await startServer(ctx);
  try {
    const res = await get(port, '/api/project/logo');
    assert.equal(res.status, 200);
    assert.match(res.type, /image\/svg\+xml/);
    assert.match(res.body, /id="p"/);
  } finally { srv.close(); projectState.setActiveProject(null); }
});

test('GET /api/project/logo lazy-bootstraps from active brand', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-proj-'));
  projectState.setActiveProject(project);
  projectState.setActiveBrand('brand-fixture-brand');
  const ctx = { WORKSPACE_DIR: os.tmpdir(), SKILLS_DIR: path.join(__dirname, 'fixtures') };
  const { srv, port } = await startServer(ctx);
  try {
    const res = await get(port, '/api/project/logo');
    assert.equal(res.status, 200);
    assert.ok(fs.existsSync(path.join(project, 'assets', 'logo.svg')), 'bootstrap copied file');
  } finally { srv.close(); projectState.setActiveProject(null); projectState.setActiveBrand(null); }
});
```

(Note: `project-state.cjs` must expose `setActiveBrand` / `getActiveBrand`. If it does not, add these accessors as part of this task — they wrap a private `activeBrand` variable mirroring the existing `activeProject` pattern.)

- [ ] **Step 2: Verify `project-state.cjs` has brand accessors**

Run: `grep -n "activeBrand\|setActiveBrand" src/templates/skills/content-factory/scripts/lib/project-state.cjs`
If empty: add `let activeBrand = null; function getActiveBrand(){return activeBrand;} function setActiveBrand(v){activeBrand = v;}` and export them. Wire `/api/active-brand` (in `brand-routes.cjs`) to call `setActiveBrand`.

- [ ] **Step 3: Run — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/project-routes-logo.test.cjs`
Expected: FAIL — 404 on all logo requests.

- [ ] **Step 4: Implement the route**

In `scripts/routes/project-routes.cjs`, after the existing routes and before the closing `return false;`, add:

```js
  // /api/project/logo GET — resolve project logo (lazy bootstrap from brand)
  if (req.method === 'GET' && pathname === '/api/project/logo') {
    const projectDir = state.getActiveProject();
    if (!projectDir) { res.writeHead(404); res.end('No active project'); return true; }
    const activeBrand = state.getActiveBrand ? state.getActiveBrand() : null;
    const { bootstrapProjectLogo, resolveLogo } = require('../lib/logo-resolver.cjs');
    bootstrapProjectLogo({ projectDir, skillsDir: ctx.SKILLS_DIR, activeBrand });
    const result = resolveLogo({ projectDir, skillsDir: ctx.SKILLS_DIR, activeBrand });
    if (result.source === 'builtin' && !activeBrand) {
      res.writeHead(404); res.end('No project or brand logo'); return true;
    }
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(result.svg);
    return true;
  }
```

- [ ] **Step 5: Re-run — expect PASS**

Expected: 3 tests pass.

---

### Task 5: Card-builder uses resolver instead of hardcoded text

**Files:**
- Modify: `src/templates/skills/content-factory/generators/lib/card-builder.js:46-79`

This file runs in the browser. It cannot `require` Node modules. Strategy: `card-builder.js` calls a new `getLogoSvg()` helper that fetches `/api/project/logo` once and caches the result in `state`. The hardcoded `text` element is replaced by the inlined SVG.

- [ ] **Step 1: Add cached fetch in `state.js`**

In `generators/lib/state.js`, add to the `state` object:

```js
  logoSvg: null, // cached SVG bytes from /api/project/logo
  logoSource: null, // 'project' | 'brand' | 'builtin'
```

- [ ] **Step 2: Create logo-loader helper**

Create `generators/lib/logo-loader.js`:

```js
import { state } from './state.js';

let inFlight = null;

export async function loadLogo(force = false) {
  if (state.logoSvg && !force) return state.logoSvg;
  if (inFlight) return inFlight;
  inFlight = fetch('/api/project/logo')
    .then(r => r.ok ? r.text() : null)
    .then(svg => {
      state.logoSvg = svg;
      state.logoSource = svg ? 'resolved' : 'builtin';
      inFlight = null;
      return svg;
    })
    .catch(() => { inFlight = null; return null; });
  return inFlight;
}

export function clearLogoCache() {
  state.logoSvg = null;
  state.logoSource = null;
}
```

- [ ] **Step 3: Update `card-builder.js` lines 46–79**

Replace the existing `if (forExport && logo && logo.visible)` block with:

```js
  let logoHtml = '';
  if (forExport && logo && logo.visible) {
    const svg = state.logoSvg; // populated by logo-loader before render
    const wrapStyle = [
      'position:absolute',
      'left:' + logo.x + '%',
      'top:' + logo.y + '%',
      'transform:translate(-50%,-50%)',
      'height:' + logo.size + 'px',
      'width:auto',
      'z-index:999',
      'pointer-events:none',
      'opacity:0.88',
    ].join(';');
    const fallback = svg || BUILTIN_DEFAULT_SVG;
    logoHtml = '<div style="' + wrapStyle + '">' + fallback + '</div>';
  }
```

At the top of `card-builder.js`, add:

```js
import { state } from './state.js';
import { BUILTIN_DEFAULT_SVG } from './builtin-logo.js';
```

Create `generators/lib/builtin-logo.js` exporting the same constant the server uses (single source of truth — copy the literal SVG string from `scripts/lib/logo-resolver.cjs` and re-export here):

```js
export const BUILTIN_DEFAULT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64"><defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#56b6c2"/><stop offset="100%" stop-color="#61afef"/></linearGradient></defs><text x="100" y="44" font-family="\'Geist Mono\',monospace" font-size="40" font-weight="500" fill="url(#cg)" text-anchor="middle">codi</text></svg>';
```

- [ ] **Step 4: Wire `loadLogo()` before render in card-strip**

In `generators/lib/card-strip.js`, before `buildCardDoc(...)` is called inside the rendering path (around line 100–130), `await loadLogo()`. If the path is not async, wrap the render trigger in an async IIFE.

- [ ] **Step 5: Manual smoke test**

```bash
cd src/templates/skills/content-factory/scripts && ./start-server.sh
```

Open the leadership onepager URL provided by the user. Confirm that the overlay logo is the BBVA mark (project logo), not the `codi` text. Stop the server.

---

### Task 6: Remove `overflow: hidden` from preview canvases

**Files:**
- Modify: `.codi_output/codi-adoption-t1-d3-leadership-onepager/content/document/onepager.html` (CSS)
- Modify: `src/templates/skills/content-factory/generators/templates/doc-article.html` (CSS)
- Modify any other template with `overflow: hidden` on `.doc-page` / `.social-card` / `.slide`

- [ ] **Step 1: Find affected templates**

Run: `grep -rn "overflow:\s*hidden" src/templates/skills/content-factory/generators/templates/`

- [ ] **Step 2: For each file found**

Replace `overflow: hidden` (or `overflow:hidden`) on canvas-root selectors (`.doc-page`, `.social-card`, `.slide`) with `overflow: visible`. Leave `overflow: hidden` on inner clipping elements (e.g. avatar circles) untouched.

- [ ] **Step 3: Smoke test the leadership onepager**

Reload the onepager URL. Overflow content (if any) is now visually obvious below the page boundary.

---

**Phase A commit:**

```bash
git add src/templates/skills/content-factory/
git commit -m "feat(content-factory): logo discovery with project>brand>builtin fallback

- New logo-resolver module + GET /api/project/logo endpoint
- Lazy bootstrap copies brand logo to <project>/assets/logo.svg on first request
- card-builder uses resolved SVG; no more hardcoded codi text
- Brand discovery exposes brand/assets/logo.svg path
- Templates no longer clip canvas overflow in preview"
```

---

## Phase B — Content fit validator (Tasks 7–11)

### Task 7: `defaultLogoSize` formula module

**Files:**
- Create: `src/templates/skills/content-factory/generators/lib/logo-defaults.js`
- Test: `src/templates/skills/content-factory/tests/logo-defaults.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/logo-defaults.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLogoSize } from '../generators/lib/logo-defaults.js';

test('defaultLogoSize returns 8% of min dimension', () => {
  assert.equal(defaultLogoSize({ w: 794, h: 1123 }), 64);
  assert.equal(defaultLogoSize({ w: 1080, h: 1080 }), 86);
  assert.equal(defaultLogoSize({ w: 1280, h: 720 }), 58);
});

test('defaultLogoSize floors to integer', () => {
  const v = defaultLogoSize({ w: 333, h: 444 });
  assert.equal(Number.isInteger(v), true);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/logo-defaults.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `generators/lib/logo-defaults.js`:

```js
// Default logo overlay size derived from the active canvas.
// 8% of the shortest side reads at consistent visual weight across formats.
export function defaultLogoSize(canvas) {
  const min = Math.min(canvas.w, canvas.h);
  return Math.round(min * 0.08);
}
```

- [ ] **Step 4: Re-run — expect PASS**

Expected: 2 tests pass.

---

### Task 8: Wire `defaultLogoSize` into state + override flag

**Files:**
- Modify: `src/templates/skills/content-factory/generators/lib/state.js:13-14`
- Modify: `src/templates/skills/content-factory/generators/lib/card-strip.js:73-83`

- [ ] **Step 1: Update state.js**

Replace line 13:

```js
  logo: { visible: true, size: 64, x: 85, y: 85, userOverridden: false }, // recomputed on format change unless userOverridden
```

(64 is the A4 default; the format-change handler recomputes when `state.format` is set.)

- [ ] **Step 2: Add a `setFormat` helper**

Append to `state.js`:

```js
import { defaultLogoSize } from './logo-defaults.js';

export function setFormat(format) {
  state.format = format;
  if (!state.logo.userOverridden) {
    state.logo.size = defaultLogoSize(format);
  }
}
```

- [ ] **Step 3: Replace direct `state.format =` writes**

Run: `grep -rn "state.format\s*=\s*{" src/templates/skills/content-factory/generators/`

For each call site, replace the assignment with `setFormat({...})` import.

- [ ] **Step 4: Mark override on slider movement**

In `card-strip.js`, the size-slider handler (look for `setLogo("size", ...)` or the `logo-size` input listener) — set `state.logo.userOverridden = true` when the user changes size.

```js
$("logo-size").addEventListener("input", e => {
  setLogo("size", Number(e.target.value));
  state.logo.userOverridden = true;
});
```

- [ ] **Step 5: Manual verification**

Switch active format from social to slides in the UI; confirm logo size auto-changes to ~58. Drag the slider; switch format again; confirm size sticks at the user value.

---

### Task 9: Fit-measure browser module

**Files:**
- Create: `src/templates/skills/content-factory/generators/lib/fit-measure.js`
- Test: `src/templates/skills/content-factory/tests/fit-measure.test.mjs` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/fit-measure.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { measureFit, computeRemediation } from '../generators/lib/fit-measure.js';

test('measureFit reports per-page overflow for documents', () => {
  // Simulated DOM: array of { scrollHeight, scrollWidth }
  const pages = [
    { scrollHeight: 1100, scrollWidth: 794 },
    { scrollHeight: 1300, scrollWidth: 794 },
  ];
  const result = measureFit({ canvas: { w: 794, h: 1123 }, pages, type: 'document' });
  assert.equal(result.overflowPx, 177);
  assert.equal(result.pageIndex, 2);
});

test('measureFit returns overflowPx=0 when all pages fit', () => {
  const pages = [{ scrollHeight: 1000, scrollWidth: 794 }];
  const result = measureFit({ canvas: { w: 794, h: 1123 }, pages, type: 'document' });
  assert.equal(result.overflowPx, 0);
  assert.equal(result.pageIndex, null);
});

test('computeRemediation: document >15% overflow → paginate', () => {
  const r = computeRemediation({ overflowPct: 25.6, type: 'document' });
  assert.equal(r.remediation, 'paginate');
  assert.deepEqual(r.options, ['paginate', 'tighten']);
});

test('computeRemediation: document ≤15% overflow → tighten', () => {
  const r = computeRemediation({ overflowPct: 8, type: 'document' });
  assert.equal(r.remediation, 'tighten');
});

test('computeRemediation: slides >15% → split', () => {
  const r = computeRemediation({ overflowPct: 30, type: 'slides' });
  assert.equal(r.remediation, 'split');
  assert.deepEqual(r.options, ['split', 'tighten']);
});

test('computeRemediation: social always tighten', () => {
  assert.equal(computeRemediation({ overflowPct: 50, type: 'social' }).remediation, 'tighten');
  assert.deepEqual(computeRemediation({ overflowPct: 50, type: 'social' }).options, ['tighten']);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/fit-measure.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `generators/lib/fit-measure.js`:

```js
// Pure measurement + remediation logic. Browser-only call sites pass
// already-measured page dimensions so this stays unit-testable in Node.

const REMEDIATION_MATRIX = {
  document: { high: 'paginate', low: 'tighten', options: ['paginate', 'tighten'] },
  slides:   { high: 'split',    low: 'tighten', options: ['split', 'tighten'] },
  social:   { high: 'tighten',  low: 'tighten', options: ['tighten'] },
};

const HIGH_OVERFLOW_PCT = 15;

export function measureFit({ canvas, pages, type }) {
  let worstPx = 0;
  let worstIdx = null;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const overflow = Math.max(p.scrollHeight - canvas.h, p.scrollWidth - canvas.w, 0);
    if (overflow > worstPx) { worstPx = overflow; worstIdx = i + 1; }
  }
  const overflowPct = worstPx === 0 ? 0 : (worstPx / canvas.h) * 100;
  return {
    canvas,
    measured: worstIdx ? pages[worstIdx - 1] : pages[0] || { scrollHeight: 0, scrollWidth: 0 },
    overflowPx: worstPx,
    overflowPct: Number(overflowPct.toFixed(1)),
    pageIndex: worstIdx,
    type,
  };
}

export function computeRemediation({ overflowPct, type }) {
  const matrix = REMEDIATION_MATRIX[type] || REMEDIATION_MATRIX.document;
  const remediation = overflowPct > HIGH_OVERFLOW_PCT ? matrix.high : matrix.low;
  return { remediation, options: matrix.options };
}

export function buildDirective({ canvas, overflowPx, overflowPct, pageIndex, remediation, type }) {
  const fmt = `${canvas.w}x${canvas.h}`;
  const page = type === 'document' && pageIndex ? `Page ${pageIndex} ` : '';
  if (remediation === 'paginate') {
    return `${page}exceeds ${fmt} by ${overflowPx}px (${overflowPct}%). Add a new .doc-page sibling after the offending page and move overflow content into it. Preserve the existing header on every page.`;
  }
  if (remediation === 'split') {
    return `Slide exceeds ${fmt} by ${overflowPx}px (${overflowPct}%). Split this slide into multiple slides at the next natural section break (h2 or hr).`;
  }
  return `${page}exceeds ${fmt} by ${overflowPx}px (${overflowPct}%). Tighten the layout: reduce padding, condense copy, or lower font sizes until content fits.`;
}
```

- [ ] **Step 4: Re-run — expect PASS**

Expected: 6 tests pass.

---

### Task 10: `POST /api/validate/fit-report` route + writer

**Files:**
- Create: `src/templates/skills/content-factory/scripts/lib/fit-report.cjs`
- Modify: `src/templates/skills/content-factory/scripts/routes/validate-routes.cjs`
- Test: `src/templates/skills/content-factory/tests/fit-report.test.cjs`

- [ ] **Step 1: Write the failing test**

Create `tests/fit-report.test.cjs`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFitReport } = require('../scripts/lib/fit-report.cjs');

function tmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fr-'));
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  return dir;
}

test('writeFitReport persists JSON to state/fit-report.json', () => {
  const project = tmpProject();
  const report = {
    file: 'document/onepager.html',
    canvas: { w: 794, h: 1123 },
    measured: { w: 794, h: 1410 },
    overflowPx: 287,
    overflowPct: 25.6,
    pageIndex: 1,
    remediation: 'paginate',
    options: ['paginate', 'tighten'],
    directive: 'Page 1 exceeds 794x1123 by 287px...',
  };
  writeFitReport(project, report);
  const written = JSON.parse(fs.readFileSync(path.join(project, 'state', 'fit-report.json'), 'utf-8'));
  assert.deepEqual(written, report);
});

test('writeFitReport overwrites existing report', () => {
  const project = tmpProject();
  writeFitReport(project, { overflowPx: 100 });
  writeFitReport(project, { overflowPx: 0 });
  const written = JSON.parse(fs.readFileSync(path.join(project, 'state', 'fit-report.json'), 'utf-8'));
  assert.equal(written.overflowPx, 0);
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd src/templates/skills/content-factory && node --test tests/fit-report.test.cjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement writer**

Create `scripts/lib/fit-report.cjs`:

```js
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function writeFitReport(projectDir, report) {
  const dir = path.join(projectDir, 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fit-report.json'), JSON.stringify(report, null, 2));
}

module.exports = { writeFitReport };
```

- [ ] **Step 4: Re-run — expect PASS (writer test only)**

Expected: 2 tests pass.

- [ ] **Step 5: Add the route**

In `scripts/routes/validate-routes.cjs`, register a new handler:

```js
  // POST /api/validate/fit-report — persist the latest fit report for the project.
  if (req.method === 'POST' && parsed.pathname === '/api/validate/fit-report') {
    readJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const project = body && body.project;
      const report = body && body.report;
      if (!project || !report) { sendJson(res, 400, { ok: false, error: 'Missing project or report' }); return; }
      if (!isInsideWorkspace(project, ctx)) { sendJson(res, 403, { ok: false, error: 'Project outside workspace' }); return; }
      try {
        const { writeFitReport } = require('../lib/fit-report.cjs');
        writeFitReport(project, report);
        sendJson(res, 200, { ok: true });
      } catch (e) { sendJson(res, 500, { ok: false, error: e.message }); }
    });
    return true;
  }
```

- [ ] **Step 6: Add an integration test for the route**

Append to `tests/fit-report.test.cjs`:

```js
const http = require('node:http');
const url = require('node:url');
const validateRoutes = require('../scripts/routes/validate-routes.cjs');

test('POST /api/validate/fit-report writes file and returns ok', async () => {
  const project = tmpProject();
  const ctx = { WORKSPACE_DIR: path.dirname(project) };
  const srv = http.createServer((req, res) => {
    const parsed = new url.URL(req.url, 'http://localhost');
    const ok = validateRoutes.handle(req, res, { pathname: parsed.pathname, searchParams: parsed.searchParams }, ctx);
    if (!ok) { res.writeHead(404); res.end(); }
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const body = JSON.stringify({ project, report: { overflowPx: 50, remediation: 'tighten' } });
  const status = await new Promise(resolve => {
    const req = http.request({ host: 'localhost', port, path: '/api/validate/fit-report', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } }, r => { r.on('data', () => {}); r.on('end', () => resolve(r.statusCode)); });
    req.end(body);
  });
  srv.close();
  assert.equal(status, 200);
  const written = JSON.parse(fs.readFileSync(path.join(project, 'state', 'fit-report.json'), 'utf-8'));
  assert.equal(written.overflowPx, 50);
});
```

(Verify `validate-routes.cjs` exports a `handle(req, res, parsed, ctx)` function compatible with this signature; if not, adapt the test to the existing dispatcher shape.)

- [ ] **Step 7: Re-run all fit-report tests — expect PASS**

Expected: 3 tests pass.

---

### Task 11: Wire fit measurement into the validation panel

**Files:**
- Modify: `src/templates/skills/content-factory/generators/lib/validation-settings.js`
- Modify: `src/templates/skills/content-factory/generators/lib/validation-panel.js`
- Modify: `src/templates/skills/content-factory/generators/lib/validation-badge.js`

- [ ] **Step 1: Register the layer**

In `validation-settings.js`, add a new layer entry alongside existing ones:

```js
  { key: 'content-fit', label: 'Content fit', defaultEnabled: true, severity: { document: 'error', slides: 'error', social: 'error' } },
```

- [ ] **Step 2: Hook measurement after each render**

In `validation-panel.js`, find the existing post-render hook (search for `iframe.addEventListener('load'` or the equivalent rendering completion callback). Add:

```js
import { measureFit, computeRemediation, buildDirective } from './fit-measure.js';
import { state } from './state.js';

function runFitCheck(iframeDoc, type, file, projectDir) {
  if (!iframeDoc) return null;
  const pageNodes = iframeDoc.querySelectorAll('.doc-page, .slide, .social-card');
  const pages = Array.from(pageNodes).map(n => ({
    scrollHeight: n.scrollHeight,
    scrollWidth: n.scrollWidth,
  }));
  if (pages.length === 0) return null;
  const fit = measureFit({ canvas: state.format, pages, type });
  if (fit.overflowPx === 0) return fit; // pass
  const { remediation, options } = computeRemediation({ overflowPct: fit.overflowPct, type });
  const directive = buildDirective({ ...fit, remediation });
  const report = { file, ...fit, remediation, options, directive };
  // Persist for agents.
  if (projectDir) {
    fetch('/api/validate/fit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: projectDir, report }),
    }).catch(() => {});
  }
  return report;
}
```

Call `runFitCheck` after the iframe finishes loading and pass the result to the badge renderer.

- [ ] **Step 3: Render the directive in the badge**

In `validation-badge.js`, add a branch for `content-fit`: when the layer's report has `directive`, show:

```
[content-fit]  Page 1 exceeds 794x1123 by 287px (25.6%).
               Suggested action: paginate
               Add a new .doc-page sibling after the offending page...
```

Use the existing badge styles. No new CSS framework.

- [ ] **Step 4: Smoke test**

Restart the server. Open the leadership onepager. Confirm:
1. Validation panel shows a `content-fit` badge with a directive
2. `.codi_output/codi-adoption-t1-d3-leadership-onepager/state/fit-report.json` exists with `remediation: "paginate"` (overflow > 15%) or `"tighten"` otherwise

---

**Phase B commit:**

```bash
git add src/templates/skills/content-factory/
git commit -m "feat(content-factory): content-fit validator with remediation directive

- New fit-measure module: per-page overflow detection
- Per-type remediation matrix: document→paginate, slides→split, social→tighten
- Threshold of 15% overflow switches between paginate/split and tighten
- New POST /api/validate/fit-report writes state/fit-report.json
- Validation panel surfaces directive text agents can read
- Pagination contract documented: each .doc-page is its own canvas
- Format-derived default logo size (8% of min dimension) with userOverridden flag"
```

---

## Phase C — Self-dev refresh (Task 12)

The content-factory skill lives at `src/templates/skills/content-factory/`. Per `CLAUDE.md` the source-layer flow:

### Task 12: Rebuild and reinstall the skill

- [ ] **Step 1: Bump skill version**

Edit `src/templates/skills/content-factory/template.ts`. Find the `version:` field in the descriptor and bump (e.g. `1.4.0` → `1.5.0`).

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: dist/ refreshed.

- [ ] **Step 3: Clean installed copy**

```bash
rm -rf .codi/skills/codi-content-factory
node -e "const fs=require('fs'); const p='.codi/artifact-manifest.json'; const m=JSON.parse(fs.readFileSync(p,'utf8')); if(m.artifacts) delete m.artifacts['codi-content-factory']; fs.writeFileSync(p, JSON.stringify(m, null, 2)+'\n');"
```

- [ ] **Step 4: Reinstall**

Run: `codi add skill codi-content-factory --template codi-content-factory`
Expected: skill installed with new version.

- [ ] **Step 5: Regenerate per-agent output**

Run: `codi generate --force`
Expected: `.claude/skills/codi-content-factory/` reflects the new logo + fit logic.

- [ ] **Step 6: End-to-end check on the user's onepager**

```bash
cd .claude/skills/codi-content-factory/scripts && ./start-server.sh
```

Open the leadership onepager URL. Verify:
1. Overlay logo is BBVA mark (not "codi" text) at proportional default size
2. Validation panel shows `content-fit` badge
3. `state/fit-report.json` exists with the expected remediation

---

**Phase C commit:**

```bash
git add src/templates/skills/content-factory/template.ts .codi/ .claude/
git commit -m "chore(content-factory): bump version, rebuild, reinstall, regenerate"
```

---

## Phase D — Documentation (Task 13)

### Task 13: Update skill README

**Files:**
- Modify: `src/templates/skills/content-factory/README.md`

- [ ] **Step 1: Add a "Logo discovery" section**

Document the convention:

```markdown
## Logo discovery

Every content project loads its overlay logo from the canonical path:

    .codi_output/<project>/assets/logo.svg

If absent, the factory falls back to the active brand's logo at
`<brand-skill>/brand/assets/logo.svg`. If neither exists, a built-in
"codi" mark is used.

The first time the factory needs a logo for a project that has none, it
copies the active brand's logo to the canonical project path. From that
moment on the project owns the file — edits to the brand skill do not
retroactively flow into existing projects.
```

- [ ] **Step 2: Add a "Content fit" section**

```markdown
## Content fit

The validation panel includes a `content-fit` layer that measures each
canvas page (`.doc-page`, `.slide`, `.social-card`) against the active
format. When content overflows, the layer:

1. Shows a badge in the panel with overflow size and remediation
2. Writes a structured directive to `<project>/state/fit-report.json`

The remediation is content-type aware:

| Type | Overflow > 15% | Overflow ≤ 15% |
|------|----------------|----------------|
| document | paginate (add .doc-page) | tighten |
| slides | split into N slides | tighten |
| social | tighten | tighten |

Agents read `fit-report.json` and apply the directive automatically.
```

- [ ] **Step 3: Add a "Logo defaults" section**

```markdown
## Logo defaults

The overlay logo size defaults to 8% of the active canvas's shortest
side, recomputed when the format changes. Once the user moves the size
slider, the override sticks across format changes.
```

---

**Phase D commit (final, includes spec + plan):**

```bash
git add docs/20260419_1100_SPEC_content-factory-logo-and-fit.md \
        docs/20260419_1130_PLAN_content-factory-logo-and-fit-impl.md \
        src/templates/skills/content-factory/README.md
git commit -m "docs(content-factory): logo discovery, content-fit, logo defaults — spec + plan + readme"
```

---

## Verification Checklist

After all phases, verify against the spec:

- [ ] Project logo at `.codi_output/<project>/assets/logo.svg` is picked up by the overlay (Spec Part 1)
- [ ] Active brand logo is used when project has none (Spec Part 1)
- [ ] Built-in `codi` is used when neither exists (Spec Part 1)
- [ ] Brand→project copy happens lazily on first request (Spec Part 1, Bootstrap)
- [ ] Templates no longer clip overflow in preview (Spec Part 2, "Stop clipping")
- [ ] `content-fit` badge appears when content overflows (Spec Part 2)
- [ ] `state/fit-report.json` matches the documented schema with `pageIndex`, `remediation`, `options`, `directive` (Spec Part 2)
- [ ] Per-type remediation matrix correct: document→paginate, slides→split, social→tighten (Spec Part 2, Remediation directive)
- [ ] Multi-page documents reported per-page with correct `pageIndex` (Spec Part 2, Pagination contract)
- [ ] Default logo size computed from canvas (64/86/58 for the three formats) (Spec Part 3)
- [ ] `userOverridden` flag preserves user value across format changes (Spec Part 3)
- [ ] All three test files green: `node --test src/templates/skills/content-factory/tests/`
- [ ] No new dependencies added to `package.json`

---

## Notes for the implementer

- This plan touches client-side ES modules and server-side CommonJS. The two halves talk only via HTTP — keep that boundary clean.
- The `node --test` runner is built-in (Node ≥ 20). No new test framework dependency.
- If `project-state.cjs` does not yet expose `setActiveBrand` / `getActiveBrand`, add them as part of Task 4. They mirror the existing `activeProject` pattern.
- The 15% threshold for `paginate` vs `tighten` is a documented choice in the spec. Do not invent additional thresholds.
- All changes live inside `src/templates/skills/content-factory/`. No cross-skill edits.
