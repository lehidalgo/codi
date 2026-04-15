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
    _degraded = false;
    return true;
  } catch (e) {
    _degraded = true;
    _lastError = e.message;
    return false;
  }
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
  // The content file contains one or more <article class="social-card">
  // elements. We extract the Nth one and render it in isolation inside
  // a host shell matching its declared format.
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

function extractAllCardsHtml(rawHtml, cfg = {}) {
  // Parse out each <article class="social-card">...</article> block.
  // We wrap each card in a minimal host document with the declared canvas
  // dimensions so computed styles reflect what the browser would render
  // inside the content-factory preview.
  const width = (cfg.format && cfg.format.w) || 1080;
  const height = (cfg.format && cfg.format.h) || 1080;

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

  // Find each <article class="social-card"> block.
  const cards = [];
  const articleRe = /<article\b[^>]*class\s*=\s*["'][^"']*\bsocial-card\b[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;
  while ((m = articleRe.exec(rawHtml)) !== null) {
    const articleHtml = m[0];
    const hostHtml = buildHostHtml(articleHtml, styleMatches, linkMatches, width, height);
    cards.push({ html: hostHtml, width, height });
  }
  return cards;
}

function buildHostHtml(article, styles, links, width, height) {
  const head = [
    '<meta charset="utf-8">',
    ...links,
    '<style>',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
    `html, body { width: ${width}px; height: ${height}px; position: relative; overflow: hidden; }`,
    `:root { --w: ${width}px; --h: ${height}px; }`,
    `.social-card { width: ${width}px !important; height: ${height}px !important; }`,
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
  } catch {}
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
