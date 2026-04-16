'use strict';
/**
 * bundle.cjs — HTML bundle export handler.
 *
 * Produces a standalone, self-contained HTML file from the currently active
 * source (project content file, My Work session file, or Gallery template).
 *
 * Pipeline (matches the canonical compile-deck.js behaviour so the exported
 * bundle is byte-equivalent to the 3-file reference pattern merged):
 *
 *   1. Resolve source file from explicit payload or server state
 *   2. bundleHtml()   — inline <link rel="stylesheet"> and <script src> refs
 *                       relative to the source file's directory
 *   3. inlineFonts()  — base64-encode @font-face url() references
 *   4. inlineImages() — base64-encode <img src> references
 *   5. inlineBundleAssets() — resolve /api/brand, /vendor, /static URLs
 *                             (server-relative paths the compile-deck lib
 *                             doesn't know about)
 *   6. Legacy fallback: if source is a slide deck but lacks an inline deck
 *      engine, inject canonical slides-base.css + slides-base.js verbatim
 *      from disk (the Codi equivalent of the BBVA reference files)
 *
 * Principle: source authored per the reference pattern → bundle is a pure
 * passthrough. Legacy files get a principled, canonical-files fallback —
 * never a synthesized mini-engine.
 */

const fs = require('fs');
const path = require('path');

const { bundleHtml } = require('../export/lib/bundle-html.js');
const { inlineFonts, inlineImages } = require('../export/lib/inline-assets.js');

// ── Server-relative asset resolution (filesystem-backed) ────────────────────
//
// The compile-deck library handles filesystem-relative hrefs (deck.css, etc).
// This module adds resolution for the content-factory server's own URL
// patterns: /api/brand/<name>/assets/<rel>, /vendor/<rel>, /static/<rel>.
// Each URL is a deterministic token that can't collide with other content,
// so we use exact substring replacement — no HTML parsing.

const { MIME_TYPES: MIME_BY_EXT } = require('./http-utils.cjs');

function fileToDataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
  return 'data:' + mime + ';base64,' + fs.readFileSync(filePath).toString('base64');
}

const URL_DELIM = '[^"\'`()\\s<>]';
const ASSET_URL_PATTERNS = [
  new RegExp('/api/brand/[a-zA-Z0-9._-]+/assets/' + URL_DELIM + '+', 'g'),
  new RegExp('/vendor/' + URL_DELIM + '+', 'g'),
  new RegExp('/static/' + URL_DELIM + '+', 'g'),
];

function resolveBrandAsset(url, ctx) {
  const m = url.match(/^\/api\/brand\/([^/]+)\/assets\/(.+)$/);
  if (!m) return null;
  const brand = ctx.discoverBrands().find(b => b.name === m[1]);
  if (!brand) return null;
  const root = path.join(brand.dir, 'assets');
  const resolved = path.normalize(path.join(root, m[2]));
  return resolved.startsWith(root + path.sep) || resolved === root ? resolved : null;
}

function resolveVendorAsset(url, ctx) {
  const m = url.match(/^\/vendor\/(.+)$/);
  return m ? path.join(ctx.VENDOR_DIR, path.basename(m[1])) : null;
}

function resolveStaticAsset(url, ctx) {
  const m = url.match(/^\/static\/(.+)$/);
  if (!m) return null;
  const resolved = path.resolve(ctx.GENERATORS_DIR, m[1]);
  return resolved.startsWith(ctx.GENERATORS_DIR + path.sep) || resolved === ctx.GENERATORS_DIR ? resolved : null;
}

function resolveAssetUrl(url, ctx) {
  return resolveBrandAsset(url, ctx) || resolveVendorAsset(url, ctx) || resolveStaticAsset(url, ctx);
}

function inlineBundleAssets(html, ctx) {
  const uniqueUrls = new Set();
  for (const pattern of ASSET_URL_PATTERNS) {
    const matches = html.match(pattern);
    if (matches) for (const u of matches) uniqueUrls.add(u);
  }
  if (uniqueUrls.size === 0) return html;

  let out = html;
  for (const url of uniqueUrls) {
    try {
      const filePath = resolveAssetUrl(url, ctx);
      if (!filePath || !fs.existsSync(filePath)) continue;
      out = out.split(url).join(fileToDataUri(filePath));
    } catch {
      /* skip unresolvable — keep original URL */
    }
  }
  return out;
}

