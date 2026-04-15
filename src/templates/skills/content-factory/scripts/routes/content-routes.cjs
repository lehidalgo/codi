'use strict';

// /api/content-metadata — unified metadata endpoint for Preview header,
// Gallery rendering, URL-pinning restore, and persist-style context
// resolution. One shape, both kinds, no branching downstream.
//
// Also hosts /api/clone-template-to-session: the "Save to My Work" flow
// that turns a read-only template into a fresh, editable session.

const contentRegistry = require('../lib/content-registry.cjs');
const templateCloner = require('../lib/template-cloner.cjs');

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf-8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(buf);
}

function readJsonBody(req, limitBytes, cb) {
  let total = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    total += chunk.length;
    if (total > limitBytes) { req.destroy(); cb(new Error('body too large')); return; }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (!chunks.length) { cb(null, {}); return; }
    try { cb(null, JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
    catch (e) { cb(e); }
  });
  req.on('error', (e) => cb(e));
}

function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;

  // POST /api/clone-template-to-session
  //   Body: { templateId, name? }
  //   Response: { ok, session: <descriptor>, file }
  if (req.method === 'POST' && pathname === '/api/clone-template-to-session') {
    readJsonBody(req, 64 * 1024, (err, body) => {
      if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      const { templateId, name } = body || {};
      if (!templateId) {
        return sendJson(res, 400, { ok: false, error: 'templateId is required' });
      }
      try {
        const result = templateCloner.cloneTemplate({ templateId, name }, ctx);
        sendJson(res, 200, {
          ok: true,
          session: result.descriptor,
          sessionDir: result.session.sessionDir,
          file: result.session.file,
        });
      } catch (e) {
        const status = e && e.status ? e.status : 500;
        sendJson(res, status, { ok: false, error: e && e.message ? e.message : String(e) });
      }
    });
    return true;
  }

  if (req.method !== 'GET') return false;

  // GET /api/content-metadata?kind=&id=
  if (pathname === '/api/content-metadata') {
    const kind = parsed.searchParams.get('kind');
    const id = parsed.searchParams.get('id');
    if (!kind || !id) {
      sendJson(res, 400, { ok: false, error: 'kind and id are required' });
      return true;
    }
    const d = contentRegistry.getDescriptor(kind, id, ctx);
    if (!d) {
      sendJson(res, 404, { ok: false, error: 'content not found', kind, id });
      return true;
    }
    sendJson(res, 200, d);
    return true;
  }

  // GET /api/content-list — debug/utility: return all content descriptors
  if (pathname === '/api/content-list') {
    sendJson(res, 200, { content: contentRegistry.listAll(ctx) });
    return true;
  }

  return false;
}

module.exports = { handle };
