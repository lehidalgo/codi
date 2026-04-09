# codi-deck Skill Implementation Plan
- **Date**: 2026-04-07 12:54
- **Document**: 20260407_125449_PLAN_deck-skill-redesign-impl.md
- **Category**: PLAN

> **For agentic workers:** Use `codi-subagent-dev` (recommended) or `codi-plan-executor` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `codi-deck` skill — an HTML-first interactive slide deck generator with a local preview server, three-phase workflow (style iteration → full deck → export), and Playwright-based PDF/PPTX export.

**Architecture:** A standalone Node.js server (`server.cjs`) extended from the brainstorming skill serves slides at a local URL. The agent generates HTML slide files (960×540px); the server auto-reloads and injects navigation/approval controls. Export uses Playwright for PDF (print-to-PDF) or PPTX (screenshots → agent vision → pptxgenjs code generation).

**Tech Stack:** Node.js (CJS, zero npm deps in server), TypeScript/TSX, Playwright, pptxgenjs, pdf-lib, Vitest

**Design spec:** `docs/20260407_120000_PLAN_deck-skill-redesign.md`

---

### Task 1: Scaffold skill directory + template.ts + index.ts

- [ ] **Files**: `src/templates/skills/codi-deck/template.ts`, `src/templates/skills/codi-deck/index.ts`, `tests/unit/templates/deck-skill.test.ts`
**Est**: 5 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/templates/deck-skill.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";

   describe("codi-deck skill template", () => {
     it("exports a non-empty template string", async () => {
       const mod = await import("#src/templates/skills/codi-deck/index.js");
       expect(typeof mod.template).toBe("string");
       expect(mod.template.length).toBeGreaterThan(200);
     });

     it("has required frontmatter fields", async () => {
       const { template } = await import("#src/templates/skills/codi-deck/index.js");
       expect(template).toContain("name: {{name}}");
       expect(template).toContain("description:");
       expect(template).toContain("version: 1");
       expect(template).toContain("managed_by: codi");
     });

     it("describes the three-phase workflow", async () => {
       const { template } = await import("#src/templates/skills/codi-deck/index.js");
       expect(template).toContain("Phase 1");
       expect(template).toContain("Phase 2");
       expect(template).toContain("Phase 3");
     });

     it("exports staticDir as a non-empty string", async () => {
       const mod = await import("#src/templates/skills/codi-deck/index.js");
       expect(typeof mod.staticDir).toBe("string");
       expect(mod.staticDir.length).toBeGreaterThan(0);
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: module not found error

- [ ] 3. Create empty directories:
   ```bash
   mkdir -p src/templates/skills/codi-deck/scripts/export
   mkdir -p src/templates/skills/codi-deck/references
   mkdir -p src/templates/skills/codi-deck/assets
   mkdir -p src/templates/skills/codi-deck/evals
   ```

- [ ] 4. Implement `src/templates/skills/codi-deck/template.ts`:
   ```typescript
   import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

   export const template = `---
   name: {{name}}
   description: |
     HTML-first interactive slide deck generator with local preview server.
     Use when the user wants to create a presentation, slide deck, or slides.
     Activates the three-phase workflow: style iteration → full deck generation → export (PDF or PPTX).
     Do NOT activate for static single-file HTML slides or PPTX editing.
   category: ${SKILL_CATEGORY.CREATIVE_AND_DESIGN}
   compatibility: ${SUPPORTED_PLATFORMS_YAML}
   managed_by: ${PROJECT_NAME}
   user-invocable: true
   disable-model-invocation: false
   version: 1
   ---

   # {{name}}

   ## When to Activate

   - User says "create a deck", "make slides", "build a presentation"
   - User needs slides from content (JSON, document, notes)
   - User asks to iterate on slide design in a browser

   ## Quick Start

   \\\`\\\`\\\`bash
   # Start the slide server (run from the skill scripts directory)
   bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --project-dir .

   # Server outputs: {"type":"server-started","url":"http://localhost:PORT","slides_dir":"...","state_dir":"..."}
   # Open the URL in a browser, then proceed with Phase 1.
   \\\`\\\`\\\`

   Read the HTML authoring contract before generating slides:
   \\\`\${CLAUDE_SKILL_DIR}[[/references/slide-authoring.md]]\\\`

   ---

   ## Phase 1 — Style Iteration (max 3 rounds)

   **Goal:** Agree on visual style before generating all slides.

   1. Start server (if not running): \\\`bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --project-dir .\\\`
   2. Read server output to get \\\`slides_dir\\\` and \\\`state_dir\\\` paths.
   3. Generate **3 style variants** as HTML files in \\\`slides_dir\\\`:
      - \\\`style-a.html\\\` — minimal: white background, large serif headline, generous whitespace
      - \\\`style-b.html\\\` — bold: brand-blue accents, oversized numbers, tight grid
      - \\\`style-c.html\\\` — editorial: off-white background, mixed serif/sans hierarchy
      - Each variant contains **3 sample slides** showing: title, section, and metrics layouts
      - Variants must differ on at least two of: background scheme, heading scale/weight, layout density, accent color usage, decorative elements
   4. Tell user: "Open http://localhost:PORT to review the 3 style options. Click one and return here."
   5. On next turn: read \\\`state_dir/events\\\` (JSON lines file).
      - \\\`{"type":"style-chosen","choice":"a"}\\\` → user picked Style A → proceed to Phase 2
      - No event → ask user to click in the browser
   6. If user requests changes: regenerate variants (max 3 total rounds)
   7. After 3 rounds without approval: ask user to pick the closest existing option

   ---

   ## Phase 2 — Full Deck Generation

   **Goal:** Generate all N slides as HTML, review in browser, patch issues.

   **Extracting the design system from the approved style:**
   When the user approves style-X, extract these design tokens from style-X.html:
   - Color palette (primary, background, accent colors)
   - Typography scale (heading sizes, body size, font families)
   - Spacing rhythm (padding, gaps, margins)
   - Decorative patterns (rules, shapes, gradient fills)
   Apply these consistently to ALL slide types (title, divider, section, quote, metrics, closing).

   **Steps:**
   1. Remove \\\`style-a.html\\\`, \\\`style-b.html\\\`, \\\`style-c.html\\\` from \\\`slides_dir\\\` (or leave — server shows full-deck mode when slide-01.html is present)
   2. Generate \\\`slide-01.html\\\` through \\\`slide-NN.html\\\` in \\\`slides_dir\\\`
      - Overwrite any existing file of the same name (server reloads on file change)
      - Implement ALL required slide types from the authoring contract
   3. Tell user: "Open http://localhost:PORT to review all slides. Use the Request Change button for any slide that needs fixing, then return here."
   4. On next turn: read \\\`state_dir/events\\\` for change requests:
      - \\\`{"type":"change-request","slide":N,"note":"user note"}\\\` → patch only \\\`slide-NN.html\\\`
      - \\\`{"type":"approved"}\\\` → proceed to Phase 3
   5. **Patch individual slides only.** Regenerate the full deck only if the user reports a global issue (e.g., wrong brand color on all slides).

   ---

   ## Phase 3 — Export

   Ask the user once after Phase 2 approval:

   > "Slides approved. Export as: (a) PDF — instant, pixel-perfect  (b) PPTX — takes longer, agent reconstructs each slide for editable output"

   ### PDF Export

   \\\`\\\`\\\`bash
   npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/export/to-pdf.ts]] <slides_dir> output.pdf
   \\\`\\\`\\\`

   ### PPTX Export (3 turns)

   **Turn 1 — Screenshot all slides:**
   \\\`\\\`\\\`bash
   npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/export/screenshot.ts]] <slides_dir> export/
   \\\`\\\`\\\`
   Output: \\\`export/slide-01.png\\\`, \\\`export/slide-02.png\\\`, etc.

   **Turn 2 — Write build-pptx.ts (agent-generated file):**
   Read each screenshot visually. Write \\\`export/build-pptx.ts\\\` using pptxgenjs to recreate each slide exactly:
   \\\`\\\`\\\`typescript
   import { createRequire } from "node:module";
   const require = createRequire(import.meta.url);
   const PptxGenJS = require("pptxgenjs");
   const prs = new PptxGenJS();
   prs.defineLayout({ name: "WIDESCREEN", width: 10, height: 5.625 });
   prs.layout = "WIDESCREEN";

   // Slide 1 — Title
   const s1 = prs.addSlide();
   s1.background = { color: "FFFFFF" };
   s1.addText("Slide Title", { x: 0.5, y: 1.5, w: 9, h: 1.2, fontSize: 48, bold: true, color: "001391" });
   // ... more elements per slide

   await prs.writeFile({ fileName: "output.pptx" });
   \\\`\\\`\\\`

   **Turn 3 — Execute and QA:**
   \\\`\\\`\\\`bash
   npx tsx \${CLAUDE_SKILL_DIR}[[/scripts/export/agent-to-pptx.ts]] export/build-pptx.ts
   \\\`\\\`\\\`

   Take screenshots of the PPTX output for QA. Compare with original HTML PNGs. For any visible mismatch, rewrite only those slide sections in \\\`build-pptx.ts\\\` and re-run. **Max 2 QA passes.** After 2 passes, report remaining discrepancies to the user.

   ---

   ## Server Operations

   \\\`\\\`\\\`bash
   # Start
   bash \${CLAUDE_SKILL_DIR}[[/scripts/start-server.sh]] --project-dir . [--host 0.0.0.0] [--url-host myhost]

   # Stop
   bash \${CLAUDE_SKILL_DIR}[[/scripts/stop-server.sh]] <session_dir>
   \\\`\\\`\\\`

   Server reads slide files from \\\`<session_dir>/slides/\\\` and writes events to \\\`<session_dir>/state/events\\\`.

   **Auto-reload:** Server watches \\\`slides/\\\` for file changes and broadcasts reload to all browser tabs.

   ---

   ## Error Recovery

   | Problem | Detection | Fix |
   |---------|-----------|-----|
   | Server not starting | No \\\`server-info\\\` in state_dir after 5s | Run start-server.sh --foreground, check for port conflict |
   | Playwright not installed | Exit code error on export scripts | \\\`npx playwright install chromium\\\` |
   | No style choice event | events file empty after user returns | Ask user to click a style card in the browser |
   | Font missing in screenshot | Visual check shows fallback font | Embed font as base64 in @font-face in the HTML, retry |
   `;
   ```

- [ ] 5. Implement `src/templates/skills/codi-deck/index.ts`:
   ```typescript
   import { resolveStaticDir } from "../resolve-static-dir.js";

   export { template } from "./template.ts";

   export const staticDir = resolveStaticDir("codi-deck", import.meta.url);
   ```
   > **Note:** Use `./template.ts` (with `.ts` extension) for source compatibility, following the same pattern used by other skill index files in this directory.

   Wait — looking at brainstorming's index.ts, it uses `export { template } from "./template.js"` (`.js` extension for ESM). Use `.js`:
   ```typescript
   import { resolveStaticDir } from "../resolve-static-dir.js";

   export { template } from "./template.js";

   export const staticDir = resolveStaticDir("codi-deck", import.meta.url);
   ```

- [ ] 6. Verify test passes: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: 4 passing

- [ ] 7. Commit: `git add src/templates/skills/codi-deck/ tests/unit/templates/deck-skill.test.ts && git commit -m "feat(deck): add codi-deck skill template and index"`

**Verification**: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: all 4 tests passing

---

### Task 2: Write deck WebSocket helper (helper.js)

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/helper.js`
**Est**: 3 minutes

**Steps**:

- [ ] 1. No separate test needed — helper.js is a client-side script injected into HTML by server.cjs. It will be exercised by the server integration test in Task 3.

- [ ] 2. Implement `src/templates/skills/codi-deck/scripts/helper.js`:
   ```javascript
   (function () {
     'use strict';
     const WS_URL = 'ws://' + window.location.host;
     let ws = null;
     let queue = [];

     function connect() {
       ws = new WebSocket(WS_URL);
       ws.onopen = function () {
         queue.forEach(function (e) { ws.send(JSON.stringify(e)); });
         queue = [];
       };
       ws.onmessage = function (msg) {
         const d = JSON.parse(msg.data);
         if (d.type === 'reload') window.location.reload();
       };
       ws.onclose = function () { setTimeout(connect, 1000); };
     }

     function send(event) {
       event.timestamp = Date.now();
       if (ws && ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify(event));
       } else {
         queue.push(event);
       }
     }

     window.deck = {
       approve: function () {
         send({ type: 'approved', choice: 'approved' });
       },
       requestChanges: function (slideNum, note) {
         send({ type: 'change-request', slide: slideNum, note: note, choice: 'change-request' });
       },
       chooseStyle: function (style) {
         send({ type: 'style-chosen', choice: style });
       }
     };

     connect();
   })();
   ```

- [ ] 3. Commit: `git add src/templates/skills/codi-deck/scripts/helper.js && git commit -m "feat(deck): add deck WebSocket helper client"`

**Verification**: File exists at `src/templates/skills/codi-deck/scripts/helper.js` and is valid JavaScript.

---

### Task 3: Write server.cjs (extended brainstorming server, slides mode)

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/server.cjs`
**Est**: 5 minutes

**Steps**:

- [ ] 1. Write failing smoke test in `tests/unit/templates/deck-skill.test.ts` (append to existing file):
   ```typescript
   import { existsSync } from "node:fs";
   import { join, dirname } from "node:path";
   import { fileURLToPath } from "node:url";

   const __dirname2 = dirname(fileURLToPath(import.meta.url));
   const SKILL_SCRIPTS = join(__dirname2, "../../../src/templates/skills/codi-deck/scripts");

   describe("codi-deck server.cjs", () => {
     it("exports expected WebSocket functions", () => {
       // server.cjs must be loadable and export its protocol utilities
       // eslint-disable-next-line @typescript-eslint/no-require-imports
       const mod = require(join(SKILL_SCRIPTS, "server.cjs"));
       expect(typeof mod.computeAcceptKey).toBe("function");
       expect(typeof mod.encodeFrame).toBe("function");
       expect(typeof mod.decodeFrame).toBe("function");
     });

     it("server.cjs file is under 700 lines", async () => {
       const { readFileSync } = await import("node:fs");
       const content = readFileSync(join(SKILL_SCRIPTS, "server.cjs"), "utf-8");
       const lines = content.split("\n").length;
       expect(lines).toBeLessThanOrEqual(700);
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: server.cjs not found

- [ ] 3. Implement `src/templates/skills/codi-deck/scripts/server.cjs`:
   ```javascript
   'use strict';
   const crypto = require('crypto');
   const http = require('http');
   const fs = require('fs');
   const path = require('path');

   // ========== WebSocket Protocol (RFC 6455) ==========

   const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
   const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

   function computeAcceptKey(clientKey) {
     return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
   }

   function encodeFrame(opcode, payload) {
     const fin = 0x80;
     const len = payload.length;
     let header;
     if (len < 126) {
       header = Buffer.alloc(2);
       header[0] = fin | opcode;
       header[1] = len;
     } else if (len < 65536) {
       header = Buffer.alloc(4);
       header[0] = fin | opcode;
       header[1] = 126;
       header.writeUInt16BE(len, 2);
     } else {
       header = Buffer.alloc(10);
       header[0] = fin | opcode;
       header[1] = 127;
       header.writeBigUInt64BE(BigInt(len), 2);
     }
     return Buffer.concat([header, payload]);
   }

   function decodeFrame(buffer) {
     if (buffer.length < 2) return null;
     const secondByte = buffer[1];
     const opcode = buffer[0] & 0x0F;
     const masked = (secondByte & 0x80) !== 0;
     let payloadLen = secondByte & 0x7F;
     let offset = 2;
     if (!masked) throw new Error('Client frames must be masked');
     if (payloadLen === 126) {
       if (buffer.length < 4) return null;
       payloadLen = buffer.readUInt16BE(2);
       offset = 4;
     } else if (payloadLen === 127) {
       if (buffer.length < 10) return null;
       payloadLen = Number(buffer.readBigUInt64BE(2));
       offset = 10;
     }
     const maskOffset = offset;
     const dataOffset = offset + 4;
     const totalLen = dataOffset + payloadLen;
     if (buffer.length < totalLen) return null;
     const mask = buffer.slice(maskOffset, dataOffset);
     const data = Buffer.alloc(payloadLen);
     for (let i = 0; i < payloadLen; i++) {
       data[i] = buffer[dataOffset + i] ^ mask[i % 4];
     }
     return { opcode, payload: data, bytesConsumed: totalLen };
   }

   // ========== Configuration ==========

   const PORT = process.env.DECK_PORT || (49152 + Math.floor(Math.random() * 16383));
   const HOST = process.env.DECK_HOST || '127.0.0.1';
   const URL_HOST = process.env.DECK_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
   const SESSION_DIR = process.env.DECK_DIR || '/tmp/codi-deck';
   const DECK_MODE = process.env.DECK_MODE || 'slides';
   const SLIDES_DIR = path.join(SESSION_DIR, 'slides');
   const STATE_DIR = path.join(SESSION_DIR, 'state');
   let ownerPid = process.env.DECK_OWNER_PID ? Number(process.env.DECK_OWNER_PID) : null;

   const MIME_TYPES = {
     '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
     '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
     '.svg': 'image/svg+xml'
   };

   const helperScript = fs.readFileSync(path.join(__dirname, 'helper.js'), 'utf-8');
   const helperInjection = '<script>\n' + helperScript + '\n</script>';

   // ========== Slide Mode Helpers ==========

   function getSlideFiles() {
     if (!fs.existsSync(SLIDES_DIR)) return [];
     return fs.readdirSync(SLIDES_DIR)
       .filter(function (f) { return /^slide-\d+\.html$/.test(f); })
       .sort();
   }

   function getStyleFiles() {
     if (!fs.existsSync(SLIDES_DIR)) return [];
     return ['style-a.html', 'style-b.html', 'style-c.html']
       .filter(function (f) { return fs.existsSync(path.join(SLIDES_DIR, f)); });
   }

   function injectSlideNav(html, slideIndex, total) {
     const prevHref = slideIndex === 0 ? 'javascript:void(0)' : '/?slide=' + (slideIndex - 1);
     const nextHref = slideIndex >= total - 1 ? 'javascript:void(0)' : '/?slide=' + (slideIndex + 1);
     const prevStyle = slideIndex === 0 ? 'opacity:0.35;cursor:not-allowed;pointer-events:none' : 'cursor:pointer';
     const nextStyle = slideIndex >= total - 1 ? 'opacity:0.35;cursor:not-allowed;pointer-events:none' : 'cursor:pointer';
     const btn = 'background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:white;padding:5px 13px;border-radius:5px;font-size:13px;text-decoration:none;display:inline-block';
     const approveBtn = 'background:#22c55e;border:none;color:white;padding:5px 13px;border-radius:5px;font-size:13px;cursor:pointer;font-family:inherit';
     const changeBtn = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);color:white;padding:5px 13px;border-radius:5px;font-size:13px;cursor:pointer;font-family:inherit';
     const nav = '\n<div id="codi-nav" style="position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(6px);color:white;padding:9px 20px;display:flex;align-items:center;gap:9px;font-family:system-ui,sans-serif;font-size:13px;z-index:99999">'
       + '<a href="' + prevHref + '" style="' + btn + ';' + prevStyle + '">&#9664; Prev</a>'
       + '<span style="flex:1;text-align:center;opacity:0.7">' + (slideIndex + 1) + ' / ' + total + '</span>'
       + '<a href="' + nextHref + '" style="' + btn + ';' + nextStyle + '">Next &#9654;</a>'
       + '<span style="width:1px;height:20px;background:rgba(255,255,255,0.15);margin:0 3px"></span>'
       + '<button onclick="window.deck&&window.deck.approve()" style="' + approveBtn + '">&#10003; Approve Deck</button>'
       + '<button onclick="(function(){var n=prompt(\'Changes for slide ' + (slideIndex + 1) + '?\');if(n!==null&&window.deck)window.deck.requestChanges(' + (slideIndex + 1) + ',n)})()" style="' + changeBtn + '">&#9998; Request Change</button>'
       + '</div>';
     return html.includes('</body>') ? html.replace('</body>', nav + '\n</body>') : html + nav;
   }

   function renderStyleOptionsPage(styleFiles) {
     const cards = styleFiles.map(function (f) {
       const choice = f.replace('style-', '').replace('.html', '');
       const label = 'Style ' + choice.toUpperCase();
       return '<div class="sc" onclick="window.deck&&window.deck.chooseStyle(\'' + choice + '\')">'
         + '<div class="cp"><iframe src="/slides/' + f + '" scrolling="no" style="width:960px;height:540px;transform:scale(0.302);transform-origin:0 0;pointer-events:none;border:none"></iframe></div>'
         + '<div class="cl">' + label + '</div>'
         + '</div>';
     }).join('');
     return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Choose Style</title>'
       + '<style>*{box-sizing:border-box;margin:0;padding:0}'
       + 'body{font-family:system-ui,sans-serif;background:#111;color:white;min-height:100vh;display:flex;flex-direction:column}'
       + 'header{padding:18px 28px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:16px;font-weight:500;opacity:.8}'
       + '.grid{display:flex;gap:20px;padding:28px;justify-content:center;flex:1}'
       + '.sc{cursor:pointer;border:2px solid rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;transition:border-color .2s,transform .2s;width:290px}'
       + '.sc:hover{border-color:#3b82f6;transform:translateY(-3px)}'
       + '.cp{width:290px;height:181px;overflow:hidden;background:#1a1a1a;position:relative}'
       + '.cl{padding:10px 14px;font-size:13px;font-weight:500;text-align:center;border-top:1px solid rgba(255,255,255,0.08)}'
       + 'footer{padding:12px;text-align:center;font-size:11px;opacity:.4}'
       + '</style></head><body>'
       + '<header>Choose a style for your deck</header>'
       + '<div class="grid">' + cards + '</div>'
       + '<footer>Click a style, then return to the terminal</footer>'
       + '</body></html>';
   }

   const WAITING_PAGE = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Codi Deck</title>'
     + '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f0f;color:rgba(255,255,255,.5);}</style>'
     + '</head><body><p>Waiting for slides...</p></body></html>';

   // ========== HTTP Request Handler ==========

   function handleRequest(req, res) {
     touchActivity();
     const parsed = new URL(req.url, 'http://localhost');
     const pathname = parsed.pathname;

     if (req.method === 'GET' && pathname === '/') {
       let html;
       if (DECK_MODE === 'slides') {
         const styleFiles = getStyleFiles();
         if (styleFiles.length > 0) {
           html = renderStyleOptionsPage(styleFiles);
         } else {
           const slideFiles = getSlideFiles();
           if (slideFiles.length === 0) {
             html = WAITING_PAGE;
           } else {
             const rawIdx = parseInt(parsed.searchParams.get('slide') || '0', 10);
             const idx = Math.max(0, Math.min(isNaN(rawIdx) ? 0 : rawIdx, slideFiles.length - 1));
             let slideHtml = fs.readFileSync(path.join(SLIDES_DIR, slideFiles[idx]), 'utf-8');
             slideHtml = injectSlideNav(slideHtml, idx, slideFiles.length);
             if (slideHtml.includes('</body>')) {
               slideHtml = slideHtml.replace('</body>', helperInjection + '\n</body>');
             } else {
               slideHtml += helperInjection;
             }
             html = slideHtml;
           }
         }
         if (!html.includes(helperInjection) && html.includes('</body>')) {
           html = html.replace('</body>', helperInjection + '\n</body>');
         }
       } else {
         html = WAITING_PAGE;
       }
       res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
       res.end(html);
       return;
     }

     if (req.method === 'GET' && pathname.startsWith('/slides/')) {
       const filename = path.basename(pathname.slice(8));
       const filePath = path.join(SLIDES_DIR, filename);
       if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
       const ext = path.extname(filePath).toLowerCase();
       res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
       res.end(fs.readFileSync(filePath));
       return;
     }

     res.writeHead(404);
     res.end('Not found');
   }

   // ========== WebSocket Connection Handling ==========

   const clients = new Set();

   function handleUpgrade(req, socket) {
     const key = req.headers['sec-websocket-key'];
     if (!key) { socket.destroy(); return; }
     const accept = computeAcceptKey(key);
     socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
     let buffer = Buffer.alloc(0);
     clients.add(socket);
     socket.on('data', function (chunk) {
       buffer = Buffer.concat([buffer, chunk]);
       while (buffer.length > 0) {
         let result;
         try { result = decodeFrame(buffer); } catch (e) {
           socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
           clients.delete(socket);
           return;
         }
         if (!result) break;
         buffer = buffer.slice(result.bytesConsumed);
         switch (result.opcode) {
           case OPCODES.TEXT: handleMessage(result.payload.toString()); break;
           case OPCODES.CLOSE:
             socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
             clients.delete(socket);
             return;
           case OPCODES.PING: socket.write(encodeFrame(OPCODES.PONG, result.payload)); break;
           case OPCODES.PONG: break;
           default: {
             const cb = Buffer.alloc(2); cb.writeUInt16BE(1003);
             socket.end(encodeFrame(OPCODES.CLOSE, cb));
             clients.delete(socket);
             return;
           }
         }
       }
     });
     socket.on('close', function () { clients.delete(socket); });
     socket.on('error', function () { clients.delete(socket); });
   }

   const DECK_EVENT_TYPES = new Set(['approved', 'change-request', 'style-chosen']);

   function handleMessage(text) {
     let event;
     try { event = JSON.parse(text); } catch (e) { return; }
     touchActivity();
     console.log(JSON.stringify({ source: 'user-event', event: event }));
     if (event.choice || DECK_EVENT_TYPES.has(event.type)) {
       const eventsFile = path.join(STATE_DIR, 'events');
       fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
     }
   }

   function broadcast(msg) {
     const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
     for (const socket of clients) {
       try { socket.write(frame); } catch (e) { clients.delete(socket); }
     }
   }

   // ========== Activity Tracking ==========

   const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
   let lastActivity = Date.now();

   function touchActivity() { lastActivity = Date.now(); }

   // ========== Server Startup ==========

   const debounceTimers = new Map();

   function startServer() {
     if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });
     if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

     const knownFiles = new Set(fs.readdirSync(SLIDES_DIR).filter(function (f) { return f.endsWith('.html'); }));
     const server = http.createServer(handleRequest);
     server.on('upgrade', handleUpgrade);

     const watcher = fs.watch(SLIDES_DIR, function (eventType, filename) {
       if (!filename || !filename.endsWith('.html')) return;
       if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
       debounceTimers.set(filename, setTimeout(function () {
         debounceTimers.delete(filename);
         const filePath = path.join(SLIDES_DIR, filename);
         if (!fs.existsSync(filePath)) return;
         touchActivity();
         if (!knownFiles.has(filename)) {
           knownFiles.add(filename);
           console.log(JSON.stringify({ type: 'slide-added', file: filePath }));
         } else {
           console.log(JSON.stringify({ type: 'slide-updated', file: filePath }));
         }
         broadcast({ type: 'reload' });
       }, 100));
     });
     watcher.on('error', function (err) { console.error('fs.watch error:', err.message); });

     function shutdown(reason) {
       console.log(JSON.stringify({ type: 'server-stopped', reason: reason }));
       const infoFile = path.join(STATE_DIR, 'server-info');
       if (fs.existsSync(infoFile)) fs.unlinkSync(infoFile);
       fs.writeFileSync(path.join(STATE_DIR, 'server-stopped'), JSON.stringify({ reason: reason, timestamp: Date.now() }) + '\n');
       watcher.close();
       clearInterval(lifecycleCheck);
       server.close(function () { process.exit(0); });
     }

     function ownerAlive() {
       if (!ownerPid) return true;
       try { process.kill(ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
     }

     const lifecycleCheck = setInterval(function () {
       if (!ownerAlive()) shutdown('owner process exited');
       else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
     }, 60 * 1000);
     lifecycleCheck.unref();

     if (ownerPid) {
       try { process.kill(ownerPid, 0); } catch (e) {
         if (e.code !== 'EPERM') {
           console.log(JSON.stringify({ type: 'owner-pid-invalid', pid: ownerPid }));
           ownerPid = null;
         }
       }
     }

     server.listen(PORT, HOST, function () {
       const info = JSON.stringify({
         type: 'server-started', port: Number(PORT), host: HOST,
         url_host: URL_HOST, url: 'http://' + URL_HOST + ':' + PORT,
         slides_dir: SLIDES_DIR, state_dir: STATE_DIR
       });
       console.log(info);
       fs.writeFileSync(path.join(STATE_DIR, 'server-info'), info + '\n');
     });
   }

   if (require.main === module) startServer();

   module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: all tests passing

- [ ] 5. Commit: `git add src/templates/skills/codi-deck/scripts/server.cjs && git commit -m "feat(deck): add deck server with slides mode"`

**Verification**: `pnpm test tests/unit/templates/deck-skill.test.ts` — all tests passing; `wc -l src/templates/skills/codi-deck/scripts/server.cjs` — output <= 700

---

### Task 4: Write start-server.sh + stop-server.sh

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/start-server.sh`, `src/templates/skills/codi-deck/scripts/stop-server.sh`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Write smoke test in `tests/unit/templates/deck-skill.test.ts` (append):
   ```typescript
   describe("deck shell scripts", () => {
     it("start-server.sh is executable", () => {
       const scriptPath = join(SKILL_SCRIPTS, "start-server.sh");
       expect(existsSync(scriptPath)).toBe(true);
       const { statSync } = require("node:fs") as typeof import("node:fs");
       const mode = statSync(scriptPath).mode;
       expect(mode & 0o111).toBeGreaterThan(0); // at least one executable bit set
     });

     it("stop-server.sh is executable", () => {
       const scriptPath = join(SKILL_SCRIPTS, "stop-server.sh");
       expect(existsSync(scriptPath)).toBe(true);
       const { statSync } = require("node:fs") as typeof import("node:fs");
       const mode = statSync(scriptPath).mode;
       expect(mode & 0o111).toBeGreaterThan(0);
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: scripts not found

- [ ] 3. Implement `src/templates/skills/codi-deck/scripts/start-server.sh`:
   ```bash
   #!/usr/bin/env bash
   # Start the codi-deck slide server
   # Usage: start-server.sh [--project-dir <path>] [--host <host>] [--url-host <host>] [--foreground] [--background]

   SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

   PROJECT_DIR=""
   FOREGROUND="false"
   FORCE_BACKGROUND="false"
   BIND_HOST="127.0.0.1"
   URL_HOST=""

   while [[ $# -gt 0 ]]; do
     case "$1" in
       --project-dir) PROJECT_DIR="$2"; shift 2 ;;
       --host) BIND_HOST="$2"; shift 2 ;;
       --url-host) URL_HOST="$2"; shift 2 ;;
       --foreground|--no-daemon) FOREGROUND="true"; shift ;;
       --background|--daemon) FORCE_BACKGROUND="true"; shift ;;
       *) echo "{\"error\": \"Unknown argument: $1\"}"; exit 1 ;;
     esac
   done

   if [[ -z "$URL_HOST" ]]; then
     if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
       URL_HOST="localhost"
     else
       URL_HOST="$BIND_HOST"
     fi
   fi

   # Auto-foreground on environments that reap background processes
   if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
     FOREGROUND="true"
   fi
   if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
     case "${OSTYPE:-}" in msys*|cygwin*|mingw*) FOREGROUND="true" ;; esac
     if [[ -n "${MSYSTEM:-}" ]]; then FOREGROUND="true"; fi
   fi

   SESSION_ID="$$-$(date +%s)"
   if [[ -n "$PROJECT_DIR" ]]; then
     SESSION_DIR="${PROJECT_DIR}/.codi/deck/${SESSION_ID}"
   else
     SESSION_DIR="/tmp/codi-deck-${SESSION_ID}"
   fi

   STATE_DIR="${SESSION_DIR}/state"
   PID_FILE="${STATE_DIR}/server.pid"
   LOG_FILE="${STATE_DIR}/server.log"

   mkdir -p "${SESSION_DIR}/slides" "$STATE_DIR"

   if [[ -f "$PID_FILE" ]]; then
     old_pid=$(cat "$PID_FILE")
     kill "$old_pid" 2>/dev/null
     rm -f "$PID_FILE"
   fi

   cd "$SCRIPT_DIR" || exit

   OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
   if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
     OWNER_PID="$PPID"
   fi

   if [[ "$FOREGROUND" == "true" ]]; then
     echo "$$" > "$PID_FILE"
     env DECK_DIR="$SESSION_DIR" DECK_HOST="$BIND_HOST" DECK_URL_HOST="$URL_HOST" DECK_OWNER_PID="$OWNER_PID" DECK_MODE="slides" node server.cjs
     exit $?
   fi

   nohup env DECK_DIR="$SESSION_DIR" DECK_HOST="$BIND_HOST" DECK_URL_HOST="$URL_HOST" DECK_OWNER_PID="$OWNER_PID" DECK_MODE="slides" node server.cjs > "$LOG_FILE" 2>&1 &
   SERVER_PID=$!
   disown "$SERVER_PID" 2>/dev/null
   echo "$SERVER_PID" > "$PID_FILE"

   for _ in {1..50}; do
     if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
       alive="true"
       for _ in {1..20}; do
         if ! kill -0 "$SERVER_PID" 2>/dev/null; then alive="false"; break; fi
         sleep 0.1
       done
       if [[ "$alive" != "true" ]]; then
         echo "{\"error\": \"Server started but was killed. Retry with --foreground\"}"
         exit 1
       fi
       grep "server-started" "$LOG_FILE" | head -1
       exit 0
     fi
     sleep 0.1
   done

   echo '{"error": "Server failed to start within 5 seconds"}'
   exit 1
   ```

- [ ] 4. Implement `src/templates/skills/codi-deck/scripts/stop-server.sh`:
   ```bash
   #!/usr/bin/env bash
   # Stop the codi-deck slide server
   # Usage: stop-server.sh <session_dir>

   SESSION_DIR="$1"
   if [[ -z "$SESSION_DIR" ]]; then
     echo '{"error": "Usage: stop-server.sh <session_dir>"}'; exit 1
   fi

   STATE_DIR="${SESSION_DIR}/state"
   PID_FILE="${STATE_DIR}/server.pid"

   if [[ -f "$PID_FILE" ]]; then
     pid=$(cat "$PID_FILE")
     kill "$pid" 2>/dev/null || true
     for _ in {1..20}; do
       if ! kill -0 "$pid" 2>/dev/null; then break; fi
       sleep 0.1
     done
     if kill -0 "$pid" 2>/dev/null; then
       kill -9 "$pid" 2>/dev/null || true
       sleep 0.1
     fi
     if kill -0 "$pid" 2>/dev/null; then
       echo '{"status": "failed", "error": "process still running"}'; exit 1
     fi
     rm -f "$PID_FILE" "${STATE_DIR}/server.log"
     if [[ "$SESSION_DIR" == /tmp/* ]]; then rm -rf "$SESSION_DIR"; fi
     echo '{"status": "stopped"}'
   else
     echo '{"status": "not_running"}'
   fi
   ```

- [ ] 5. Make both scripts executable:
   ```bash
   chmod +x src/templates/skills/codi-deck/scripts/start-server.sh
   chmod +x src/templates/skills/codi-deck/scripts/stop-server.sh
   ```

- [ ] 6. Verify test passes: `pnpm test tests/unit/templates/deck-skill.test.ts` — expected: all tests passing

- [ ] 7. Commit: `git add src/templates/skills/codi-deck/scripts/start-server.sh src/templates/skills/codi-deck/scripts/stop-server.sh && git commit -m "feat(deck): add start/stop server scripts"`

**Verification**: `pnpm test tests/unit/templates/deck-skill.test.ts` — all tests passing

---

### Task 5: Write scripts/export/screenshot.ts

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/export/screenshot.ts`, `tests/unit/templates/deck-export.test.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Write failing test in `tests/unit/templates/deck-export.test.ts`:
   ```typescript
   import { describe, it, expect } from "vitest";

   describe("deck export scripts — module interface", () => {
     it("screenshot.ts exports captureSlideScreenshots function", async () => {
       const mod = await import(
         "#src/templates/skills/codi-deck/scripts/export/screenshot.js"
       );
       expect(typeof mod.captureSlideScreenshots).toBe("function");
     });
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: module not found

- [ ] 3. Implement `src/templates/skills/codi-deck/scripts/export/screenshot.ts`:
   ```typescript
   import { chromium } from "playwright";
   import { readdir, mkdir } from "node:fs/promises";
   import { join, resolve } from "node:path";
   import { fileURLToPath, pathToFileURL } from "node:url";

   export interface SlideScreenshot {
     slide: number;
     path: string;
   }

   export async function captureSlideScreenshots(
     slidesDir: string,
     outputDir: string,
   ): Promise<SlideScreenshot[]> {
     const absSlides = resolve(slidesDir);
     const absOutput = resolve(outputDir);
     await mkdir(absOutput, { recursive: true });

     const files = (await readdir(absSlides))
       .filter((f) => /^slide-\d+\.html$/.test(f))
       .sort();

     if (files.length === 0) {
       throw new Error(`No slide-NN.html files found in ${absSlides}`);
     }

     const browser = await chromium.launch();
     const screenshots: SlideScreenshot[] = [];

     for (const file of files) {
       const match = file.match(/^slide-(\d+)\.html$/);
       if (!match) continue;
       const slideNum = parseInt(match[1]!, 10);

       const page = await browser.newPage();
       await page.setViewportSize({ width: 960, height: 540 });
       await page.emulateMedia({ reducedMotion: "reduce" });
       await page.goto(pathToFileURL(join(absSlides, file)).href);
       await page.evaluate(() =>
       Promise.race([
         document.fonts.ready,
         new Promise<void>((resolve) => setTimeout(resolve, 5000)),
       ]),
     );

       const numStr = String(slideNum).padStart(2, "0");
       const outPath = join(absOutput, `slide-${numStr}.png`);
       await page.screenshot({ path: outPath, fullPage: false });
       await page.close();

       screenshots.push({ slide: slideNum, path: outPath });
     }

     await browser.close();
     return screenshots;
   }

   const isMain = process.argv[1] === fileURLToPath(import.meta.url);
   if (isMain) {
     const [, , slidesArg, outputArg] = process.argv;
     if (!slidesArg || !outputArg) {
       console.error("Usage: npx tsx screenshot.ts <slides-dir> <output-dir>");
       process.exit(1);
     }
     captureSlideScreenshots(slidesArg, outputArg)
       .then((shots) => {
         console.log(JSON.stringify({ screenshots: shots }));
       })
       .catch((err: unknown) => {
         console.error(err instanceof Error ? err.message : String(err));
         process.exit(1);
       });
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: 1 passing

- [ ] 5. Commit: `git add src/templates/skills/codi-deck/scripts/export/screenshot.ts tests/unit/templates/deck-export.test.ts && git commit -m "feat(deck): add screenshot export script"`

**Verification**: `pnpm test tests/unit/templates/deck-export.test.ts` — passing; `pnpm run lint` — no errors

---

### Task 6: Write scripts/export/to-pdf.ts

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/export/to-pdf.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Append failing test to `tests/unit/templates/deck-export.test.ts`:
   ```typescript
   it("to-pdf.ts exports buildPdfFromSlides function", async () => {
     const mod = await import(
       "#src/templates/skills/codi-deck/scripts/export/to-pdf.js"
     );
     expect(typeof mod.buildPdfFromSlides).toBe("function");
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: 1 failing (to-pdf not found)

- [ ] 3. Implement `src/templates/skills/codi-deck/scripts/export/to-pdf.ts`:
   ```typescript
   import { chromium } from "playwright";
   import { readdir, mkdir, writeFile } from "node:fs/promises";
   import { join, resolve, dirname } from "node:path";
   import { fileURLToPath, pathToFileURL } from "node:url";
   import { PDFDocument } from "pdf-lib";

   export async function buildPdfFromSlides(
     slidesDir: string,
     outputPath: string,
   ): Promise<void> {
     const absSlides = resolve(slidesDir);
     const absOutput = resolve(outputPath);
     await mkdir(dirname(absOutput), { recursive: true }).catch(() => undefined);

     const files = (await readdir(absSlides))
       .filter((f) => /^slide-\d+\.html$/.test(f))
       .sort();

     if (files.length === 0) {
       throw new Error(`No slide-NN.html files found in ${absSlides}`);
     }

     const browser = await chromium.launch();
     const merged = await PDFDocument.create();

     for (const file of files) {
       const page = await browser.newPage();
       await page.setViewportSize({ width: 960, height: 540 });
       await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
       await page.goto(pathToFileURL(join(absSlides, file)).href);
     await page.evaluate(() =>
       Promise.race([
         document.fonts.ready,
         new Promise<void>((resolve) => setTimeout(resolve, 5000)),
       ]),
     );

       const pdfBytes = await page.pdf({
         printBackground: true,
         width: "960px",
         height: "540px",
         pageRanges: "1",
       });
       await page.close();

       const single = await PDFDocument.load(pdfBytes);
       const [copiedPage] = await merged.copyPages(single, [0]);
       merged.addPage(copiedPage!);
     }

     await browser.close();
     const bytes = await merged.save();
     await writeFile(absOutput, bytes);
   }

   const isMain = process.argv[1] === fileURLToPath(import.meta.url);
   if (isMain) {
     const [, , slidesArg, outputArg] = process.argv;
     if (!slidesArg || !outputArg) {
       console.error("Usage: npx tsx to-pdf.ts <slides-dir> <output-path>");
       process.exit(1);
     }
     buildPdfFromSlides(slidesArg, outputArg)
       .then(() => {
         console.log(JSON.stringify({ status: "ok", output: outputArg }));
       })
       .catch((err: unknown) => {
         console.error(err instanceof Error ? err.message : String(err));
         process.exit(1);
       });
   }
   ```

- [ ] 4. Verify test passes: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: 2 passing

- [ ] 5. Commit: `git add src/templates/skills/codi-deck/scripts/export/to-pdf.ts && git commit -m "feat(deck): add PDF export script"`

**Verification**: `pnpm test tests/unit/templates/deck-export.test.ts` — 2 passing; `pnpm run lint` — no errors

---

### Task 7: Write scripts/export/agent-to-pptx.ts

- [ ] **Files**: `src/templates/skills/codi-deck/scripts/export/agent-to-pptx.ts`
**Est**: 3 minutes

**Steps**:

- [ ] 1. Append failing test to `tests/unit/templates/deck-export.test.ts`:
   ```typescript
   it("agent-to-pptx.ts exports runAgentPptx function", async () => {
     const mod = await import(
       "#src/templates/skills/codi-deck/scripts/export/agent-to-pptx.js"
     );
     expect(typeof mod.runAgentPptx).toBe("function");
   });

   it("runAgentPptx throws when build script does not exist", async () => {
     const { runAgentPptx } = await import(
       "#src/templates/skills/codi-deck/scripts/export/agent-to-pptx.js"
     );
     await expect(
       Promise.resolve().then(() => runAgentPptx("/tmp/nonexistent-build-pptx.ts"))
     ).rejects.toThrow("not found");
   });
   ```

- [ ] 2. Verify tests fail: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: 2 failing

- [ ] 3. Implement `src/templates/skills/codi-deck/scripts/export/agent-to-pptx.ts`:
   ```typescript
   import { execFileSync } from "node:child_process";
   import { existsSync } from "node:fs";
   import { resolve } from "node:path";
   import { fileURLToPath } from "node:url";

   export function runAgentPptx(buildScriptPath: string): void {
     const abs = resolve(buildScriptPath);
     if (!existsSync(abs)) {
       throw new Error(
         `build-pptx.ts not found at ${abs}. Generate it with the agent first.`,
       );
     }
     execFileSync("npx", ["tsx", abs], { stdio: "inherit" });
   }

   const isMain = process.argv[1] === fileURLToPath(import.meta.url);
   if (isMain) {
     const [, , buildArg] = process.argv;
     const buildScript = buildArg ?? "export/build-pptx.ts";
     try {
       runAgentPptx(buildScript);
       console.log(JSON.stringify({ status: "ok" }));
     } catch (err: unknown) {
       console.error(err instanceof Error ? err.message : String(err));
       process.exit(1);
     }
   }
   ```

- [ ] 4. Verify tests pass: `pnpm test tests/unit/templates/deck-export.test.ts` — expected: 4 passing

- [ ] 5. Commit: `git add src/templates/skills/codi-deck/scripts/export/agent-to-pptx.ts && git commit -m "feat(deck): add agent-to-pptx runner script"`

**Verification**: `pnpm test tests/unit/templates/deck-export.test.ts` — 4 passing; `pnpm run lint` — no errors

---

### Task 8: Write references/slide-authoring.md

- [ ] **Files**: `src/templates/skills/codi-deck/references/slide-authoring.md`
**Est**: 3 minutes

**Steps**:

- [ ] 1. No test required — this is a reference document consumed by agents at runtime.

- [ ] 2. Implement `src/templates/skills/codi-deck/references/slide-authoring.md`:
   ````markdown
   # HTML Slide Authoring Contract

   Every HTML slide the agent generates must follow this contract exactly.

   ## Required File Structure

   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <meta charset="utf-8">
     <style>
       /* Brand tokens as CSS custom properties */
       :root {
         --color-primary:   #001391;
         --color-bg:        #ffffff;
         --color-text:      #1A1A2A;
         --color-secondary: #4A4A68;
         --color-accent1:   #85C8FF;
         --color-accent2:   #88E783;
         --color-accent3:   #FFE761;
         --color-accent4:   #FFB56B;
         --font-headline:   'Source Serif 4', Georgia, serif;
         --font-body:       'Lato', Arial, sans-serif;
       }

       /* Slide root: always 960×540, overflow clipped */
       .slide {
         width: 960px;
         height: 540px;
         position: relative;
         overflow: hidden;
         background: var(--color-bg);
         font-family: var(--font-body);
         box-sizing: border-box;
       }
     </style>
   </head>
   <body>
     <div class="slide">
       <!-- All content inside .slide -->
     </div>
   </body>
   </html>
   ```

   ## Hard Rules

   - The `.slide` element is always exactly `960×540px` with `overflow: hidden`
   - All content positioned inside `.slide` — nothing outside the boundary
   - No external fetches: no CDN links, no `src="http://..."`, no `href="https://..."`
   - Brand assets (logos, icons) are **inlined** as `<svg>` elements
   - CSS custom properties define the brand palette — use variables, not raw hex
   - Fonts declared via `@font-face` with base64-encoded woff2, OR fall back to system fonts

   ## Slide Types

   | Type | Required Content | Key Visual Elements |
   |------|-----------------|---------------------|
   | `title` | Headline, subtitle | Large centered headline, subtitle, horizontal rule, author/date at bottom |
   | `divider` | Section heading | Colored background, large heading at bottom-left, section number top-right |
   | `section` | Heading + body | Breadcrumb at top, heading, body paragraph, optional bullet list, optional callout box |
   | `quote` | Quote text | Dark background, large opening quote mark, italic text, attribution at bottom |
   | `metrics` | 2-4 metrics | Colored stat boxes each showing a large value and label below |
   | `closing` | Message | Brand color background, centered message, contact line, logo |

   ## Style Iteration Files (Phase 1)

   Generate exactly 3 HTML files in `slides_dir`:
   - `style-a.html` — first style variant
   - `style-b.html` — second style variant
   - `style-c.html` — third style variant

   Each variant file contains 3 sample slides concatenated in one HTML document. The server renders all 3 in iframes for comparison.

   **One slide per style file:** Each style file must contain exactly ONE representative slide (recommended: the `section` type, as it shows the most design elements). The server renders each file in an iframe scaled to 302×181px. Only the first 302×181px of each file is visible, so do not concatenate multiple slides inside a style file.

   ## Full Deck Files (Phase 2)

   Generate `slide-01.html` through `slide-NN.html` — one slide per file.
   The server reads these files sorted by filename and serves them with Prev/Next navigation.

   ## Coordinate Guide (for PPTX reconstruction)

   When reading screenshots to generate pptxgenjs code:
   - Slide dimensions: 10" × 5.625" (maps from 960px × 540px at 96dpi)
   - 1 inch = 96px → scale factor = 1/96
   - Element at `left:35px` in CSS = `x: 0.365` in pptxgenjs (35/96 ≈ 0.365)
   - Element with `width:600px` = `w: 6.25` in pptxgenjs (600/96 = 6.25)
   - Colors: drop the `#` prefix — `#001391` → `001391`
   ````

- [ ] 3. Commit: `git add src/templates/skills/codi-deck/references/slide-authoring.md && git commit -m "feat(deck): add slide authoring contract reference"`

**Verification**: File exists and is readable.

---

### Task 9: Register skill in index.ts + skill-template-loader.ts

- [ ] **Files**: `src/templates/skills/index.ts`, `src/core/scaffolder/skill-template-loader.ts`, `tests/unit/scaffolder/skill-scaffolder.test.ts`
**Est**: 4 minutes

**Steps**:

- [ ] 1. Write failing test — append to `tests/unit/scaffolder/skill-scaffolder.test.ts` (inside the existing `describe` block):
   ```typescript
   it("creates a skill file with deck template", async () => {
     const result = await createSkill({
       name: "my-deck",
       configDir,
       template: prefixedName("deck"),
     });

     expect(result.ok).toBe(true);
     if (!result.ok) return;

     const content = await fs.readFile(result.data, "utf-8");
     expect(content).toContain("name: my-deck");
     expect(content).toContain("Phase 1");
     expect(content).toContain("Phase 2");
     expect(content).toContain("Phase 3");
   });
   ```

- [ ] 2. Verify test fails: `pnpm test tests/unit/scaffolder/skill-scaffolder.test.ts` — expected: template `codi-deck` not found

- [ ] 3. Add export to `src/templates/skills/index.ts` (insert after the `pptx` export line):
   ```typescript
   export {
     template as deckHtml,
     staticDir as deckHtmlStaticDir,
   } from "./codi-deck/index.js";
   ```
   > The export name `deckHtml` avoids collision with the existing `deckEngine` export.

- [ ] 4. Add entry to `src/core/scaffolder/skill-template-loader.ts`:

   In the `TEMPLATE_MAP` (after the `[prefixedName("pptx")]` line):
   ```typescript
   [prefixedName("deck")]: skillTemplates.deckHtml,
   ```

   In the `STATIC_DIR_MAP` (after the `[prefixedName("pptx")]` line):
   ```typescript
   [prefixedName("deck")]: skillTemplates.deckHtmlStaticDir,
   ```

- [ ] 5. Verify tests pass: `pnpm test tests/unit/scaffolder/skill-scaffolder.test.ts` — expected: new test passing

- [ ] 6. Run full unit suite to verify no regressions: `pnpm test:unit` — expected: all tests passing

- [ ] 7. Update the artifact version baseline (needed before release, optional for development):
   ```bash
   pnpm run baseline:update
   git add src/core/version/artifact-version-baseline.json
   ```

- [ ] 8. Commit: `git add src/templates/skills/index.ts src/core/scaffolder/skill-template-loader.ts tests/unit/scaffolder/skill-scaffolder.test.ts src/core/version/artifact-version-baseline.json && git commit -m "feat(deck): register codi-deck skill in template loader"`

**Verification**: `pnpm test:unit` — all tests passing; `pnpm run lint` — no TypeScript errors

---

## Post-Implementation Checklist

- [ ] `pnpm test:unit` — all passing
- [ ] `pnpm run lint` — no TypeScript errors
- [ ] Server smoke test: `DECK_DIR=/tmp/test-deck DECK_MODE=slides node src/templates/skills/codi-deck/scripts/server.cjs` — outputs `{"type":"server-started",...}` within 2s, then `Ctrl+C`
- [ ] `codi generate` — propagates new skill to `.claude/` config
- [ ] Verify `codi-deck` appears in `.claude/skills/codi-deck/SKILL.md`
