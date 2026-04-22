'use strict';
/**
 * bundle.cjs — HTML download handler for /api/export-html-bundle.
 *
 * The agent produces self-contained single-file HTML decks per the creative
 * brief at references/slide-deck-engine.md. This handler resolves the
 * active source (template, session, or content file) and streams it to the
 * client byte-for-byte as an attachment. No transformation, no inlining,
 * no bundler.
 *
 * Pipeline:
 *   1. Parse optional JSON body ({source, file, brand?, sessionDir?}).
 *   2. Resolve source path via resolveSourceFromPayload or resolveActiveSource.
 *   3. Stream the file with Content-Disposition: attachment.
 *
 * PNG / PDF / PPTX exports live elsewhere and use Playwright directly.
 */

const fs = require('fs');
const path = require('path');
const workspace = require('./workspace.cjs');

// ── Source file resolution ──────────────────────────────────────────────────
//
// Content files may live in platform subfolders (content/deck/slides.html,
// content/linkedin/carousel.html, etc.) per the workspace folder contract.
// Using path.basename() to strip the subfolder — as a previous iteration
// did — 404'd every non-root file. We now preserve the relative path and
// defer path-traversal safety to workspace.resolveContentPath, which
// rejects any target that escapes the project's content/ root.

function resolveActiveSource(ctx) {
  const { activeProject, GENERATORS_DIR } = ctx;
  if (activeProject) {
    const statePath = path.join(activeProject.stateDir, 'active.json');
    if (fs.existsSync(statePath)) {
      try {
        const active = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        if (active.file) {
          const filePath = workspace.resolveContentPath(activeProject.dir, active.file);
          if (!filePath) return null;
          return {
            filePath,
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

  // Templates are flat files in templates/<name>.html — no subfolders ever
  // live there, so path.basename is a safe traversal guard.
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
    const filePath = workspace.resolveContentPath(resolved, file);
    if (!filePath) return null;
    return { filePath, baseName: path.basename(file, path.extname(file)) };
  }

  if (source === 'content' && file && ctx.activeProject) {
    const filePath = workspace.resolveContentPath(ctx.activeProject.dir, file);
    if (!filePath) return null;
    return { filePath, baseName: path.basename(file, path.extname(file)) };
  }

  return null;
}

// ── Request handler ─────────────────────────────────────────────────────────

function handleExportHtmlBundle(req, res, ctx) {
  let body = '';
  req.on('data', d => { body += d; });
  return new Promise(resolve => {
    req.on('end', () => {
      // Body shapes:
      //   (a) empty / whitespace → use active source
      //   (b) valid JSON, no `source` key → caller sent no explicit request,
      //       treat as (a) — the UI button sends `{}` on its default path
      //   (c) valid JSON with `source` key → caller is explicit; honor their
      //       intent. If resolution fails (invalid shape, path-traversal
      //       rejected by resolveContentPath, unknown source value), 400
      //       instead of silently falling back — otherwise a malformed
      //       request silently returns a different file than requested.
      //   (d) body present but invalid JSON → 400
      let src = null;
      const hasBody = typeof body === 'string' && body.trim().length > 0;
      if (hasBody) {
        let payload;
        try { payload = JSON.parse(body); } catch { payload = null; }
        if (!payload || typeof payload !== 'object') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return resolve();
        }
        if (typeof payload.source === 'string' && payload.source.length > 0) {
          src = resolveSourceFromPayload(payload, ctx);
          if (!src) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Could not resolve source from payload (missing or invalid source/file, or path escapes project root)' }));
            return resolve();
          }
        } else {
          src = resolveActiveSource(ctx);
        }
      } else {
        src = resolveActiveSource(ctx);
      }

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

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + src.baseName + '.html"',
        'Cache-Control': 'no-store',
      });

      const stream = fs.createReadStream(src.filePath);
      stream.on('error', () => { try { res.destroy(); } catch { /* ignore */ } resolve(); });
      stream.on('end', () => resolve());
      stream.pipe(res);
    });
  });
}

module.exports = { handleExportHtmlBundle };
