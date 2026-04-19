'use strict';

// Box-layout validator wrapper — in-process, warm-browser, cached.
//
// Public API:
//   validateHtml(html, { width, height, preset, threshold, tolerance })
//   validateCard(project, file, cardIndex, cfg)
//   validateAllCards(project, file, cfg)
//   getHealth()
//   clearCache()
//   close()
//
// Graceful degradation: if playwright is not installed, every call
// returns { ok: true, skipped: "playwright-missing", installHint }.
// Higher layers treat skipped as pass.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { computeContext, applyPreset } = require('./box-layout/context.cjs');
const { annotate } = require('./box-layout/tree-walker.cjs');
const { runRules } = require('./box-layout/rule-engine.cjs');
const { buildReport } = require('./box-layout/report-builder.cjs');
const { CONTENT_TYPES, allCardClasses, typeForCardClass } = require('./content-types.cjs');

const DEFAULT_THRESHOLD = 0.85;
const MAX_CACHE_ENTRIES = 500;

const _cache = new Map(); // hash -> report
let _cacheHits = 0;
let _cacheMisses = 0;
let _latencyTotalMs = 0;
let _latencyCount = 0;
let _lastError = null;
let _degraded = null; // null = unknown, true/false = decided
let _queue = Promise.resolve();

// Injectable renderer — unit tests override with a fake that does not
// require playwright. Production loads the real renderer lazily.
let _rendererOverride = null;
function __setRenderer(renderer) {
  _rendererOverride = renderer;
  _degraded = null; // re-probe on next call
}
function __resetRenderer() {
  _rendererOverride = null;
  _degraded = null;
  _cache.clear();
  _cacheHits = 0;
  _cacheMisses = 0;
  _latencyTotalMs = 0;
  _latencyCount = 0;
  _lastError = null;
}

async function getRenderer() {
  if (_rendererOverride) return _rendererOverride;
  return require('./box-layout/renderer.cjs');
}

function hashKey({ html, width, height, preset, threshold, tolerance }) {
  return crypto
    .createHash('sha1')
    .update(String(width))
    .update('|')
    .update(String(height))
    .update('|')
    .update(String(preset || ''))
    .update('|')
    .update(String(threshold))
    .update('|')
    .update(String(tolerance ?? ''))
    .update('|')
    .update(html)
    .digest('hex');
}

function cacheGet(key) {
  if (_cache.has(key)) {
    _cacheHits += 1;
    return _cache.get(key);
  }
  _cacheMisses += 1;
  return null;
}

function cacheSet(key, value) {
  if (_cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }
  _cache.set(key, value);
}

function degradedResponse() {
  return {
    ok: true,
    skipped: 'playwright-missing',
    installHint: 'bash scripts/setup-validation.sh',
    valid: true,
    score: null,
    violations: [],
  };
}

async function probeRenderer() {
  if (_degraded !== null) return !_degraded;
  try {
    const renderer = await getRenderer();
    if (!renderer || typeof renderer.renderAndExtract !== 'function') {
      _degraded = true;
      return false;
    }
    // If the renderer exposes a playwright probe, actually try to load it.
    // Without this, renderer.cjs lazy-loads playwright inside renderAndExtract
    // and probeRenderer would incorrectly report healthy.
    if (typeof renderer.probePlaywright === 'function') {
      const ok = await renderer.probePlaywright();
      if (!ok) {
        _degraded = true;
        _lastError = 'playwright not installed';
        return false;
      }
    }
    _degraded = false;
    return true;
  } catch (e) {
    _degraded = true;
    _lastError = e.message;
    return false;
  }
}

// Detects the "playwright not installed" error (string match, since the
// error may bubble up from deep inside renderAndExtract). When it fires,
// we flip to degraded mode for subsequent calls and return a skipped
// response instead of an error.
function isMissingPlaywrightError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  return /playwright not installed/i.test(msg);
}

// Queue so only one validation runs at a time against the shared browser.
function enqueue(fn) {
  const result = _queue.then(fn, fn);
  _queue = result.catch(() => undefined);
  return result;
}

