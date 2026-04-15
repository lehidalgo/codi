'use strict';
const fs = require('fs');
const path = require('path');
const state = require('../lib/project-state.cjs');
const { serveFile, sendJson } = require('../lib/http-utils.cjs');

/**
 * Routes that serve content files, static generator assets, vendor bundles,
 * and the app shell HTML. Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;

  // /api/content?file=xxx GET — raw HTML from active project's content dir
  if (req.method === 'GET' && pathname === '/api/content') {
    const fileParam = parsed.searchParams.get('file');
    const active = state.getActiveProject();
    if (!fileParam || !active) {
      res.writeHead(active ? 400 : 404);
      res.end(active ? 'Missing ?file=' : 'No active project');
      return true;
    }
    const filePath = path.join(active.contentDir, path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    const injector = require('../lib/injector.cjs');
    const raw = fs.readFileSync(filePath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(injector.inject(raw));
    return true;
  }

  // /api/files GET — sorted list of HTML files in active project's content dir
  if (req.method === 'GET' && pathname === '/api/files') {
    const files = state.getContentFiles().map(f => f.name);
    sendJson(res, 200, files);
    return true;
  }

  // /static/* GET — serve generator app assets
  if (req.method === 'GET' && pathname.startsWith('/static/')) {
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
  if (req.method === 'GET' && pathname.startsWith('/vendor/')) {
    const filePath = path.join(ctx.VENDOR_DIR, path.basename(pathname.slice(8)));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    serveFile(res, filePath);
    return true;
  }

  // / GET — serve app shell
  if (req.method === 'GET' && pathname === '/') {
    const appPath = path.join(ctx.GENERATORS_DIR, 'app.html');
    if (!fs.existsSync(appPath)) { res.writeHead(503); res.end('App not found'); return true; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(appPath, 'utf-8'));
    return true;
  }

  return false;
}

module.exports = { handle };
