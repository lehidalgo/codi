'use strict';
const fs = require('fs');
const path = require('path');
const workspace = require('./workspace.cjs');
const { encodeFrame, OPCODES } = require('./ws-protocol.cjs');

let workspaceDir = null;
let activeProject = null;
let activeBrand = null;
let contentWatcher = null;
let knownFiles = new Set();
const debounceTimers = new Map();
const clients = new Set();
let lastActivity = Date.now();

function init(config) {
  workspaceDir = config.workspaceDir;
}

function getActiveProject() { return activeProject; }
function getActiveBrand() { return activeBrand; }
function setActiveBrand(brand) { activeBrand = brand; }
function getClients() { return clients; }
function touchActivity() { lastActivity = Date.now(); }
function getLastActivity() { return lastActivity; }

function setActiveProject(dir) {
  if (!dir) { activeProject = null; return; }
  const resolved = path.normalize(path.resolve(dir));
  const ws = path.normalize(workspaceDir);
  if (!resolved.startsWith(ws + path.sep) && resolved !== ws) return;
  if (!fs.existsSync(resolved)) return;
  if (contentWatcher) { contentWatcher.close(); contentWatcher = null; }
  activeProject = workspace.projectDirs(resolved);
  // Ensure the platform folder tree exists so the file panel can render it
  // as an empty scaffold before any variant is authored.
  workspace.scaffoldPlatformTree(activeProject.contentDir);
  knownFiles = new Set(workspace.scanContentFiles(activeProject.contentDir));
  if (fs.existsSync(activeProject.contentDir)) startContentWatcher();
  workspace.saveActiveProjectDir(workspaceDir, resolved);
}

function writeProjectManifest() {
  if (!activeProject) return;
  try {
    const files = workspace.scanContentFiles(activeProject.contentDir);
    const presetFile = path.join(activeProject.stateDir, 'preset.json');
    const preset = fs.existsSync(presetFile) ? JSON.parse(fs.readFileSync(presetFile, 'utf-8')) : null;
    const manifestPath = path.join(activeProject.stateDir, 'manifest.json');
    const existing = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      : {};
    fs.writeFileSync(manifestPath, JSON.stringify({ ...existing, preset, files, updatedAt: Date.now() }, null, 2));
  } catch { /* non-critical */ }
}

function getContentFiles() {
  if (!activeProject || !fs.existsSync(activeProject.contentDir)) return [];
  return workspace.scanContentFiles(activeProject.contentDir)
    .map((relPath) => {
      const fp = path.join(activeProject.contentDir, relPath);
      let mtime = 0;
      try { mtime = fs.statSync(fp).mtime.getTime(); } catch { /* file may have vanished */ }
      return { name: relPath, path: fp, mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function broadcast(msg) {
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of clients) {
    try { socket.write(frame); } catch { clients.delete(socket); }
  }
}

function startContentWatcher() {
  if (!activeProject || !fs.existsSync(activeProject.contentDir)) return;
  if (contentWatcher) { contentWatcher.close(); contentWatcher = null; }
  // Recursive watch so changes in platform subfolders (linkedin/, instagram/,
  // etc.) trigger reloads. `recursive: true` is supported on macOS and
  // Windows; on Linux it is silently ignored by fs.watch prior to Node 20.
  // For .md anchors we watch the same dirs — the watcher is file-extension
  // agnostic at the fs level.
  const watcher = fs.watch(
    activeProject.contentDir,
    { recursive: true },
    (eventType, filename) => {
      if (!filename) return;
      // Normalize to POSIX separators so keys in knownFiles match what
      // scanContentFiles emits (forward slashes even on Windows).
      const rel = filename.split(path.sep).join('/');
      const ext = path.extname(rel).toLowerCase();
      if (ext !== '.html' && ext !== '.md') return;
      if (debounceTimers.has(rel)) clearTimeout(debounceTimers.get(rel));
      debounceTimers.set(rel, setTimeout(() => {
        debounceTimers.delete(rel);
        const filePath = path.join(activeProject.contentDir, rel);
        if (!fs.existsSync(filePath)) return;
        touchActivity();
        if (!knownFiles.has(rel)) {
          knownFiles.add(rel);
          const eventsFile = path.join(activeProject.stateDir, 'events');
          if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
          console.log(JSON.stringify({ type: 'screen-added', file: filePath }));
        } else {
          console.log(JSON.stringify({ type: 'screen-updated', file: filePath }));
        }
        writeProjectManifest();
        broadcast({ type: 'reload' });
      }, 100));
    },
  );
  watcher.on('error', (err) => console.error('content watcher error:', err.message));
  contentWatcher = watcher;
}

function closeContentWatcher() {
  if (contentWatcher) { contentWatcher.close(); contentWatcher = null; }
}

module.exports = {
  init,
  getActiveProject, setActiveProject,
  getActiveBrand, setActiveBrand,
  getClients, touchActivity, getLastActivity,
  writeProjectManifest, getContentFiles,
  broadcast, startContentWatcher, closeContentWatcher,
};