async function validateHtml(html, opts = {}) {
  const width = Number(opts.width) || 1080;
  const height = Number(opts.height) || 1080;
  const preset = opts.preset || null;
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : DEFAULT_THRESHOLD;
  const tolerance = opts.tolerance ?? null;

  const key = hashKey({ html, width, height, preset, threshold, tolerance });
  const cached = cacheGet(key);
  if (cached) return cached;

  const ok = await probeRenderer();
  if (!ok) {
    const result = degradedResponse();
    cacheSet(key, result);
    return result;
  }

  return enqueue(async () => {
    const start = Date.now();
    try {
      const renderer = await getRenderer();
      const rawTree = await renderer.renderAndExtract({ html, width, height });
      const overrides = applyPreset({ tolerance }, preset);
      // First pass to count nodes — we compute context from the raw
      // tree's node count before the full annotate pass uses it.
      const nodeCount = countNodes(rawTree);
      const context = computeContext({
        canvasWidth: width,
        canvasHeight: height,
        nodeCount,
        overrides,
      });
      const annotated = annotate(rawTree, context);
      const violations = runRules(annotated.root, annotated.siblingGroups, context);
      const report = buildReport({
        root: annotated.root,
        siblingGroups: annotated.siblingGroups,
        violations,
        threshold,
        context,
      });
      const full = {
        ok: true,
        pass: report.valid,
        score: report.score,
        threshold,
        violations: report.violations,
        summary: report.summary,
        fixInstructions: report.fixInstructions,
      };
      cacheSet(key, full);
      _latencyTotalMs += Date.now() - start;
      _latencyCount += 1;
      return full;
    } catch (e) {
      _lastError = e.message;
      // Defensive: if playwright vanished between probe and call, flip to
      // degraded and return a skipped response — higher layers treat skipped
      // as pass, not error.
      if (isMissingPlaywrightError(e)) {
        _degraded = true;
        const degraded = degradedResponse();
        cacheSet(key, degraded);
        return degraded;
      }
      const errResult = { ok: false, error: e.message };
      // Do NOT cache error responses — they may be transient.
      return errResult;
    }
  });
}

function countNodes(node) {
  let n = 1;
  if (node.children) {
    for (const c of node.children) n += countNodes(c);
  }
  return n;
}

async function validateCard(project, file, cardIndex, cfg = {}) {
  const contentPath = path.join(project, 'content', file);
  if (!fs.existsSync(contentPath)) {
    return { ok: false, error: 'file not found: ' + contentPath };
  }
  const rawHtml = fs.readFileSync(contentPath, 'utf-8');
  // The content file contains one or more card elements (social-card,
  // slide, or doc-page). We extract the Nth one and render it in isolation
  // inside a host shell matching its declared format.
  const { html, width, height } = extractCardHtml(rawHtml, cardIndex, cfg);
  if (!html) {
    return { ok: false, error: 'card index out of range: ' + cardIndex };
  }
  return validateHtml(html, {
    width,
    height,
    preset: cfg.preset,
    threshold: cfg.threshold,
    tolerance: cfg.tolerance,
  });
}

async function validateAllCards(project, file, cfg = {}) {
  const contentPath = path.join(project, 'content', file);
  if (!fs.existsSync(contentPath)) {
    return { ok: false, error: 'file not found: ' + contentPath };
  }
  const rawHtml = fs.readFileSync(contentPath, 'utf-8');
  const cards = extractAllCardsHtml(rawHtml, cfg);
  const reports = [];
  for (let i = 0; i < cards.length; i++) {
    const { html, width, height } = cards[i];
    const report = await validateHtml(html, {
      width,
      height,
      preset: cfg.preset,
      threshold: cfg.threshold,
      tolerance: cfg.tolerance,
    });
    reports.push({ cardIndex: i, ...report });
  }
  const anyFail = reports.some((r) => r.ok && r.pass === false);
  return {
    ok: true,
    pass: !anyFail,
    cards: reports,
    failingCards: reports.filter((r) => r.ok && r.pass === false),
  };
}

function extractCardHtml(rawHtml, cardIndex, cfg = {}) {
  const all = extractAllCardsHtml(rawHtml, cfg);
  return all[cardIndex] || { html: null };
}

// Derived from the canonical registry — no hardcoded lists.
const CARD_CLASSES = allCardClasses();
const DEFAULT_CANVAS = {};
for (const [, entry] of Object.entries(CONTENT_TYPES)) {
  DEFAULT_CANVAS[entry.cardClass] = entry.canvas;
}

function extractDeclaredFormat(rawHtml) {
  // A content file can declare its own canvas via
  // `<meta name="codi:template" content='{"format":{"w":...,"h":...}}'>`
  // or the legacy `<meta name="template-format" content="794x1123">`. The
  // validator must honor that declaration — otherwise R11 measures
  // against a generic default (e.g. 1240x1754) while the file itself is
  // authored for 794x1123, and real overflow (the one the PDF export
  // sees) slips through undetected.
  // The content attribute may be wrapped in `"` or `'` and contain the
  // opposite quote literally (e.g. `content='{"format":{"w":794,...}}'`).
  // Capture the opening quote and match up to the same closing quote, so
  // embedded quotes inside JSON don't prematurely terminate the match.
  const codiMeta = rawHtml.match(/<meta[^>]+name=["']codi:template["'][^>]*content=(["'])([\s\S]*?)\1/i);
  if (codiMeta) {
    try {
      const obj = JSON.parse(codiMeta[2].replace(/&quot;/g, '"'));
      const f = obj && obj.format;
      if (f && Number(f.w) > 0 && Number(f.h) > 0) return { w: Number(f.w), h: Number(f.h) };
    } catch { /* fall through to legacy meta */ }
  }
  const legacy = rawHtml.match(/<meta[^>]+name=["']template-format["'][^>]*content=(["'])([\s\S]*?)\1/i);
  if (legacy) {
    const m = legacy[2].match(/^\s*(\d+)\s*x\s*(\d+)\s*$/i);
    if (m) return { w: Number(m[1]), h: Number(m[2]) };
  }
  return null;
}

