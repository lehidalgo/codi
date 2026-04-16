'use strict';
const fs = require('fs');
const path = require('path');
const { isValidType } = require('./content-types.cjs');

function slugify(name) {
  return (name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

function projectDirs(dir) {
  return {
    dir,
    contentDir: path.join(dir, 'content'),
    stateDir: path.join(dir, 'state'),
    exportsDir: path.join(dir, 'exports'),
  };
}

// Create a new named project directory under workspaceDir.
// `opts.type` is required and must be a valid content type.
// Returns { dir, contentDir, stateDir, exportsDir, manifest }.
function createProject(workspaceDir, name, opts = {}) {
  const type = opts.type || null;
  if (!isValidType(type)) {
    throw new Error('createProject requires a valid type (social, slides, document). Got: ' + type);
  }
  const slug = slugify(name);
  let dir = path.join(workspaceDir, slug);
  // Avoid clobbering an existing project — append a short time suffix
  if (fs.existsSync(dir)) {
    dir = path.join(workspaceDir, slug + '-' + Date.now().toString(36));
  }
  const p = projectDirs(dir);
  fs.mkdirSync(p.contentDir, { recursive: true });
  fs.mkdirSync(p.stateDir, { recursive: true });
  fs.mkdirSync(p.exportsDir, { recursive: true });
  const manifest = {
    name,
    slug,
    projectDir: dir,
    created: Date.now(),
    preset: { type },
    files: [],
    status: 'draft',
  };
  fs.writeFileSync(path.join(p.stateDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { ...p, manifest };
}

// List all named project directories under workspaceDir.
function listProjects(workspaceDir) {
  if (!fs.existsSync(workspaceDir)) return [];
  let entries;
  try { entries = fs.readdirSync(workspaceDir); } catch { return []; }
  const projects = [];
  for (const d of entries) {
    if (d.startsWith('_')) continue; // skip _workspace.json, _server.pid, etc.
    const projectDir = path.join(workspaceDir, d);
    try {
      if (!fs.statSync(projectDir).isDirectory()) continue;
    } catch { continue; }
    const manifestPath = path.join(projectDir, 'state', 'manifest.json');
    const contentDir = path.join(projectDir, 'content');
    const htmlFiles = fs.existsSync(contentDir)
      ? fs.readdirSync(contentDir).filter(f => f.endsWith('.html'))
      : [];
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        // Include if it has content OR is a freshly created project
        if (htmlFiles.length > 0 || m.projectDir) {
          projects.push({ ...m, projectDir, sessionDir: projectDir, files: htmlFiles, status: m.status || 'draft' });
        }
      } catch { /* skip corrupt manifest */ }
    } else if (htmlFiles.length > 0) {
      // Legacy session without manifest — synthesize minimal metadata
      const s = fs.statSync(projectDir);
      projects.push({
        name: d, slug: slugify(d), projectDir, sessionDir: projectDir,
        created: s.birthtimeMs || s.ctimeMs,
        preset: null, files: htmlFiles, status: 'draft',
      });
    }
  }
  return projects.sort((a, b) => (b.created || 0) - (a.created || 0));
}

function getActiveProjectDir(workspaceDir) {
  const f = path.join(workspaceDir, '_workspace.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf-8')).activeProjectDir || null; } catch { return null; }
}

function saveActiveProjectDir(workspaceDir, activeProjectDir) {
  fs.writeFileSync(
    path.join(workspaceDir, '_workspace.json'),
    JSON.stringify({ activeProjectDir, updatedAt: Date.now() }, null, 2)
  );
}

// Delete a project by id (the basename of its session directory). Returns
// { ok: true, removedPath } on success. Guards against path traversal
// by refusing anything that escapes the workspace root after resolution.
function deleteProject(workspaceDir, sessionId) {
  if (!workspaceDir || !sessionId) {
    throw new Error('workspaceDir and sessionId are required');
  }
  // Only allow bare basenames — reject any path separator or '..' part.
  if (
    sessionId.startsWith('_') ||
    sessionId.includes('/') ||
    sessionId.includes('\\') ||
    sessionId.includes('..') ||
    sessionId === '.' ||
    sessionId === ''
  ) {
    const e = new Error('invalid session id: ' + sessionId);
    e.status = 400;
    throw e;
  }
  const ws = path.resolve(workspaceDir);
  const target = path.resolve(ws, sessionId);
  // Path traversal guard — target must be a direct child of the workspace.
  if (path.dirname(target) !== ws) {
    const e = new Error('session path escapes workspace');
    e.status = 400;
    throw e;
  }
  if (!fs.existsSync(target)) {
    const e = new Error('session not found: ' + sessionId);
    e.status = 404;
    throw e;
  }
  // Extra safety — verify the target has the shape of a project
  // (content dir OR a manifest). We never delete arbitrary directories.
  const looksLikeProject =
    fs.existsSync(path.join(target, 'content')) ||
    fs.existsSync(path.join(target, 'state', 'manifest.json'));
  if (!looksLikeProject) {
    const e = new Error('not a project directory: ' + sessionId);
    e.status = 400;
    throw e;
  }
  fs.rmSync(target, { recursive: true, force: true });
  return { ok: true, removedPath: target };
}

module.exports = { slugify, projectDirs, createProject, listProjects, getActiveProjectDir, saveActiveProjectDir, deleteProject };