// ── Canonical deck engine inlining (legacy fallback) ────────────────────────
//
// When a source HTML is a slide deck but was NOT generated per the reference
// pattern (no .animate-in markers, no inline navigation engine), we inline
// the canonical slides-base.css and slides-base.js from disk verbatim.
//
// This matches the BBVA reference model: the deck.css + deck.js files that
// ship alongside deck.html, merged into a single standalone document.
// The canonical files themselves are the source of truth — if they change,
// every future bundle reflects the change automatically.

function isSlideDeck(html) {
  if (/<meta\s+name=["']codi:template["'][^>]*"type"\s*:\s*"slides"/i.test(html)) return true;
  if (/<(?:article|section|div)\s[^>]*class=["'][^"']*\bslide\b[^"']*["'][^>]*\bdata-type=/i.test(html)) return true;
  return false;
}

function hasCanonicalDeckEngine(html) {
  // Canonical slides-base.js contains this signature verbatim — searching
  // for it catches both inlined and <script src> references that have
  // already been bundled by bundleHtml().
  if (html.includes("document.querySelectorAll('.slide')") &&
      /document\.addEventListener\s*\(\s*['"]keydown['"]/i.test(html)) {
    return true;
  }
  return false;
}

function readCanonicalFile(ctx, name) {
  const filePath = path.join(ctx.GENERATORS_DIR, name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function injectChromeElements(html) {
  // The canonical slides-base.js expects #progressBar and #slideCounter
  // elements. If the source doesn't have them, inject minimal ones right
  // after <body> so the progress bar and counter render.
  if (/id=["']progressBar["']/.test(html) && /id=["']slideCounter["']/.test(html)) return html;
  const chrome =
    '<div class="progress-bar" id="progressBar"></div>\n' +
    '<span class="slide-counter" id="slideCounter"></span>\n';
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, '<body$1>\n' + chrome);
  }
  return chrome + html;
}

// Specificity booster + legacy animation fallback.
//
// Specificity problem: author CSS often uses compound selectors like
// `article.slide { display: flex }` (specificity 0,1,1). The canonical
// `.slide { display: none }` is only 0,1,0, so author wins and every slide
// renders at once. `html body .slide` is 0,1,2 → beats any tag+class.
//
// Animation problem: the canonical animation system requires `.animate-in`
// markers on children. Legacy sources lack these, so navigation works but
// nothing animates. We add a CSS-transition-based opacity fade on direct
// children of the active slide that fires automatically on every class
// toggle — no JS replay, no transform conflicts (opacity-only keeps any
// existing child transforms intact).
const DECK_SPECIFICITY_BOOSTER =
  '/* Bundle-time specificity booster — wins over article.slide, section.slide, etc. */\n' +
  'html body .slide { display: none; }\n' +
  'html body .slide.active { display: flex; flex-direction: column; }\n' +
  '\n' +
  '/* Legacy animation fallback — fires on class toggle when author omitted .animate-in markers. */\n' +
  'html body .slide > * { opacity: 0; transition: opacity 560ms cubic-bezier(0.22, 1, 0.36, 1); }\n' +
  'html body .slide.active > * { opacity: 1; }\n' +
  'html body .slide.active > *:nth-child(1) { transition-delay: 140ms; }\n' +
  'html body .slide.active > *:nth-child(2) { transition-delay: 220ms; }\n' +
  'html body .slide.active > *:nth-child(3) { transition-delay: 300ms; }\n' +
  'html body .slide.active > *:nth-child(4) { transition-delay: 380ms; }\n' +
  'html body .slide.active > *:nth-child(5) { transition-delay: 460ms; }\n' +
  'html body .slide.active > *:nth-child(6) { transition-delay: 540ms; }\n' +
  'html body .slide.active > *:nth-child(7) { transition-delay: 620ms; }\n' +
  'html body .slide.active > *:nth-child(n+8) { transition-delay: 700ms; }\n' +
  '@media (prefers-reduced-motion: reduce) {\n' +
  '  html body .slide > *, html body .slide.active > * { transition: none; }\n' +
  '}\n';

function injectCanonicalDeckEngine(html, ctx) {
  if (!isSlideDeck(html)) return html;
  if (hasCanonicalDeckEngine(html)) return html;

  const css = readCanonicalFile(ctx, 'slides-base.css');
  const js = readCanonicalFile(ctx, 'slides-base.js');
  if (!css || !js) return html;

  let out = injectChromeElements(html);

  const styleTag =
    '\n<style data-codi="canonical-deck-engine">\n' + css + '\n</style>\n' +
    '<style data-codi="canonical-deck-engine-booster">\n' + DECK_SPECIFICITY_BOOSTER + '</style>\n';
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, styleTag + '</head>');
  } else {
    out = styleTag + out;
  }

  const scriptTag = '\n<script data-codi="canonical-deck-engine">\n' + js + '\n</script>\n';
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, scriptTag + '</body>');
  } else {
    out = out + scriptTag;
  }

  return out;
}

// ── Source file resolution ──────────────────────────────────────────────────

function resolveActiveSource(ctx) {
  const { activeProject, GENERATORS_DIR } = ctx;
  if (activeProject) {
    const statePath = path.join(activeProject.stateDir, 'active.json');
    if (fs.existsSync(statePath)) {
      try {
        const active = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        if (active.file) {
          return {
            filePath: path.join(activeProject.contentDir, path.basename(active.file)),
            baseName: path.basename(active.file, path.extname(active.file)) || 'bundle',
          };
        }
      } catch { /* fall through */ }
    }
  }
  const workspaceStatePath = path.join(ctx.WORKSPACE_DIR, '_state', 'active.json');
  if (fs.existsSync(workspaceStatePath)) {
    try {
      const active = JSON.parse(fs.readFileSync(workspaceStatePath, 'utf-8'));
      if (active.preset) {
        return {
          filePath: path.join(GENERATORS_DIR, 'templates', active.preset + '.html'),
          baseName: active.preset,
        };
      }
    } catch { /* ignore */ }
  }
  return null;
}

function resolveSourceFromPayload(payload, ctx) {
  if (!payload || typeof payload !== 'object') return null;
  const { source, file, brand, sessionDir } = payload;

  if (source === 'template' && file) {
    let filePath;
    if (brand) {
      const b = ctx.discoverBrands().find(x => x.name === brand);
      if (!b) return null;
      filePath = path.join(b.dir, 'templates', path.basename(file));
    } else {
      filePath = path.join(ctx.GENERATORS_DIR, 'templates', path.basename(file));
    }
    return { filePath, baseName: path.basename(file, path.extname(file)) };
  }

  if (source === 'session' && sessionDir && file) {
    const resolved = path.normalize(path.resolve(sessionDir));
    const ws = path.normalize(ctx.WORKSPACE_DIR);
    if (!resolved.startsWith(ws + path.sep)) return null;
    return {
      filePath: path.join(resolved, 'content', path.basename(file)),
      baseName: path.basename(file, path.extname(file)),
    };
  }

  if (source === 'content' && file && ctx.activeProject) {
    return {
      filePath: path.join(ctx.activeProject.contentDir, path.basename(file)),
      baseName: path.basename(file, path.extname(file)),
    };
  }

  return null;
}

// ── Request handler ─────────────────────────────────────────────────────────

function handleExportHtmlBundle(req, res, ctx) {
  let body = '';
  req.on('data', d => { body += d; });
  return new Promise(resolve => {
    req.on('end', () => {
      try {
        let src = null;
        if (body) {
          let payload;
          try { payload = JSON.parse(body); } catch { payload = null; }
          src = resolveSourceFromPayload(payload, ctx);
        }
        if (!src) src = resolveActiveSource(ctx);

        if (!src) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No active source to export' }));
          return resolve();
        }
        if (!fs.existsSync(src.filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Source file not found', path: src.filePath }));
          return resolve();
        }

        const sourceDir = path.dirname(src.filePath);
        let html = fs.readFileSync(src.filePath, 'utf-8');

        // Canonical compile-deck pipeline: inline sibling files, fonts, images
        html = bundleHtml(html, sourceDir);
        html = inlineFonts(html, sourceDir);
        html = inlineImages(html, sourceDir);

        // Server-relative assets (/api/brand, /vendor, /static)
        html = inlineBundleAssets(html, ctx);

        // Legacy fallback: inline canonical engine if source lacks it
        html = injectCanonicalDeckEngine(html, ctx);

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'attachment; filename="' + src.baseName + '.html"',
          'Cache-Control': 'no-store',
        });
        res.end(html);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      resolve();
    });
  });
}

module.exports = { handleExportHtmlBundle };
