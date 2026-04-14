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

  // /api/session-status POST — persist status to a project's manifest
  if (req.method === 'POST' && pathname === '/api/session-status') {
    readJsonBody(req, (err, body) => {
      if (err) { res.writeHead(400); res.end('Bad request'); return; }
      const { sessionDir: sessionParam, status: newStatus } = body || {};
      if (!VALID_STATUSES.includes(newStatus)) { res.writeHead(400); res.end('Invalid status'); return; }
      const resolved = path.normalize(path.resolve(sessionParam));
      const ws = path.normalize(ctx.WORKSPACE_DIR);
      if (!resolved.startsWith(ws + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
      const manifestPath = path.join(resolved, 'state', 'manifest.json');
      if (!fs.existsSync(manifestPath)) { res.writeHead(404); res.end('Project not found'); return; }
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return true;
  }

  return false;
}

module.exports = { handle };