function extractAllCardsHtml(rawHtml, cfg = {}) {
  // Parse out each top-level card block. Supports <article|section> with any
  // recognized card class. We wrap each card in a minimal host document with
  // the declared canvas dimensions so computed styles reflect what the
  // browser would render inside the content-factory preview.
  //
  // Format resolution order (most specific wins):
  //   1. cfg.format      — explicit override from the caller (active format selector)
  //   2. file meta       — `codi:template` / `template-format` in the source
  //   3. DEFAULT_CANVAS  — type-level fallback (doc / slide / social)
  const formatOverride = cfg.format || null;
  const declared = formatOverride ? null : extractDeclaredFormat(rawHtml);

  // Pull out <style> blocks from the source — they apply to all cards.
  const styleMatches = [];
  const styleRe = /<style[^>]*>[\s\S]*?<\/style>/gi;
  let m;
  while ((m = styleRe.exec(rawHtml)) !== null) {
    styleMatches.push(m[0]);
  }

  // Pull out <link rel="stylesheet"> tags — apply to all cards.
  const linkMatches = [];
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  while ((m = linkRe.exec(rawHtml)) !== null) {
    linkMatches.push(m[0]);
  }

  // Match <article|section class="… (social-card|slide|doc-page) …">…</…>
  const classAlt = CARD_CLASSES.join('|');
  const cardRe = new RegExp(
    '<(article|section)\\b[^>]*class\\s*=\\s*["\'][^"\']*\\b(' +
      classAlt +
      ')\\b[^"\']*["\'][^>]*>[\\s\\S]*?<\\/\\1>',
    'gi',
  );
  const cards = [];
  while ((m = cardRe.exec(rawHtml)) !== null) {
    const articleHtml = m[0];
    const cardClass = m[2];
    const defaults = DEFAULT_CANVAS[cardClass] || DEFAULT_CANVAS['social-card'];
    const source = formatOverride || declared || defaults;
    const width = source.w;
    const height = source.h;
    const hostHtml = buildHostHtml(articleHtml, styleMatches, linkMatches, width, height, cardClass);
    cards.push({ html: hostHtml, width, height, cardClass });
  }
  return cards;
}

function buildHostHtml(article, styles, links, width, height, cardClass) {
  // Pin the canvas-root to the declared format exactly and force
  // `overflow: hidden` on it. Templates often declare
  // `overflow: visible` so authors can see content bleed during editing,
  // but when the canvas-root is overflow:visible, `scrollHeight` equals
  // `clientHeight` and R11 cannot detect any overflow. Forcing hidden
  // here makes `scrollHeight` report the full content height, so the
  // difference `scrollHeight - clientHeight` is the actual overflow.
  // The margin reset catches templates that apply layout margin to the
  // canvas-root (e.g. `.doc-page { margin: 24px auto }`).
  const size = cardClass === 'doc-page'
    ? `.doc-page { width: ${width}px !important; height: ${height}px !important; overflow: hidden !important; }`
    : `.${cardClass || 'social-card'} { width: ${width}px !important; height: ${height}px !important; overflow: hidden !important; }`;
  const head = [
    '<meta charset="utf-8">',
    ...links,
    '<style>',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    `html, body { width: ${width}px; height: ${height}px; position: relative; overflow: hidden; }`,
    `:root { --w: ${width}px; --h: ${height}px; }`,
    '.social-card, .slide, .doc-page { margin: 0 !important; }',
    size,
    '</style>',
    ...styles,
  ].join('\n');
  return `<!DOCTYPE html><html><head>${head}</head><body>${article}</body></html>`;
}

function getHealth() {
  return {
    degraded: _degraded === true,
    workers: 1,
    cacheSize: _cache.size,
    cacheHits: _cacheHits,
    cacheMisses: _cacheMisses,
    avgLatencyMs: _latencyCount ? Math.round(_latencyTotalMs / _latencyCount) : null,
    lastError: _lastError,
  };
}

function clearCache() {
  _cache.clear();
  _cacheHits = 0;
  _cacheMisses = 0;
}

async function close() {
  try {
    if (!_rendererOverride) {
      const renderer = await getRenderer();
      if (renderer && typeof renderer.closeBrowser === 'function') {
        await renderer.closeBrowser();
      }
    }
  } catch { /* best-effort browser cleanup on shutdown */ }
}

module.exports = {
  validateHtml,
  validateCard,
  validateAllCards,
  getHealth,
  clearCache,
  close,
  // Test hooks
  __setRenderer,
  __resetRenderer,
};
