'use strict';
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache', 'Expires': '0',
  });
  res.end(fs.readFileSync(filePath));
}

function readJson(filePath, fallback) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : fallback; }
  catch { return fallback; }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req, limitOrCb, maybeCb) {
  const limit = typeof limitOrCb === 'number' ? limitOrCb : 0;
  const callback = typeof limitOrCb === 'function' ? limitOrCb : maybeCb;
  let total = 0;
  let destroyed = false;
  const chunks = [];
  req.on('data', (chunk) => {
    if (destroyed) return;
    total += chunk.length;
    if (limit > 0 && total > limit) {
      destroyed = true;
      req.destroy();
      callback(new Error('body too large'), null);
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (destroyed) return;
    try { callback(null, JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
    catch (e) { callback(e, null); }
  });
}

module.exports = { MIME_TYPES, serveFile, readJson, sendJson, readJsonBody };
