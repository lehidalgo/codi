# Skill Testing Framework Implementation Plan

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tiered test framework (contract + logic + behavior) for Codi code skills, starting with `content-factory`, integrated into `pnpm test`.

**Architecture:** Pure functions extracted from `app.js` to `generators/lib/` (importable by Node/Vitest). A generic Tier 1 contract validator discovers all `skill.test.json` files automatically. Tier 2 unit and integration tests run inside `npm test` via updated vitest globs. jsdom provides `DOMParser` for `lib/cards.js` tests.

**Tech Stack:** Vitest 4, jsdom (new dev dep), Node built-ins (`child_process`, `fs`, `os`), Zod (already installed), TypeScript.

> **Command convention**: All test commands in this plan use `pnpm test`. Do not mix with `npm test`.

---

### Task 1: Install jsdom dev dependency

**Files**: `package.json`, `package-lock.json`
**Est**: 2-5 minutes

**Steps**:
- [ ] 1. Install jsdom:
   ```bash
   npm install --save-dev jsdom @types/jsdom
   ```
- [ ] 2. Verify it appears in `package.json` devDependencies:
   ```bash
   grep '"jsdom"' package.json
   ```
   Expected: `"jsdom": "^..."` under `devDependencies`.
- [ ] 3. Commit:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore(deps): add jsdom dev dependency for skill unit tests"
   ```

**Verification**: `node -e "const { JSDOM } = require('jsdom'); console.log('ok')"` — expected: `ok`

---

### Task 2: Add `SkillTestManifestSchema` to `src/schemas/skill-test.ts`

**Files**: `src/schemas/skill-test.ts`, `src/schemas/index.ts`, `tests/unit/schemas/skill-test.test.ts`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create the test directory:
   ```bash
   mkdir -p tests/unit/schemas
   ```
- [ ] 2. Write failing test in `tests/unit/schemas/skill-test.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";
   import { SkillTestManifestSchema } from "#src/schemas/skill-test.js";

   describe("SkillTestManifestSchema", () => {
     it("accepts a minimal contract-only manifest", () => {
       const result = SkillTestManifestSchema.safeParse({
         skill: "content-factory",
         tiers: { contract: true },
       });
       expect(result.success).toBe(true);
     });

     it("accepts a full manifest with logic and behavior tiers", () => {
       const result = SkillTestManifestSchema.safeParse({
         skill: "content-factory",
         tiers: {
           contract: true,
           logic: { lib: "generators/lib/", tests: "tests/unit/" },
           behavior: {
             server: "scripts/server.cjs",
             startScript: "scripts/start-server.sh",
             tests: "tests/e2e/",
           },
         },
       });
       expect(result.success).toBe(true);
     });

     it("rejects a manifest with no skill name", () => {
       const result = SkillTestManifestSchema.safeParse({ tiers: { contract: true } });
       expect(result.success).toBe(false);
     });

     it("accepts behavior tier with optional port", () => {
       const result = SkillTestManifestSchema.safeParse({
         skill: "my-skill",
         tiers: {
           contract: true,
           behavior: {
             server: "server.cjs",
             startScript: "start.sh",
             tests: "tests/e2e/",
             port: 3000,
           },
         },
       });
       expect(result.success).toBe(true);
     });
   });
   ```
- [ ] 3. Verify test fails: `pnpm test tests/unit/schemas/skill-test.test.ts` — expected: "Cannot find module"
- [ ] 4. Create `src/schemas/skill-test.ts`:
   ```typescript
   import { z } from "zod";

   export const SkillTestManifestSchema = z.object({
     skill: z.string().min(1),
     tiers: z.object({
       contract: z.boolean().default(true),
       logic: z
         .object({
           lib: z.string(),
           tests: z.string(),
         })
         .optional(),
       behavior: z
         .object({
           server: z.string(),
           startScript: z.string(),
           tests: z.string(),
           // port is informational only — the server always binds to a random available port
           // via the start script and reports the actual URL in its stdout JSON.
           // Do not use this field to hard-code a port; use the resolved URL from startServer().
           port: z.number().optional(),
         })
         .optional(),
     }),
   });

   export type SkillTestManifest = z.infer<typeof SkillTestManifestSchema>;
   ```
- [ ] 5. Export from `src/schemas/index.ts` — add these two lines after the last export:
   ```typescript
   export { SkillTestManifestSchema } from "./skill-test.js";
   export type { SkillTestManifest } from "./skill-test.js";
   ```
- [ ] 6. Verify test passes: `pnpm test tests/unit/schemas/skill-test.test.ts` — expected: "4 passed"
- [ ] 7. Commit:
   ```bash
   git add src/schemas/skill-test.ts src/schemas/index.ts tests/unit/schemas/skill-test.test.ts
   git commit -m "feat(schemas): add SkillTestManifestSchema for code skill test manifests"
   ```

**Verification**: `pnpm test tests/unit/schemas/` — expected: all passing

---

### Task 3: Create `skill.test.json` for content-factory

**Files**: `src/templates/skills/content-factory/skill.test.json`
**Est**: 2 minutes

**Steps**:
- [ ] 1. Create `src/templates/skills/content-factory/skill.test.json`:
   ```json
   {
     "skill": "content-factory",
     "tiers": {
       "contract": true,
       "logic": {
         "lib": "generators/lib/",
         "tests": "tests/unit/"
       },
       "behavior": {
         "server": "scripts/server.cjs",
         "startScript": "scripts/start-server.sh",
         "tests": "tests/e2e/"
       }
     }
   }
   ```
- [ ] 2. Verify the manifest is valid JSON (schema is tested separately in Task 2):
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('src/templates/skills/content-factory/skill.test.json','utf-8')); console.log('valid JSON')"
   ```
   Expected: `valid JSON`
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/content-factory/skill.test.json
   git commit -m "feat(content-factory): add skill.test.json tier manifest"
   ```

**Verification**: File exists at `src/templates/skills/content-factory/skill.test.json` with valid JSON.

> **Note**: The manifest declares `generators/lib/` and `tests/unit/` paths which do not exist yet. That is correct — `skill.test.json` is a declaration, not a check. The Tier 1 contract test (Task 9) runs after the lib/ extraction (Tasks 4-5) and the tests directories (Tasks 6-7) have been created.

---

### Task 4: Extract `lib/cards.js` from `app.js`

**Files**: `src/templates/skills/content-factory/generators/lib/cards.js`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directory and file:
   ```bash
   mkdir -p src/templates/skills/content-factory/generators/lib
   ```
   Then create `src/templates/skills/content-factory/generators/lib/cards.js`:
   ```js
   /**
    * cards.js — pure HTML parsing functions for Codi content-factory templates.
    *
    * Uses DOMParser (browser API). In Node/Vitest: requires jsdom environment.
    * In browser: runs natively with no polyfill.
    *
    * @module cards
    */

   /**
    * Parse card elements from an HTML string.
    * Extracts .social-card, .doc-page, and .slide elements along with shared styles.
    *
    * @param {string} html - Raw HTML string of a content template file
    * @returns {Array<{index:number, dataType:string, dataIdx:string, html:string, styleText:string, linkTags:string, format:null}>}
    */
   export function parseCards(html) {
     const doc = new DOMParser().parseFromString(html, "text/html");
     const styleText = Array.from(doc.querySelectorAll("style"))
       .map((s) => s.textContent)
       .join("\n");
     const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
       .map((l) => l.outerHTML)
       .join("\n");
     return Array.from(doc.querySelectorAll(".social-card, .doc-page, .slide")).map((el, i) => ({
       index: i,
       dataType: el.getAttribute("data-type") || "card",
       dataIdx: el.getAttribute("data-index") || String(i + 1).padStart(2, "0"),
       html: el.outerHTML,
       styleText,
       linkTags,
       format: null,
     }));
   }

   /**
    * Parse a template HTML file into a structured template object.
    *
    * @param {string} html - Raw HTML string of the template file
    * @param {string} filename - Filename used as fallback id (e.g. "dark-editorial.html")
    * @returns {{filename:string, id:string, name:string, type:string, format:{w:number,h:number}, desc:string, cards:Array}}
    */
   export function parseTemplate(html, filename) {
     const doc = new DOMParser().parseFromString(html, "text/html");
     const metaEl = doc.querySelector('meta[name="codi:template"]');
     let meta = {};
     try { if (metaEl) meta = JSON.parse(metaEl.content); } catch {}
     const id = meta.id || filename.replace(/\.html$/, "");
     const cards = parseCards(html);
     return {
       filename,
       id,
       name: meta.name || id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
       type: meta.type || "social",
       format: meta.format || { w: 1080, h: 1080 },
       desc: meta.desc || "",
       cards,
     };
   }
   ```
- [ ] 2. Commit (lib only — not yet wired into app.js):
   ```bash
   git add src/templates/skills/content-factory/generators/lib/cards.js
   git commit -m "feat(content-factory): extract parseCards and parseTemplate into lib/cards.js"
   ```

**Verification**: `grep "export function parseCards" src/templates/skills/content-factory/generators/lib/cards.js` — expected: one match. (Do not run the function in Node directly — it uses `DOMParser` which requires jsdom; that is covered by the unit tests in Task 6.)

---

### Task 5: Extract `lib/card-builder.js` from `app.js`

**Files**: `src/templates/skills/content-factory/generators/lib/card-builder.js`
**Est**: 5 minutes

**Steps**:
- [ ] 1. The `lib/` directory already exists from Task 4. Create `src/templates/skills/content-factory/generators/lib/card-builder.js`:
   ```js
   /**
    * card-builder.js — pure srcdoc HTML builders for Codi content-factory.
    *
    * No DOM reads, no global state. All external values (format, handle) are
    * passed as parameters. Safe to import in Node/Vitest without jsdom.
    *
    * @module card-builder
    */

   /**
    * Resolve the effective format for a card.
    * A4 document cards (w=794) always use their native format regardless of the
    * active format selector. All other card types follow stateFormat.
    *
    * @param {{format:{w:number,h:number}|null}} card
    * @param {{w:number,h:number}} stateFormat - The active format from the sidebar
    * @returns {{w:number,h:number}}
    */
   export function cardFormat(card, stateFormat) {
     if (card && card.format && card.format.w === 794) return card.format;
     return stateFormat;
   }

   /**
    * Build the full srcdoc HTML string for a preview or export iframe.
    *
    * @param {{html:string, styleText:string, linkTags:string, format:{w:number,h:number}|null}} card
    * @param {{w:number,h:number}} fmt - Resolved format from cardFormat()
    * @param {object|null} [logo] - Logo state object { visible, x, y, size }
    * @param {string} [handle] - Handle string without @ (e.g. "myuser")
    * @param {boolean} [forExport] - When true: transparent bg, overflow:visible, SVG logo
    * @returns {string}
    */
   export function buildCardDoc(card, fmt, logo = null, handle = "handle", forExport = false) {
     const bg = forExport ? "background:#070a0f" : "";
     const html = card.html.replace(/@handle/g, "@" + handle);

     let logoHtml = "";
     let logoFontLink = "";
     if (forExport && logo && logo.visible) {
       logoFontLink =
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500&display=swap">';
       const svgStyle = [
         "position:absolute",
         "left:" + logo.x + "%",
         "top:" + logo.y + "%",
         "transform:translate(-50%,-50%)",
         "overflow:visible",
         "z-index:999",
         "pointer-events:none",
         "opacity:0.88",
       ].join(";");
       logoHtml = [
         '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" style="' + svgStyle + '">',
         "<defs>",
         '<linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">',
         '<stop offset="0%" stop-color="#56b6c2"/>',
         '<stop offset="100%" stop-color="#61afef"/>',
         "</linearGradient>",
         "</defs>",
         '<text x="0" y="0"',
         " font-family=\"'Geist Mono',monospace\"",
         ' font-size="' + logo.size + '"',
         ' font-weight="500"',
         ' fill="url(#cg)"',
         ' text-anchor="middle"',
         ' dominant-baseline="middle"',
         ">codi</text>",
         "</svg>",
       ].join("");
     }

     const bodyOverflow = forExport ? "overflow:visible" : "overflow:hidden";
     return [
       '<!DOCTYPE html><html><head><meta charset="utf-8">',
       card.linkTags,
       logoFontLink,
       "<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
       "html,body{width:" + fmt.w + "px;height:" + fmt.h + "px;" + bodyOverflow + ";position:relative;" + bg + "}",
       card.styleText +
       // Override format vars and card dimensions to match the active format selector.
       // Injected after template CSS so it wins the cascade without !important on vars.
       // !important on .social-card catches templates that hardcode px instead of using vars.
       ":root{--w:" + fmt.w + "px;--h:" + fmt.h + "px}" +
       ".social-card{width:" + fmt.w + "px!important;height:" + fmt.h + "px!important}" +
       "</style></head><body>",
       html + logoHtml + "</body></html>",
     ].join("");
   }

   /**
    * Build the srcdoc HTML string for a gallery thumbnail iframe.
    * Always uses the card's native format. Handle replaced with "@preview".
    *
    * @param {{html:string, styleText:string, linkTags:string, format:{w:number,h:number}|null}} card
    * @param {{w:number,h:number}} fmt - Resolved format (use cardFormat() with native template format)
    * @returns {string}
    */
   export function buildThumbDoc(card, fmt) {
     return [
       '<!DOCTYPE html><html><head><meta charset="utf-8">',
       card.linkTags || "",
       "<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
       "html,body{width:" + fmt.w + "px;height:" + fmt.h + "px;overflow:hidden}",
       (card.styleText || "") +
       ":root{--w:" + fmt.w + "px;--h:" + fmt.h + "px}" +
       ".social-card{width:" + fmt.w + "px!important;height:" + fmt.h + "px!important}" +
       "</style></head><body>",
       (card.html || "").replace(/@handle/g, "@preview") + "</body></html>",
     ].join("");
   }

   /**
    * Compute the display dimensions and scale for rendering a card in the canvas area.
    *
    * @param {{w:number,h:number}} fmt - Resolved format from cardFormat()
    * @param {{canvasW:number, canvasH:number, zoom:number, viewMode:string}} opts
    * @returns {{scale:number, fmt:{w:number,h:number}, displayW:number, displayH:number}}
    */
   export function computeCardSize(fmt, { canvasW, canvasH, zoom, viewMode } = {}) {
     const cw = Math.max(canvasW ?? 400, 400);
     const ch = Math.max(canvasH ?? 300, 300);
     const z = zoom ?? 1;
     const mode = viewMode ?? "grid";
     let scale;
     if (mode === "app") {
       const fitW = (cw - 140) / fmt.w;
       const fitH = (ch - 92) / fmt.h;
       const fitScale = Math.min(fitW, fitH);
       scale = Math.min(fitScale * z, fitScale);
     } else {
       const refW = Math.min(cw - 80, 520);
       scale = (refW / fmt.w) * z;
     }
     return { scale, fmt, displayW: Math.round(fmt.w * scale), displayH: Math.round(fmt.h * scale) };
   }
   ```
- [ ] 2. Commit:
   ```bash
   git add src/templates/skills/content-factory/generators/lib/card-builder.js
   git commit -m "feat(content-factory): extract buildCardDoc, buildThumbDoc, cardFormat, computeCardSize into lib/card-builder.js"
   ```

**Verification**: `grep "export function buildCardDoc" src/templates/skills/content-factory/generators/lib/card-builder.js` — expected: one match.

---

### Task 6: Write unit tests for `lib/cards.js`

**Files**: `src/templates/skills/content-factory/tests/unit/cards.test.js`
**Est**: 5 minutes

**Steps**:
- [ ] 1. Create directories:
   ```bash
   mkdir -p src/templates/skills/content-factory/tests/unit
   ```
   Create `src/templates/skills/content-factory/tests/unit/cards.test.js`:
   ```js
   // @vitest-environment jsdom
   import { describe, it, expect } from "vitest";
   import { parseCards, parseTemplate } from "../../generators/lib/cards.js";

   describe("parseCards", () => {
     it("parses .social-card elements", () => {
       const html = `<!DOCTYPE html><html><body>
         <article class="social-card" data-type="cover" data-index="01"><p>A</p></article>
         <article class="social-card" data-type="content" data-index="02"><p>B</p></article>
       </body></html>`;
       const cards = parseCards(html);
       expect(cards).toHaveLength(2);
       expect(cards[0].dataType).toBe("cover");
       expect(cards[1].dataIdx).toBe("02");
     });

     it("parses .doc-page elements (document templates)", () => {
       const html = `<!DOCTYPE html><html><body>
         <article class="doc-page" data-type="cover" data-index="01"></article>
       </body></html>`;
       const cards = parseCards(html);
       expect(cards).toHaveLength(1);
       expect(cards[0].dataType).toBe("cover");
     });

     it("parses .slide elements (slides templates)", () => {
       const html = `<!DOCTYPE html><html><body>
         <section class="slide" data-type="title" data-index="01"></section>
         <section class="slide" data-type="content" data-index="02"></section>
       </body></html>`;
       const cards = parseCards(html);
       expect(cards).toHaveLength(2);
     });

     it("returns empty array when no card elements found", () => {
       const html = `<!DOCTYPE html><html><body><p>nothing</p></body></html>`;
       expect(parseCards(html)).toHaveLength(0);
     });

     it("extracts shared styleText from all <style> tags", () => {
       const html = `<!DOCTYPE html><html><head>
         <style>.a{color:red}</style><style>.b{color:blue}</style>
       </head><body>
         <article class="social-card" data-type="cover" data-index="01"></article>
       </body></html>`;
       const cards = parseCards(html);
       expect(cards[0].styleText).toContain(".a{color:red}");
       expect(cards[0].styleText).toContain(".b{color:blue}");
     });

     it("extracts linkTags from <link rel=stylesheet> elements", () => {
       const html = `<!DOCTYPE html><html><head>
         <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit&display=swap">
       </head><body>
         <article class="social-card" data-type="cover" data-index="01"></article>
       </body></html>`;
       const cards = parseCards(html);
       expect(cards[0].linkTags).toContain("fonts.googleapis.com");
     });

     it("sets format to null on every parsed card", () => {
       const html = `<article class="social-card" data-type="cover" data-index="01"></article>`;
       const cards = parseCards(html);
       expect(cards[0].format).toBeNull();
     });
   });

   describe("parseTemplate", () => {
     it("reads id, name, type, and format from codi:template meta tag", () => {
       const meta = JSON.stringify({ id: "dark-editorial", name: "Dark Editorial", type: "social", format: { w: 1080, h: 1080 } });
       const html = `<!DOCTYPE html><html><head>
         <meta name="codi:template" content='${meta}'>
       </head><body>
         <article class="social-card" data-type="cover" data-index="01"></article>
       </body></html>`;
       const t = parseTemplate(html, "dark-editorial.html");
       expect(t.id).toBe("dark-editorial");
       expect(t.name).toBe("Dark Editorial");
       expect(t.type).toBe("social");
       expect(t.format).toEqual({ w: 1080, h: 1080 });
     });

     it("falls back to filename-derived id when no meta tag", () => {
       const html = `<body><article class="social-card" data-type="cover" data-index="01"></article></body>`;
       const t = parseTemplate(html, "my-custom-template.html");
       expect(t.id).toBe("my-custom-template");
     });

     it("falls back to social type and 1080x1080 format when no meta tag", () => {
       const html = `<body><article class="social-card" data-type="cover" data-index="01"></article></body>`;
       const t = parseTemplate(html, "foo.html");
       expect(t.type).toBe("social");
       expect(t.format).toEqual({ w: 1080, h: 1080 });
     });

     it("includes parsed cards in template object", () => {
       const meta = JSON.stringify({ id: "t", name: "T", type: "social", format: { w: 1080, h: 1080 } });
       const html = `<html><head><meta name="codi:template" content='${meta}'></head><body>
         <article class="social-card" data-type="cover" data-index="01"></article>
         <article class="social-card" data-type="cta" data-index="02"></article>
       </body></html>`;
       const t = parseTemplate(html, "t.html");
       expect(t.cards).toHaveLength(2);
     });
   });
   ```
- [ ] 2. Verify the test file syntax is valid (it cannot run yet — the vitest glob update is in Task 8):
   ```bash
   node --check src/templates/skills/content-factory/tests/unit/cards.test.js 2>&1 || echo "syntax error"
   ```
   Expected: no output (syntax OK).
- [ ] 3. Commit:
   ```bash
   git add src/templates/skills/content-factory/tests/unit/cards.test.js
   git commit -m "test(content-factory): add unit tests for parseCards and parseTemplate"
   ```

**Verification**: After Task 8 adds the glob, run `pnpm test src/templates/skills/content-factory/tests/unit/cards.test.js` — expected: 11 passed.

---

### Task 7: Write unit tests for `lib/card-builder.js`

**Files**: `src/templates/skills/content-factory/tests/unit/card-builder.test.js`
**Est**: 5 minutes

**Steps**:
- [ ] 1. The `tests/unit/` directory already exists from Task 6. Create `src/templates/skills/content-factory/tests/unit/card-builder.test.js`:
   ```js
   import { describe, it, expect } from "vitest";
   import { cardFormat, buildCardDoc, buildThumbDoc, computeCardSize } from "../../generators/lib/card-builder.js";

   const makeCard = (overrides = {}) => ({
     html: "<div>content</div>",
     styleText: ":root{--w:1080px;--h:1080px}",
     linkTags: "",
     format: null,
     ...overrides,
   });

   describe("cardFormat", () => {
     it("returns stateFormat for non-A4 cards", () => {
       expect(cardFormat(makeCard(), { w: 1080, h: 1350 })).toEqual({ w: 1080, h: 1350 });
     });

     it("returns native format for A4 cards (w=794)", () => {
       const a4Card = makeCard({ format: { w: 794, h: 1123 } });
       expect(cardFormat(a4Card, { w: 1080, h: 1080 })).toEqual({ w: 794, h: 1123 });
     });

     it("returns stateFormat for card with null format", () => {
       expect(cardFormat(makeCard({ format: null }), { w: 1280, h: 720 })).toEqual({ w: 1280, h: 720 });
     });
   });

   describe("buildCardDoc", () => {
     it("injects --w and --h CSS vars matching the format", () => {
       const card = makeCard({ styleText: "" });
       const doc = buildCardDoc(card, { w: 1080, h: 1350 });
       expect(doc).toContain(":root{--w:1080px;--h:1350px}");
     });

     it("injects .social-card dimension override with !important", () => {
       const card = makeCard({ styleText: "" });
       const doc = buildCardDoc(card, { w: 1080, h: 1350 });
       expect(doc).toContain(".social-card{width:1080px!important;height:1350px!important}");
     });

     it("injects CSS override AFTER template styleText", () => {
       const card = makeCard({ styleText: ":root{--w:1080px;--h:1080px}" });
       const doc = buildCardDoc(card, { w: 1080, h: 1350 });
       const styleIdx = doc.indexOf(":root{--w:1080px;--h:1080px}");
       const overrideIdx = doc.indexOf(":root{--w:1080px;--h:1350px}");
       expect(styleIdx).toBeLessThan(overrideIdx);
     });

     it("replaces @handle placeholder with the provided handle", () => {
       const card = makeCard({ html: "<span>Follow @handle</span>" });
       const doc = buildCardDoc(card, { w: 1080, h: 1080 }, null, "testuser");
       expect(doc).toContain("@testuser");
       expect(doc).not.toContain("@handle");
     });

     it("uses 'handle' as default when no handle provided", () => {
       const card = makeCard({ html: "@handle" });
       const doc = buildCardDoc(card, { w: 1080, h: 1080 });
       expect(doc).toContain("@handle");
     });

     it("sets overflow:hidden for preview (forExport=false)", () => {
       const doc = buildCardDoc(makeCard(), { w: 1080, h: 1080 });
       expect(doc).toContain("overflow:hidden");
     });

     it("sets overflow:visible for export (forExport=true)", () => {
       const doc = buildCardDoc(makeCard(), { w: 1080, h: 1080 }, null, "handle", true);
       expect(doc).toContain("overflow:visible");
     });

     it("injects SVG logo when forExport=true and logo.visible=true", () => {
       const logo = { visible: true, x: 50, y: 90, size: 24 };
       const doc = buildCardDoc(makeCard(), { w: 1080, h: 1080 }, logo, "u", true);
       expect(doc).toContain("<svg");
       expect(doc).toContain("codi</text>");
     });

     it("does not inject SVG logo when logo.visible=false", () => {
       const logo = { visible: false, x: 50, y: 90, size: 24 };
       const doc = buildCardDoc(makeCard(), { w: 1080, h: 1080 }, logo, "u", true);
       expect(doc).not.toContain("<svg");
     });
   });

   describe("buildThumbDoc", () => {
     it("replaces @handle with @preview in thumbnail", () => {
       const card = makeCard({ html: "<div>@handle</div>" });
       const doc = buildThumbDoc(card, { w: 1080, h: 1080 });
       expect(doc).toContain("@preview");
       expect(doc).not.toContain("@handle");
     });

     it("injects format vars for the native template format", () => {
       const card = makeCard({ styleText: "" });
       const doc = buildThumbDoc(card, { w: 794, h: 1123 });
       expect(doc).toContain(":root{--w:794px;--h:1123px}");
     });
   });

   describe("computeCardSize", () => {
     it("returns scale and displayW/displayH for grid mode", () => {
       const result = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 600, canvasH: 800, zoom: 1, viewMode: "grid" });
       expect(result.scale).toBeGreaterThan(0);
       expect(result.displayW).toBeGreaterThan(0);
       expect(result.displayH).toBeGreaterThan(0);
       expect(result.fmt).toEqual({ w: 1080, h: 1080 });
     });

     it("caps scale at fitScale in app mode to prevent clipping", () => {
       // zoom=2 should not exceed the fit scale in app mode
       const fit = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 800, canvasH: 600, zoom: 1, viewMode: "app" });
       const zoomed = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 800, canvasH: 600, zoom: 2, viewMode: "app" });
       expect(zoomed.scale).toBeLessThanOrEqual(fit.scale + 0.001);
     });

     it("scales proportionally with zoom in grid mode", () => {
       const base = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 600, canvasH: 800, zoom: 1, viewMode: "grid" });
       const half = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 600, canvasH: 800, zoom: 0.5, viewMode: "grid" });
       expect(Math.abs(half.scale - base.scale * 0.5)).toBeLessThan(0.001);
     });

     it("uses minimum canvas dimensions as floor", () => {
       // canvasW/canvasH below floor values (400/300) should still produce valid output
       const result = computeCardSize({ w: 1080, h: 1080 }, { canvasW: 0, canvasH: 0, zoom: 1, viewMode: "grid" });
       expect(result.scale).toBeGreaterThan(0);
     });
   });
   ```
- [ ] 2. Commit:
   ```bash
   git add src/templates/skills/content-factory/tests/unit/card-builder.test.js
   git commit -m "test(content-factory): add unit tests for cardFormat, buildCardDoc, buildThumbDoc, computeCardSize"
   ```

**Verification**: After Task 8 adds the glob, run `pnpm test src/templates/skills/content-factory/tests/unit/card-builder.test.js` — expected: 18 passed.

---

### Task 8: Update `vitest.config.ts` to discover skill tests

**Files**: `vitest.config.ts`
**Est**: 3 minutes

**Steps**:
- [ ] 1. Write failing test (meta-test): run the skill unit tests directly and confirm they cannot be discovered yet:
   ```bash
   pnpm test -- --reporter=verbose 2>&1 | grep "card-builder\|cards.test" | head -5
   ```
   Expected: no output (tests not discovered).
- [ ] 2. Edit `vitest.config.ts` — apply the following changes:

   Change the `include` array from:
   ```typescript
   include: ["tests/**/*.test.ts"],
   ```
   To:
   ```typescript
   include: [
     "tests/**/*.test.ts",
     "src/templates/skills/**/tests/**/*.test.{ts,js}",
   ],
   ```

   Add `environmentMatchGlobs` inside the `test` block (after `sequence`):
   ```typescript
   environmentMatchGlobs: [
     ["src/templates/skills/**/tests/**/*.test.{ts,js}", "jsdom"],
   ],
   ```

   Change the `coverage.include` from:
   ```typescript
   include: ["src/**/*.ts"],
   ```
   To:
   ```typescript
   include: [
     "src/**/*.ts",
     "src/templates/skills/**/generators/lib/**/*.js",
   ],
   ```

   Add to `coverage.exclude` (after the existing last exclusion line):
   ```typescript
   "src/templates/skills/**/tests/**",  // test files excluded from coverage measurement
   ```

   Add to `coverage.thresholds` (before the closing `}`):
   ```typescript
   "src/templates/skills/**/generators/lib/**": {
     statements: 80,
     branches: 70,
     functions: 85,
   },
   ```

- [ ] 3. Verify skill tests are now discovered:
   ```bash
   pnpm test -- --reporter=verbose 2>&1 | grep "card-builder\|cards.test" | head -10
   ```
   Expected: test names for `cards.test.js` and `card-builder.test.js` appear.
- [ ] 4. Verify all tests pass:
   ```bash
   pnpm test
   ```
   Expected: all tests pass including the new skill unit tests.
- [ ] 5. Commit:
   ```bash
   git add vitest.config.ts
   git commit -m "feat(vitest): discover skill tests and add jsdom environment for cards.test.js"
   ```

**Verification**: `pnpm test` — expected: all tests pass. Skill test file names appear in output.

---

### Task 9: Write Tier 1 contract validator

**Files**: `tests/unit/skills/skill-contracts.test.ts`
**Est**: 8 minutes

**Steps**:
- [ ] 1. Write failing test — confirm the file path does not exist yet:
   ```bash
   ls tests/unit/skills/skill-contracts.test.ts 2>&1
   ```
   Expected: "No such file or directory"
- [ ] 2. Create `tests/unit/skills/skill-contracts.test.ts`:
   ```typescript
   // @vitest-environment jsdom
   import { describe, it, expect, beforeAll } from "vitest";
   import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
   import { resolve, join, dirname } from "node:path";
   import { fileURLToPath, pathToFileURL } from "node:url";
   import { SkillTestManifestSchema } from "#src/schemas/skill-test.js";

   const __dirname = fileURLToPath(new URL(".", import.meta.url));
   const SKILLS_DIR = resolve(__dirname, "../../../src/templates/skills");

   /** Find all skill.test.json files under src/templates/skills/ */
   function findSkillManifests(): Array<{ skillDir: string; manifestPath: string }> {
     return readdirSync(SKILLS_DIR)
       .filter((name) => statSync(join(SKILLS_DIR, name)).isDirectory())
       .flatMap((skillName) => {
         const manifestPath = join(SKILLS_DIR, skillName, "skill.test.json");
         if (!existsSync(manifestPath)) return [];
         return [{ skillDir: join(SKILLS_DIR, skillName), manifestPath }];
       });
   }

   const manifests = findSkillManifests();

   // If no manifests found, the test suite is a no-op (not a failure).
   // Skills without skill.test.json are transparent to the framework.
   describe("Skill contract tests (Tier 1)", () => {
     it("finds at least one skill.test.json", () => {
       expect(manifests.length).toBeGreaterThan(0);
     });

     for (const { skillDir, manifestPath } of manifests) {
       const skillName = manifestPath.split("/").slice(-2)[0];

       describe(`skill: ${skillName}`, () => {
         let manifest: ReturnType<typeof SkillTestManifestSchema.parse>;

         beforeAll(() => {
           const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
           manifest = SkillTestManifestSchema.parse(raw);
         });

         it("skill.test.json is valid against SkillTestManifestSchema", () => {
           const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
           const result = SkillTestManifestSchema.safeParse(raw);
           expect(result.success, result.success ? "" : JSON.stringify((result as any).error?.issues)).toBe(true);
         });

         it("all declared paths exist", () => {
           const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
           const parsed = SkillTestManifestSchema.safeParse(raw);
           if (!parsed.success) return; // already caught above
           const { tiers } = parsed.data;

           if (tiers.logic) {
             expect(existsSync(join(skillDir, tiers.logic.lib)), `lib dir missing: ${tiers.logic.lib}`).toBe(true);
             expect(existsSync(join(skillDir, tiers.logic.tests)), `tests dir missing: ${tiers.logic.tests}`).toBe(true);
           }
           if (tiers.behavior) {
             expect(existsSync(join(skillDir, tiers.behavior.server)), `server missing: ${tiers.behavior.server}`).toBe(true);
             expect(existsSync(join(skillDir, tiers.behavior.startScript)), `startScript missing: ${tiers.behavior.startScript}`).toBe(true);
             expect(existsSync(join(skillDir, tiers.behavior.tests)), `e2e dir missing: ${tiers.behavior.tests}`).toBe(true);
           }
         });

         it("all template HTML files have a parseable codi:template meta tag", () => {
           const templatesDir = join(skillDir, "generators", "templates");
           if (!existsSync(templatesDir)) return; // no templates dir — skip

           const htmlFiles = readdirSync(templatesDir).filter((f) => f.endsWith(".html"));
           expect(htmlFiles.length, "Expected at least one template HTML file").toBeGreaterThan(0);

           for (const file of htmlFiles) {
             const html = readFileSync(join(templatesDir, file), "utf-8");
             const match = html.match(/<meta\s+name="codi:template"\s+content='([^']+)'/);
             expect(match, `${file}: missing codi:template meta tag`).toBeTruthy();

             if (match) {
               let meta: Record<string, unknown>;
               expect(() => { meta = JSON.parse(match[1]); }, `${file}: codi:template content is not valid JSON`).not.toThrow();
               expect(meta!.id, `${file}: meta.id missing`).toBeTruthy();
               expect(meta!.name, `${file}: meta.name missing`).toBeTruthy();
               expect(meta!.type, `${file}: meta.type must be one of social|slides|document`).toMatch(/^(social|slides|document)$/);
               expect(typeof (meta!.format as any)?.w, `${file}: meta.format.w must be a number`).toBe("number");
               expect(typeof (meta!.format as any)?.h, `${file}: meta.format.h must be a number`).toBe("number");
             }
           }
         });

         it("parseCards returns > 0 cards for every template file", async () => {
           const templatesDir = join(skillDir, "generators", "templates");
           if (!existsSync(templatesDir)) return;

           const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
           const parsed = SkillTestManifestSchema.safeParse(raw);
           if (!parsed.success || !parsed.data.tiers.logic) return;

           const libDir = join(skillDir, parsed.data.tiers.logic.lib);
           const cardsPath = join(libDir, "cards.js");
           if (!existsSync(cardsPath)) {
             throw new Error(`cards.js not found at ${cardsPath} — required for Tier 1 card parsing assertions`);
           }

           // Dynamic import of the skill's own lib/cards.js
           const { parseCards } = await import(pathToFileURL(cardsPath).href) as { parseCards: (html: string) => unknown[] };

           const htmlFiles = readdirSync(templatesDir).filter((f) => f.endsWith(".html"));
           for (const file of htmlFiles) {
             const html = readFileSync(join(templatesDir, file), "utf-8");
             const cards = parseCards(html);
             expect(cards.length, `${file}: parseCards returned 0 cards — check .social-card, .doc-page, .slide selectors`).toBeGreaterThan(0);
           }
         });

         it("every parsed card has data-type and data-index attributes", async () => {
           const templatesDir = join(skillDir, "generators", "templates");
           if (!existsSync(templatesDir)) return;

           const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
           const parsed = SkillTestManifestSchema.safeParse(raw);
           if (!parsed.success || !parsed.data.tiers.logic) return;

           const libDir = join(skillDir, parsed.data.tiers.logic.lib);
           const cardsPath = join(libDir, "cards.js");
           if (!existsSync(cardsPath)) return;

           const { parseCards } = await import(pathToFileURL(cardsPath).href) as {
             parseCards: (html: string) => Array<{ dataType: string; dataIdx: string }>;
           };

           const htmlFiles = readdirSync(templatesDir).filter((f) => f.endsWith(".html"));
           for (const file of htmlFiles) {
             const html = readFileSync(join(templatesDir, file), "utf-8");
             const cards = parseCards(html);
             for (const card of cards) {
               expect(card.dataType, `${file}: card missing dataType`).toBeTruthy();
               expect(card.dataIdx, `${file}: card missing dataIdx`).toBeTruthy();
             }
           }
         });
       });
     }
   });
   ```
- [ ] 3. Add `tests/unit/skills/` directory marker (empty `.gitkeep` so git tracks the directory):
   ```bash
   mkdir -p tests/unit/skills
   touch tests/unit/skills/.gitkeep
   ```
- [ ] 4. Verify tests pass:
   ```bash
   pnpm test tests/unit/skills/skill-contracts.test.ts
   ```
   Expected: all assertions pass for `content-factory` (7 assertions: 1 global + 6 per skill).
- [ ] 5. Commit:
   ```bash
   git add tests/unit/skills/skill-contracts.test.ts tests/unit/skills/.gitkeep
   git commit -m "feat(tests): add Tier 1 skill contract validator for all code skills"
   ```

**Verification**: `pnpm test tests/unit/skills/` — expected: 7 assertions pass (1 global + 6 for content-factory), no failures.

---

### Task 10: Write server integration tests

**Files**: `src/templates/skills/content-factory/tests/integration/server.test.js`
**Est**: 10 minutes

**Steps**:
- [ ] 1. Create directory:
   ```bash
   mkdir -p src/templates/skills/content-factory/tests/integration
   ```
- [ ] 2. Create `src/templates/skills/content-factory/tests/integration/server.test.js`:
   ```js
   import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
   import { spawn } from "node:child_process";
   import { mkdtempSync, rmSync } from "node:fs";
   import { tmpdir } from "node:os";
   import path from "node:path";
   import { fileURLToPath } from "node:url";

   vi.setConfig({ testTimeout: 20_000 });

   const __dirname = fileURLToPath(new URL(".", import.meta.url));
   // __dirname = src/templates/skills/content-factory/tests/integration/
   // ../../../ = src/templates/skills/content-factory/
   const SKILL_DIR = path.resolve(__dirname, "../../../");
   const START_SCRIPT = path.join(SKILL_DIR, "scripts", "start-server.sh");

   let serverProcess;
   let baseUrl;
   let tempDir;

   /**
    * Spawns scripts/start-server.sh, waits for the JSON startup line,
    * and resolves with { url, screen_dir, state_dir }.
    * Rejects after 10s if no "server-started" JSON is received.
    */
   async function startServer() {
     tempDir = mkdtempSync(path.join(tmpdir(), "codi-cf-test-"));
     return new Promise((resolve, reject) => {
       const timer = setTimeout(() => reject(new Error("Server did not start within 10s")), 10_000);
       const proc = spawn("bash", [
         START_SCRIPT,
         "--name", "test",
         "--project-dir", tempDir,
       ]);
       serverProcess = proc;
       proc.stdout.on("data", (chunk) => {
         const lines = chunk.toString().split("\n");
         for (const line of lines) {
           try {
             const data = JSON.parse(line.trim());
             if (data.type === "server-started") {
               clearTimeout(timer);
               resolve(data);
             }
           } catch { /* not JSON yet — still in startup output */ }
         }
       });
       proc.on("error", (err) => { clearTimeout(timer); reject(err); });
       proc.on("exit", (code) => {
         if (code !== 0) { clearTimeout(timer); reject(new Error(`Server exited with code ${code}`)); }
       });
     });
   }

   beforeAll(async () => {
     const result = await startServer();
     baseUrl = result.url;
   });

   afterAll(() => {
     serverProcess?.kill("SIGTERM");
     if (tempDir) rmSync(tempDir, { recursive: true, force: true });
   });

   describe("GET /", () => {
     it("serves the app HTML shell", async () => {
       const text = await fetch(baseUrl + "/").then((r) => r.text());
       expect(text).toContain("<!DOCTYPE html");
       expect(text).toContain("content-factory");
     });
   });

   describe("GET /api/templates", () => {
     it("returns an array of .html filenames", async () => {
       const files = await fetch(`${baseUrl}/api/templates`).then((r) => r.json());
       expect(Array.isArray(files)).toBe(true);
       expect(files.length).toBeGreaterThan(0);
       expect(files.every((f) => f.endsWith(".html"))).toBe(true);
     });
   });

   describe("GET /api/template", () => {
     it("returns HTML for a known template file", async () => {
       const files = await fetch(`${baseUrl}/api/templates`).then((r) => r.json());
       const first = files[0];
       const html = await fetch(`${baseUrl}/api/template?file=${encodeURIComponent(first)}`).then((r) => r.text());
       expect(html).toContain("<!DOCTYPE html");
       expect(html).toContain('name="codi:template"');
     });

     it("returns 404 for an unknown template file", async () => {
       const res = await fetch(`${baseUrl}/api/template?file=does-not-exist.html`);
       expect(res.status).toBe(404);
     });
   });

   describe("GET /api/preset", () => {
     it("returns an object (empty or with preset data)", async () => {
       const data = await fetch(`${baseUrl}/api/preset`).then((r) => r.json());
       expect(typeof data).toBe("object");
     });
   });

   describe("POST /api/preset", () => {
     it("saves and retrieves a preset selection", async () => {
       const payload = { id: "dark-editorial", name: "Dark Editorial", type: "social", timestamp: Date.now() };
       const postRes = await fetch(`${baseUrl}/api/preset`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
       });
       expect(postRes.status).toBe(200);

       const retrieved = await fetch(`${baseUrl}/api/preset`).then((r) => r.json());
       expect(retrieved.id).toBe("dark-editorial");
     });
   });

   describe("GET /api/state", () => {
     it("returns a structured state object with activeFile, activePreset, and preset", async () => {
       const state = await fetch(`${baseUrl}/api/state`).then((r) => r.json());
       expect(state).toHaveProperty("activeFile");
       expect(state).toHaveProperty("activePreset");
       expect(state).toHaveProperty("preset");
     });
   });

   describe("GET /static/app.js", () => {
     it("serves app.js as JavaScript", async () => {
       const res = await fetch(`${baseUrl}/static/app.js`);
       expect(res.status).toBe(200);
       const ct = res.headers.get("content-type") || "";
       expect(ct).toMatch(/javascript/);
     });
   });
   ```
- [ ] 3. Add integration tests to the vitest include glob — the current glob `src/templates/skills/**/tests/**/*.test.{ts,js}` already covers this path. Verify:
   ```bash
   pnpm test src/templates/skills/content-factory/tests/integration/server.test.js
   ```
   Expected: all tests pass (server starts, APIs respond).
- [ ] 4. Commit:
   ```bash
   git add src/templates/skills/content-factory/tests/integration/server.test.js
   git commit -m "test(content-factory): add server integration tests for HTTP API endpoints"
   ```

**Verification**: `pnpm test src/templates/skills/content-factory/tests/` — all unit and integration tests pass.

---

### Task 11: Update `app.js` and `app.html` to import from `lib/`

**Files**: `src/templates/skills/content-factory/generators/app.js`, `src/templates/skills/content-factory/generators/app.html`
**Est**: 10 minutes

**Steps**:
- [ ] 1. Open `app.html` and change the app.js script tag from:
   ```html
   <script src="/static/app.js"></script>
   ```
   To:
   ```html
   <script type="module" src="/static/app.js"></script>
   ```
- [ ] 2. Open `app.js`. At the very top of the file (before any other code), add two import statements:
   ```js
   import { parseCards as _parseCards, parseTemplate as _parseTemplate } from "/static/lib/cards.js";
   import {
     cardFormat as _cardFormat,
     buildCardDoc as _buildCardDoc,
     buildThumbDoc as _buildThumbDoc,
     computeCardSize as _computeCardSize,
   } from "/static/lib/card-builder.js";
   ```
- [ ] 3. In `app.js`, replace the bodies of the six extracted functions with wrapper calls. Find each function and replace its entire body:

   Replace the body of `parseCards` (lines ~184-201):
   ```js
   function parseCards(html) {
     return _parseCards(html);
   }
   ```

   Replace the body of `parseTemplate` (lines ~204-220):
   ```js
   function parseTemplate(html, filename) {
     return _parseTemplate(html, filename);
   }
   ```

   Replace the body of `cardFormat` (lines ~240-245):
   ```js
   function cardFormat(card) {
     return _cardFormat(card, state.format);
   }
   ```

   Replace the body of `buildCardDoc` (lines ~247-318):
   ```js
   function buildCardDoc(card, forExport = false, logo = null) {
     const fmt = cardFormat(card);
     return _buildCardDoc(card, fmt, logo, state.handle || "handle", forExport);
   }
   ```

   Replace the body of `computeCardSize` (lines ~320-339):
   ```js
   function computeCardSize(card) {
     const fmt = cardFormat(card);
     const canvasEl = $("canvas");
     return _computeCardSize(fmt, {
       canvasW: Math.max(canvasEl.clientWidth, 400),
       canvasH: Math.max(canvasEl.clientHeight, 300),
       zoom: state.zoom,
       viewMode: state.viewMode,
     });
   }
   ```

   Replace the body of `buildThumbDoc` (lines ~746-759):
   ```js
   function buildThumbDoc(card) {
     const fmt = cardFormat(card);
     return _buildThumbDoc(card, fmt);
   }
   ```

   **Important**: `buildTemplateCoverEl` (search for `function buildTemplateCoverEl` in `app.js` — currently around line 761) calls `buildThumbDoc` on the cover card with the template's native format, not the state format. Find this line in `buildTemplateCoverEl`:
   ```js
   inner._coverCard = template.cards[0] ? { ...template.cards[0], format: fmt } : null;
   ```
   The `_coverCard` already has `format: fmt` (the template's native format) set on it, so when the IntersectionObserver calls `buildThumbDoc(coverCard)` → `cardFormat(coverCard)` returns the native format. No change needed here — the wrapper correctly resolves to native format because `card.format.w === 794` check passes for A4, and for others `cardFormat` calls `_cardFormat(card, state.format)`. But gallery thumbnails should always use native format, not state.format.

   Update `buildTemplateCoverEl` to use the lib function directly for gallery thumbnails to bypass state.format:
   Find the IntersectionObserver callback in `app.js` where it sets `iframe.srcdoc`. It should look like:
   ```js
   iframe.srcdoc = buildThumbDoc(inner._coverCard);
   ```
   Change it to:
   ```js
   const native = inner._coverCard.format || state.format;
   iframe.srcdoc = _buildThumbDoc(inner._coverCard, native);
   ```

- [ ] 4. Verify the server serves `lib/` files. The server already handles `/static/*` by reading from `generators/`. Since `generators/lib/` is a subdirectory, the existing handler should serve lib files automatically. Start the server and confirm:
   ```bash
   # Start server and capture the URL from the JSON output
   OUTPUT=$(bash src/templates/skills/content-factory/scripts/start-server.sh --name libtest --project-dir /tmp/test-lib 2>&1)
   URL=$(echo "$OUTPUT" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
   curl -s -o /dev/null -w "%{http_code}" "$URL/static/lib/cards.js"
   ```
   Expected: `200`. If you get `404`, inspect `server.cjs` to confirm the static file handler covers subdirectories of `generators/`.
- [ ] 5. Open the running app in the browser and verify the Gallery tab shows templates, Preview loads cards, and format switching works. Check the browser console for import errors.
- [ ] 6. Run the full test suite to ensure nothing regressed:
   ```bash
   pnpm test
   ```
   Expected: all tests pass.
- [ ] 7. Commit:
   ```bash
   git add src/templates/skills/content-factory/generators/app.js src/templates/skills/content-factory/generators/app.html
   git commit -m "refactor(content-factory): app.js imports pure functions from lib/ via ES modules"
   ```

**Verification**: Browser console shows no import errors. `pnpm test` — all tests pass including the 6 existing skill test files.

---

### Task 12: Sync to `.claude/skills/codi-content-factory/` with codi generate

**Files**: `.claude/skills/codi-content-factory/` (generated — do not edit directly)
**Est**: 2 minutes

**Steps**:
- [ ] 1. Run codi generate to sync template changes to the installed skill:
   ```bash
   codi generate --force
   ```
- [ ] 2. Verify the lib files were copied:
   ```bash
   ls .claude/skills/codi-content-factory/generators/lib/
   ```
   Expected: `cards.js` and `card-builder.js`
- [ ] 3. Verify `skill.test.json` was copied:
   ```bash
   ls .claude/skills/codi-content-factory/skill.test.json
   ```
   Expected: file exists.
- [ ] 4. Verify the app.html has `type="module"` on the script tag:
   ```bash
   grep 'type="module"' .claude/skills/codi-content-factory/generators/app.html
   ```
   Expected: one match.
- [ ] 5. Commit:
   ```bash
   git add .claude/skills/codi-content-factory/
   git commit -m "chore: sync content-factory skill with lib/ extraction and skill.test.json"
   ```

**Verification**: All five items above confirm successful sync.

---

### Task 13: Full test suite pass and Phase 1 validation

**Files**: none (verification only)
**Est**: 5 minutes

**Steps**:
- [ ] 1. Run the full test suite:
   ```bash
   pnpm test
   ```
   Expected: all tests pass. Look for these test files in output:
   - `tests/unit/schemas/skill-test.test.ts` — 4 tests
   - `tests/unit/skills/skill-contracts.test.ts` — 7 assertions (1 global + 6 for content-factory)
   - `src/templates/skills/content-factory/tests/unit/cards.test.js` — 11 tests
   - `src/templates/skills/content-factory/tests/unit/card-builder.test.js` — 18 tests
   - `src/templates/skills/content-factory/tests/integration/server.test.js` — 7 tests

- [ ] 2. Run coverage to verify lib thresholds are met:
   ```bash
   pnpm test:coverage 2>&1 | grep -A5 "generators/lib"
   ```
   Expected: statements ≥ 80%, functions ≥ 85%, branches ≥ 70%.

- [ ] 3. Confirm the 5 bugs fixed in the prior session are each covered by at least one test:

   | Bug | Covered by |
   |-----|-----------|
   | `.doc-page` and `.slide` not in parseCards selector | `cards.test.js: "parses .doc-page elements"` + `"parses .slide elements"` + Tier 1 `"parseCards returns > 0 cards"` for doc-article and clean-slides |
   | Format not adapting (CSS override not injected) | `card-builder.test.js: "injects --w and --h CSS vars"` + `"injects .social-card dimension override"` |
   | CSS override not after template styles | `card-builder.test.js: "injects CSS override AFTER template styleText"` |
   | Logo toggle broken (state.logo.visible not updated) | `card-builder.test.js: "does not inject SVG logo when logo.visible=false"` |
   | Gallery tab unresponsive (blocked by async init) | Not covered in Phase 1 — covered by Tier 3 Playwright spec `gallery.spec.ts` in Phase 2 |

- [ ] 4. Phase 1 is complete. Communicate next steps to the user:
   - Phase 2 (CLI + Playwright) is documented in the design spec at `docs/20260411_153614_[PLAN]_skill-testing-framework.md`
   - A second code skill can adopt the framework by adding `skill.test.json` with no changes to Codi core
   - The Playwright specs for Tier 3 (`tests/e2e/`) are defined in the spec and ready to implement

**Verification**: `pnpm test` exits with code 0. All expected test files appear in the output.
