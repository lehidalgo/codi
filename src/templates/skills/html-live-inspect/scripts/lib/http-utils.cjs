'use strict';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function mimeFor(ext) {
  return MIME_TYPES[String(ext).toLowerCase()] || 'application/octet-stream';
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...NO_CACHE_HEADERS,
  });
  res.end(body);
}

function sendText(res, statusCode, contentType, body) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf-8');
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': buf.length,
    ...NO_CACHE_HEADERS,
  });
  res.end(buf);
}

function sendStatus(res, statusCode, message) {
  sendJson(res, statusCode, { error: message || String(statusCode) });
}

function readJsonBody(req, limitBytes, callback) {
  let total = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    total += chunk.length;
    if (total > limitBytes) {
      req.destroy();
      callback(new Error('Request body too large'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!chunks.length) {
      callback(null, {});
      return;
    }
    try {
      const text = Buffer.concat(chunks).toString('utf-8');
      callback(null, JSON.parse(text));
    } catch (e) {
      callback(e);
    }
  });
  req.on('error', (e) => callback(e));
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx < 0) return {};
  const out = {};
  const qs = url.slice(idx + 1);
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const k = eq < 0 ? pair : pair.slice(0, eq);
    const v = eq < 0 ? '' : pair.slice(eq + 1);
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  MIME_TYPES,
  NO_CACHE_HEADERS,
  mimeFor,
  sendJson,
  sendText,
  sendStatus,
  readJsonBody,
  parseQuery,
};
