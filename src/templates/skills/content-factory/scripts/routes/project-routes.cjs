'use strict';
const fs = require('fs');
const path = require('path');
const workspace = require('../lib/workspace.cjs');
const state = require('../lib/project-state.cjs');
const { sendJson, readJsonBody } = require('../lib/http-utils.cjs');

const VALID_STATUSES = ['draft', 'in-progress', 'review', 'done'];

/**
 * Routes that create, open, list, and update workspace projects.
 * Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;

  // /api/create-project POST
  if (req.method === 'POST' && pathname === '/api/create-project') {
    readJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const { name } = body || {};
      if (!name || typeof name !== 'string') { res.writeHead(400); res.end('Missing name'); return; }
      try {
        const project = workspace.createProject(ctx.WORKSPACE_DIR, name.trim());
        state.setActiveProject(project.dir);
        if (fs.existsSync(project.contentDir)) state.startContentWatcher();
        console.log(JSON.stringify({ type: 'project-created', name, projectDir: project.dir }));
        sendJson(res, 200, {
          ok: true,
          projectDir: project.dir,
          contentDir: project.contentDir,
          stateDir: project.stateDir,
          exportsDir: project.exportsDir,
          // Legacy aliases for backward compat with template.ts
          screen_dir: project.contentDir,
          state_dir: project.stateDir,
          exports_dir: project.exportsDir,
        });
      } catch (e) { res.writeHead(500); res.end(e.message); }
    });
    return true;
  }

  // /api/open-project POST
  if (req.method === 'POST' && pathname === '/api/open-project') {
    readJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const { projectDir } = body || {};
      state.setActiveProject(projectDir);
      const active = state.getActiveProject();
      if (!active) { res.writeHead(404); res.end('Project not found'); return; }
      sendJson(res, 200, {
        ok: true,
        projectDir: active.dir,
        contentDir: active.contentDir,
        stateDir: active.stateDir,
      });
    });
    return true;
  }

  // /api/sessions GET — list all projects in workspace
  if (req.method === 'GET' && pathname === '/api/sessions') {
    sendJson(res, 200, workspace.listProjects(ctx.WORKSPACE_DIR));
    return true;
  }

  // /api/sessions DELETE — remove a project by id (?id=<basename>)
  if (req.method === 'DELETE' && pathname === '/api/sessions') {
    const sessionId = parsed.searchParams.get('id');
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'id query param is required' }));
      return true;
    }
    try {
      const result = workspace.deleteProject(ctx.WORKSPACE_DIR, sessionId);
      // If this session was the active one server-side, clear it so
      // /api/state stops reporting a deleted project.
      try {
        const active = state.getActiveProject && state.getActiveProject();
        if (active && path.basename(active.projectDir || '') === sessionId) {
          state.setActiveProject(null);
        }
      } catch { /* best effort */ }
      sendJson(res, 200, { ok: true, removedPath: result.removedPath });
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return true;
  }

  // /api/session-status POST — persist status to a project's manifest
  //
  // Layer 5 status gate: if the target status is in the session's
  // validation.blockStatus list, run a batch validation of all cards
  // and block with 409 if any fail. `force:true` in the body bypasses
  // (used by the UI's "change anyway" confirm).
  if (req.method === 'POST' && pathname === '/api/session-status') {
    readJsonBody(req, async (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const { sessionDir: sessionParam, status: newStatus, force } = body || {};
      if (!VALID_STATUSES.includes(newStatus)) { res.writeHead(400); res.end('Invalid status'); return; }
      const resolved = path.normalize(path.resolve(sessionParam));
      const ws = path.normalize(ctx.WORKSPACE_DIR);
      if (!resolved.startsWith(ws + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
      const manifestPath = path.join(resolved, 'state', 'manifest.json');
      if (!fs.existsSync(manifestPath)) { res.writeHead(404); res.end('Project not found'); return; }
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Layer 5 gate
      if (!force) {
        try {
          const cfgLib = require('../lib/validation-config.cjs');
          const { config } = cfgLib.resolveConfig({
            workspaceDir: ctx.WORKSPACE_DIR,
            projectDir: resolved,
          });
          const layersOn = config.enabled !== false && config.layers && config.layers.statusGate !== false;
          const blockList = Array.isArray(config.blockStatus) ? config.blockStatus : [];
          if (layersOn && blockList.includes(newStatus)) {
            const validator = require('../lib/validator.cjs');
            const file = Array.isArray(m.files) && m.files[0] ? m.files[0] : null;
            if (file) {
              const batch = await validator.validateAllCards(resolved, file, {
                preset: config.preset,
                threshold: config.threshold,
                tolerance: config.tolerance,
              });
              if (batch.ok && batch.pass === false) {
                sendJson(res, 409, {
                  ok: false,
                  code: 'validation_blocks_status',
                  message: 'Cannot change status: ' + batch.failingCards.length + ' card(s) fail layout validation',
                  targetStatus: newStatus,
                  failingCards: batch.failingCards.map((c) => ({
                    cardIndex: c.cardIndex,
                    score: c.score,
                    errors: c.summary ? c.summary.errors : 0,
                  })),
                  overridable: true,
                });
                return;
              }
            }
          }
        } catch (_e) {
          // If validation itself errors, don't block the status change
        }
      }

      m.status = newStatus;
      m.statusUpdatedAt = Date.now();
      fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      sendJson(res, 200, { ok: true });
    });
    return true;
  }

  // /api/session-content?session=&file= GET — serve HTML from a specific project
  if (req.method === 'GET' && pathname === '/api/session-content') {
    const sessionParam = parsed.searchParams.get('session');
    const fileParam = parsed.searchParams.get('file');
    if (!sessionParam || !fileParam) { res.writeHead(400); res.end('Missing params'); return true; }
    const resolved = path.normalize(path.resolve(sessionParam));
    const ws = path.normalize(ctx.WORKSPACE_DIR);
    if (!resolved.startsWith(ws + path.sep)) { res.writeHead(403); res.end('Forbidden'); return true; }
    const filePath = path.join(resolved, 'content', path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return true; }
    const injector = require('../lib/injector.cjs');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const injected = injector.inject(raw);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(injected);
    return true;
  }

  return false;
}

module.exports = { handle };
