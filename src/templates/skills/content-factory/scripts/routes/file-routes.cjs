'use strict';
const fs = require('fs');
const path = require('path');
const state = require('../lib/project-state.cjs');
const workspace = require('../lib/workspace.cjs');
const { serveFile, sendJson } = require('../lib/http-utils.cjs');

/**
 * Routes that serve content files, static generator assets, vendor bundles,
 * and the app shell HTML. Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;
  // HEAD is semantically identical to GET for idempotent reads; treat
  // them the same so health probes (`curl -I`) and proxies don't 404
  // on a healthy server. Node's http module automatically drops the
  // body for HEAD responses so no extra work is needed.
  const isRead = req.method === 'GET' || req.method === 'HEAD';

  // /api/content?file=xxx GET — raw HTML or Markdown from active project's
  // content dir. Accepts relative paths that include platform subfolders
  // (e.g. "linkedin/carousel.html", "00-anchor.md"). Path-traversal guard
  // lives in workspace.resolveContentPath — any path that escapes
  // content/ resolves to null.
  if (isRead && pathname === '/api/content') {
    const fileParam = parsed.searchParams.get('file');
    const active = state.getActiveProject();
    if (!fileParam || !active) {
      res.writeHead(active ? 400 : 404);
      res.end(active ? 'Missing ?file=' : 'No active project');
      return true;
    }
    const filePath = workspace.resolveContentPath(active.dir, fileParam);
    if (!filePath) { res.writeHead(400); res.end('Invalid path'); return true; }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.md') {
      // Markdown is served raw — the client renders it via lib/markdown.js
      // so live-reload edits don't require a server round-trip beyond the
      // fetch itself.
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(raw);
      return true;
    }
    const injector = require('../lib/injector.cjs');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(injector.inject(raw));
    return true;
  }

  // /api/files GET — sorted list of HTML files in active project's content dir
  if (isRead && pathname === '/api/files') {
    const files = state.getContentFiles().map(f => f.name);
    sendJson(res, 200, files);
    return true;
  }

  // /static/* GET — serve generator app assets
  if (isRead && pathname.startsWith('/static/')) {
    const rel = pathname.slice(8);
    const filePath = path.resolve(ctx.GENERATORS_DIR, rel);
    if (!filePath.startsWith(ctx.GENERATORS_DIR + path.sep) && filePath !== ctx.GENERATORS_DIR) {
      res.writeHead(403); res.end('Forbidden'); return true;
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    serveFile(res, filePath);
    return true;
  }

  // /vendor/* GET — serve vendor scripts
  if (isRead && pathname.startsWith('/vendor/')) {
    const filePath = path.join(ctx.VENDOR_DIR, path.basename(pathname.slice(8)));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    serveFile(res, filePath);
    return true;
  }

  // / GET — serve app shell
  if (isRead && pathname === '/') {
    const appPath = path.join(ctx.GENERATORS_DIR, 'app.html');
    if (!fs.existsSync(appPath)) { res.writeHead(503); res.end('App not found'); return true; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(appPath, 'utf-8'));
    return true;
  }

  return false;
}

module.exports = { handle };
