'use strict';
const fs = require('fs');
const path = require('path');

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
// Returns { dir, contentDir, stateDir, exportsDir, manifest }.
function createProject(workspaceDir, name) {
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
    preset: null,
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

module.exports = { slugify, projectDirs, createProject, listProjects, getActiveProjectDir, saveActiveProjectDir };
