'use strict';
const fs = require('fs');
const path = require('path');
const { isValidType } = require('./content-types.cjs');

// ── Platform folder contract ───────────────────────────────────────────────
// Every project scaffolds this tree under `content/`. Agents write variant
// HTML files INTO the matching platform folder. The anchor lives at the root
// as 00-anchor.md (Markdown — the only supported anchor format).
const PLATFORM_FOLDERS = [
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'blog',
  'deck',
];

const CONTENT_EXTS = new Set(['.html', '.md']);

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

// Scan `contentDir` recursively for .html and .md files. Returns a list of
// POSIX-style relative paths (forward slashes) sorted by depth then name.
// Skips dotfiles and ignores non-content extensions. Resilient to missing dirs.
function scanContentFiles(contentDir) {
  if (!fs.existsSync(contentDir)) return [];
  const results = [];
  const walk = (abs, rel) => {
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const childAbs = path.join(abs, e.name);
      const childRel = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        walk(childAbs, childRel);
      } else if (e.isFile() && CONTENT_EXTS.has(path.extname(e.name).toLowerCase())) {
        results.push(childRel);
      }
    }
  };
  walk(contentDir, '');
  // Anchor first (root-level .md), then everything else by depth then name.
  results.sort((a, b) => {
    const ad = a.split('/').length, bd = b.split('/').length;
    const aAnchor = ad === 1 && a.toLowerCase().endsWith('.md');
    const bAnchor = bd === 1 && b.toLowerCase().endsWith('.md');
    if (aAnchor !== bAnchor) return aAnchor ? -1 : 1;
    if (ad !== bd) return ad - bd;
    return a.localeCompare(b);
  });
  return results;
}

// Scaffold the platform folder tree inside contentDir. Safe to call repeatedly —
// creates only what's missing. Each platform gets an empty subfolder so the
// tree is discoverable by the client file panel even before any variant is
// authored.
function scaffoldPlatformTree(contentDir) {
  fs.mkdirSync(contentDir, { recursive: true });
  for (const folder of PLATFORM_FOLDERS) {
    fs.mkdirSync(path.join(contentDir, folder), { recursive: true });
  }
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
  scaffoldPlatformTree(p.contentDir);
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

// List all named project directories under workspaceDir. Each project's `files`
// array contains POSIX-style relative paths (with subfolders) to every content
// file under `content/`, including .html variants and the .md anchor.
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
    const files = scanContentFiles(contentDir);
    if (fs.existsSync(manifestPath)) {
      try {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (files.length > 0 || m.projectDir) {
          projects.push({ ...m, projectDir, sessionDir: projectDir, files, status: m.status || 'draft' });
        }
      } catch { /* skip corrupt manifest */ }
    } else if (files.length > 0) {
      const s = fs.statSync(projectDir);
      projects.push({
        name: d, slug: slugify(d), projectDir, sessionDir: projectDir,
        created: s.birthtimeMs || s.ctimeMs,
        preset: null, files, status: 'draft',
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

// Resolve a relative content-file path (e.g. "linkedin/carousel.html") into
// an absolute filesystem path under the project's content/ directory, with a
// strict path-traversal guard. Returns null if the path would escape.
function resolveContentPath(projectDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return null;
  if (relativePath.includes('\\')) return null;
  const contentRoot = path.resolve(projectDir, 'content');
  const target = path.resolve(contentRoot, relativePath);
  if (target !== contentRoot && !target.startsWith(contentRoot + path.sep)) return null;
  return target;
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

module.exports = {
  PLATFORM_FOLDERS,
  slugify,
  projectDirs,
  scanContentFiles,
  scaffoldPlatformTree,
  resolveContentPath,
  createProject,
  listProjects,
  getActiveProjectDir,
  saveActiveProjectDir,
  deleteProject,
};
