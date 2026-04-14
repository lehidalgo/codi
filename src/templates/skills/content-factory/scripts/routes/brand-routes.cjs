'use strict';
const fs = require('fs');
const path = require('path');
const state = require('../lib/project-state.cjs');
const { discoverBrands } = require('../lib/brand-discovery.cjs');
const { MIME_TYPES, sendJson, readJsonBody } = require('../lib/http-utils.cjs');

const META_PATTERNS = [
  /<meta[^>]+name=["']codi:template["'][^>]*content='([^']+)'/i,
  /<meta[^>]+name=["']codi:template["'][^>]*content="([^"]+)"/i,
  /<meta[^>]+content='([^']+)'[^>]*name=["']codi:template["']/i,
  /<meta[^>]+content="([^"]+)"[^>]*name=["']codi:template["']/i,
];

function extractTemplateMeta(html) {
  for (const re of META_PATTERNS) {
    const m = html.match(re);
    if (m) return JSON.parse(m[1]);
  }
  return {};
}

/**
 * Routes that discover brand skills, list gallery templates, and serve
 * brand asset files (logos, fonts) via `/api/brand/:name/assets/*`.
 * Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;

  // /api/brands GET — list available brand skills
  if (req.method === 'GET' && pathname === '/api/brands') {
    const brands = discoverBrands(ctx.SKILLS_DIR).map(b => ({
      name: b.name, dir: b.dir, display_name: b.display_name, version: b.version,
    }));
    sendJson(res, 200, brands);
    return true;
  }

  // /api/active-brand POST
  if (req.method === 'POST' && pathname === '/api/active-brand') {
    readJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const { name } = body || {};
      if (!name) {
        state.setActiveBrand(null);
        sendJson(res, 200, { ok: true, activeBrand: null });
        return;
      }
      const found = discoverBrands(ctx.SKILLS_DIR).find(b => b.name === name);
      if (!found) { res.writeHead(404); res.end('Brand not found'); return; }
      state.setActiveBrand(found);
      sendJson(res, 200, { ok: true, activeBrand: { name: found.name, display_name: found.display_name } });
    });
    return true;
  }

  // /api/templates GET — built-in templates + brand-skill templates with metadata
  if (req.method === 'GET' && pathname === '/api/templates') {
    const entries = [];
    const builtinDir = path.join(ctx.GENERATORS_DIR, 'templates');
    if (fs.existsSync(builtinDir)) {
      for (const file of fs.readdirSync(builtinDir).filter(f => f.endsWith('.html')).sort()) {
        entries.push({ file, dir: builtinDir, brand: null });
      }
    }
    for (const brand of discoverBrands(ctx.SKILLS_DIR)) {
      const brandTemplatesDir = path.join(brand.dir, 'templates');
      if (!fs.existsSync(brandTemplatesDir)) continue;
      for (const file of fs.readdirSync(brandTemplatesDir).filter(f => f.endsWith('.html')).sort()) {
        entries.push({ file, dir: brandTemplatesDir, brand: brand.name });
      }
    }
    const results = [];
    for (const entry of entries) {
      const filePath = path.join(entry.dir, entry.file);
      try {
        const html = fs.readFileSync(filePath, 'utf-8');
        const meta = extractTemplateMeta(html);
        const base = path.basename(entry.file, '.html');
        const id = entry.brand ? `${entry.brand}--${base}` : base;
        results.push({
          id: meta.id || id,
          name: meta.name || base,
          type: meta.type || 'social',
          format: meta.format || { w: 1080, h: 1080 },
          file: entry.file,
          brand: entry.brand,
          url: entry.brand
            ? `/api/template?brand=${encodeURIComponent(entry.brand)}&file=${encodeURIComponent(entry.file)}`
            : `/api/template?file=${encodeURIComponent(entry.file)}`,
        });
      } catch { /* skip unreadable files */ }
    }
    sendJson(res, 200, results);
    return true;
  }

  // /api/template?file=xxx[&brand=yyy] GET — serve a template HTML file
  if (req.method === 'GET' && pathname === '/api/template') {
    const fileParam = parsed.searchParams.get('file');
    const brandParam = parsed.searchParams.get('brand');
    if (!fileParam) { res.writeHead(400); res.end('Missing ?file='); return true; }
    let filePath;
    if (brandParam) {
      const brand = discoverBrands(ctx.SKILLS_DIR).find(b => b.name === brandParam);
      if (!brand) { res.writeHead(404); res.end('Brand not found'); return true; }
      filePath = path.join(brand.dir, 'templates', path.basename(fileParam));
    } else {
      filePath = path.join(ctx.GENERATORS_DIR, 'templates', path.basename(fileParam));
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return true;
  }

  // /api/brand/:name/assets/* GET — serve static files from a brand skill's assets/ directory
  const brandAssetMatch = pathname.match(/^\/api\/brand\/([^/]+)\/assets\/(.+)$/);
  if (req.method === 'GET' && brandAssetMatch) {
    const brandName = brandAssetMatch[1];
    const assetRel  = brandAssetMatch[2];
    const brand = discoverBrands(ctx.SKILLS_DIR).find(b => b.name === brandName);
    if (!brand) { res.writeHead(404); res.end('Brand not found'); return true; }
    const assetsRoot = path.join(brand.dir, 'assets');
    const filePath   = path.normalize(path.join(assetsRoot, assetRel));
    if (!filePath.startsWith(assetsRoot + path.sep) && filePath !== assetsRoot) {
      res.writeHead(403); res.end('Forbidden'); return true;
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Asset not found'); return true; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(fs.readFileSync(filePath));
    return true;
  }

  return false;
}

module.exports = { handle };
