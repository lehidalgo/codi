'use strict';
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');
const workspace = require('./lib/workspace.cjs');
const { handleExportPng, handleExportPdf, handleExportDocx } = require('./lib/exports.cjs');

// ========== WebSocket Protocol (RFC 6455) ==========

const OPCODES = { TEXT: 0x01, CLOSE: 0x08, PING: 0x09, PONG: 0x0A };
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_MAGIC).digest('base64');
}

function encodeFrame(opcode, payload) {
  const fin = 0x80;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = fin | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = fin | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = fin | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const secondByte = buffer[1];
  const opcode = buffer[0] & 0x0F;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLen = secondByte & 0x7F;
  let offset = 2;
  if (!masked) throw new Error('Client frames must be masked');
  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const maskOffset = offset;
  const dataOffset = offset + 4;
  const totalLen = dataOffset + payloadLen;
  if (buffer.length < totalLen) return null;
  const mask = buffer.slice(maskOffset, dataOffset);
  const data = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  return { opcode, payload: data, bytesConsumed: totalLen };
}

// ========== Configuration ==========

const PORT = process.env.BRAINSTORM_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.BRAINSTORM_HOST || '127.0.0.1';
const URL_HOST = process.env.BRAINSTORM_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const WORKSPACE_DIR = process.env.BRAINSTORM_WORKSPACE || '/tmp/brainstorm-workspace';
const GENERATORS_DIR = path.join(__dirname, '..', 'generators');
const VENDOR_DIR = path.join(__dirname, 'vendor');
let ownerPid = process.env.BRAINSTORM_OWNER_PID ? Number(process.env.BRAINSTORM_OWNER_PID) : null;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
};

// ========== Active Project State ==========

let activeProject = null; // { dir, contentDir, stateDir, exportsDir }
let contentWatcher = null;
let knownFiles = new Set();
const debounceTimers = new Map();

function setActiveProject(dir) {
  if (!dir) { activeProject = null; return; }
  const resolved = path.normalize(path.resolve(dir));
  // Validate the directory is inside WORKSPACE_DIR
  const ws = path.normalize(WORKSPACE_DIR);
  if (!resolved.startsWith(ws + path.sep) && resolved !== ws) return;
  if (!fs.existsSync(resolved)) return;
  if (contentWatcher) { contentWatcher.close(); contentWatcher = null; }
  activeProject = workspace.projectDirs(resolved);
  knownFiles = new Set(
    fs.existsSync(activeProject.contentDir)
      ? fs.readdirSync(activeProject.contentDir).filter(f => f.endsWith('.html'))
      : []
  );
  if (fs.existsSync(activeProject.contentDir)) startContentWatcher();
  workspace.saveActiveProjectDir(WORKSPACE_DIR, resolved);
}

function writeProjectManifest() {
  if (!activeProject) return;
  try {
    const files = fs.existsSync(activeProject.contentDir)
      ? fs.readdirSync(activeProject.contentDir).filter(f => f.endsWith('.html'))
      : [];
    const presetFile = path.join(activeProject.stateDir, 'preset.json');
    const preset = fs.existsSync(presetFile) ? JSON.parse(fs.readFileSync(presetFile, 'utf-8')) : null;
    const manifestPath = path.join(activeProject.stateDir, 'manifest.json');
    const existing = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      : {};
    fs.writeFileSync(manifestPath, JSON.stringify({ ...existing, preset, files, updatedAt: Date.now() }, null, 2));
  } catch { /* non-critical */ }
}

// ========== HTTP Helpers ==========

function getContentFiles() {
  if (!activeProject || !fs.existsSync(activeProject.contentDir)) return [];
  return fs.readdirSync(activeProject.contentDir)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const fp = path.join(activeProject.contentDir, f);
      return { name: f, path: fp, mtime: fs.statSync(fp).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

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

// ========== HTTP Request Handler ==========

function handleRequest(req, res) {
  touchActivity();
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  // /api/preset GET
  if (req.method === 'GET' && pathname === '/api/preset') {
    const data = activeProject
      ? readJson(path.join(activeProject.stateDir, 'preset.json'), { id: null })
      : { id: null };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // /api/preset POST
  if (req.method === 'POST' && pathname === '/api/preset') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (activeProject) {
          fs.writeFileSync(path.join(activeProject.stateDir, 'preset.json'), JSON.stringify(data, null, 2));
          writeProjectManifest();
        }
        console.log(JSON.stringify({ type: 'preset-selected', ...data }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // /api/active-file GET
  if (req.method === 'GET' && pathname === '/api/active-file') {
    const stateDir = activeProject ? activeProject.stateDir : path.join(WORKSPACE_DIR, '_state');
    const data = readJson(path.join(stateDir, 'active.json'), { file: null, preset: null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // /api/active-file POST
  if (req.method === 'POST' && pathname === '/api/active-file') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // If sessionDir/projectDir provided, activate that project
        const projDir = data.projectDir || data.sessionDir || null;
        if (projDir) setActiveProject(projDir);
        const stateDir = activeProject ? activeProject.stateDir : path.join(WORKSPACE_DIR, '_state');
        if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
        fs.writeFileSync(path.join(stateDir, 'active.json'), JSON.stringify({ ...data, timestamp: Date.now() }, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // /api/state GET — aggregate state for agent orientation
  if (req.method === 'GET' && pathname === '/api/state') {
    const stateDir = activeProject ? activeProject.stateDir : path.join(WORKSPACE_DIR, '_state');
    const preset = readJson(path.join(stateDir, 'preset.json'), null);
    const active = readJson(path.join(stateDir, 'active.json'), { file: null, preset: null });
    const mode = activeProject ? 'mywork' : (active.preset ? 'template' : null);
    let activeFilePath = null;
    if (mode === 'mywork' && activeProject && active.file) {
      activeFilePath = path.join(activeProject.contentDir, active.file);
    } else if (mode === 'template' && active.preset) {
      activeFilePath = path.join(GENERATORS_DIR, 'templates', active.preset + '.html');
    }
    const contentId = activeFilePath
      ? crypto.createHash('sha256').update(activeFilePath).digest('hex').slice(0, 8)
      : null;
    let activeStatus = null;
    if (activeProject) {
      const m = readJson(path.join(activeProject.stateDir, 'manifest.json'), {});
      activeStatus = m.status || 'draft';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeFile: active.file ?? null,
      activePreset: active.preset ?? null,
      activeSessionDir: activeProject ? activeProject.dir : null,
      activeFilePath,
      mode, contentId,
      status: activeStatus,
      preset,
    }));
    return;
  }

  // /api/create-project POST — create a new named project and activate it
  if (req.method === 'POST' && pathname === '/api/create-project') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        if (!name || typeof name !== 'string') { res.writeHead(400); res.end('Missing name'); return; }
        const project = workspace.createProject(WORKSPACE_DIR, name.trim());
        setActiveProject(project.dir);
        if (fs.existsSync(project.contentDir)) startContentWatcher();
        console.log(JSON.stringify({ type: 'project-created', name, projectDir: project.dir }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          projectDir: project.dir,
          contentDir: project.contentDir,
          stateDir: project.stateDir,
          exportsDir: project.exportsDir,
          // Legacy aliases for backward compat with template.ts
          screen_dir: project.contentDir,
          state_dir: project.stateDir,
          exports_dir: project.exportsDir,
        }));
      } catch (e) { res.writeHead(500); res.end(e.message); }
    });
    return;
  }

  // /api/open-project POST — activate an existing project
  if (req.method === 'POST' && pathname === '/api/open-project') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { projectDir } = JSON.parse(body);
        setActiveProject(projectDir);
        const active = activeProject;
        if (!active) { res.writeHead(404); res.end('Project not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, projectDir: active.dir, contentDir: active.contentDir, stateDir: active.stateDir }));
      } catch { res.writeHead(400); res.end('Bad request'); }
    });
    return;
  }

  // /api/templates — list HTML files in generators/templates/
  if (req.method === 'GET' && pathname === '/api/templates') {
    const templatesDir = path.join(GENERATORS_DIR, 'templates');
    const files = fs.existsSync(templatesDir)
      ? fs.readdirSync(templatesDir).filter(f => f.endsWith('.html')).sort()
      : [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // /api/template?file=xxx — serve a template HTML file
  if (req.method === 'GET' && pathname === '/api/template') {
    const fileParam = parsed.searchParams.get('file');
    if (!fileParam) { res.writeHead(400); res.end('Missing ?file='); return; }
    const templatesDir = path.join(GENERATORS_DIR, 'templates');
    const filePath = path.join(templatesDir, path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // /api/content?file=xxx — raw HTML from active project's content dir
  if (req.method === 'GET' && pathname === '/api/content') {
    const fileParam = parsed.searchParams.get('file');
    if (!fileParam || !activeProject) { res.writeHead(activeProject ? 400 : 404); res.end(activeProject ? 'Missing ?file=' : 'No active project'); return; }
    const filePath = path.join(activeProject.contentDir, path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // /api/files — sorted list of HTML files in active project's content dir
  if (req.method === 'GET' && pathname === '/api/files') {
    const files = getContentFiles().map(f => f.name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // /static/* — serve generator app assets
  if (req.method === 'GET' && pathname.startsWith('/static/')) {
    const rel = pathname.slice(8);
    const filePath = path.resolve(GENERATORS_DIR, rel);
    if (!filePath.startsWith(GENERATORS_DIR + path.sep) && filePath !== GENERATORS_DIR) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    serveFile(res, filePath);
    return;
  }

  // /vendor/* — serve vendor scripts
  if (req.method === 'GET' && pathname.startsWith('/vendor/')) {
    const filePath = path.join(VENDOR_DIR, path.basename(pathname.slice(8)));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    serveFile(res, filePath);
    return;
  }

  // /api/sessions — list all projects in workspace
  if (req.method === 'GET' && pathname === '/api/sessions') {
    const sessions = workspace.listProjects(WORKSPACE_DIR);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // /api/session-status POST — persist status to a project's manifest
  if (req.method === 'POST' && pathname === '/api/session-status') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      try {
        const { sessionDir: sessionParam, status } = JSON.parse(body);
        const VALID = ['draft', 'in-progress', 'review', 'done'];
        if (!VALID.includes(status)) { res.writeHead(400); res.end('Invalid status'); return; }
        const resolved = path.normalize(path.resolve(sessionParam));
        const ws = path.normalize(WORKSPACE_DIR);
        if (!resolved.startsWith(ws + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
        const manifestPath = path.join(resolved, 'state', 'manifest.json');
        if (!fs.existsSync(manifestPath)) { res.writeHead(404); res.end('Project not found'); return; }
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        m.status = status;
        m.statusUpdatedAt = Date.now();
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch { res.writeHead(400); res.end('Bad request'); }
    });
    return;
  }

  // /api/session-content?session=&file= — serve HTML from a specific project
  if (req.method === 'GET' && pathname === '/api/session-content') {
    const sessionParam = parsed.searchParams.get('session');
    const fileParam = parsed.searchParams.get('file');
    if (!sessionParam || !fileParam) { res.writeHead(400); res.end('Missing params'); return; }
    const resolved = path.normalize(path.resolve(sessionParam));
    const ws = path.normalize(WORKSPACE_DIR);
    if (!resolved.startsWith(ws + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const filePath = path.join(resolved, 'content', path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // /api/export-png POST — render card HTML to PNG via Playwright
  if (req.method === 'POST' && pathname === '/api/export-png') {
    handleExportPng(req, res); return;
  }

  if (req.method === 'POST' && pathname === '/api/export-pdf') {
    handleExportPdf(req, res); return;
  }

  if (req.method === 'POST' && pathname === '/api/export-docx') {
    handleExportDocx(req, res); return;
  }

  // / — serve app shell
  if (req.method === 'GET' && pathname === '/') {
    const appPath = path.join(GENERATORS_DIR, 'app.html');
    if (!fs.existsSync(appPath)) { res.writeHead(503); res.end('App not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(appPath, 'utf-8'));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ========== WebSocket ==========

const clients = new Set();

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = computeAcceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  let buffer = Buffer.alloc(0);
  clients.add(socket);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      let result;
      try { result = decodeFrame(buffer); }
      catch { socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0))); clients.delete(socket); return; }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);
      switch (result.opcode) {
        case OPCODES.TEXT: handleMessage(result.payload.toString()); break;
        case OPCODES.CLOSE: socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0))); clients.delete(socket); return;
        case OPCODES.PING: socket.write(encodeFrame(OPCODES.PONG, result.payload)); break;
        case OPCODES.PONG: break;
        default: { const cb = Buffer.alloc(2); cb.writeUInt16BE(1003); socket.end(encodeFrame(OPCODES.CLOSE, cb)); clients.delete(socket); return; }
      }
    }
  });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}

function handleMessage(text) {
  let event;
  try { event = JSON.parse(text); } catch (e) { console.error('WS parse error:', e.message); return; }
  touchActivity();
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  if (event.choice && activeProject) {
    const eventsFile = path.join(activeProject.stateDir, 'events');
    fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  }
}

function broadcast(msg) {
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of clients) {
    try { socket.write(frame); } catch { clients.delete(socket); }
  }
}

// ========== Activity Tracking ==========

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let lastActivity = Date.now();
function touchActivity() { lastActivity = Date.now(); }

// ========== File Watchers ==========

let presetsWatcher = null;

function startContentWatcher() {
  if (!activeProject || !fs.existsSync(activeProject.contentDir)) return;
  if (contentWatcher) { contentWatcher.close(); contentWatcher = null; }
  const watcher = fs.watch(activeProject.contentDir, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;
    if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      const filePath = path.join(activeProject.contentDir, filename);
      if (!fs.existsSync(filePath)) return;
      touchActivity();
      if (!knownFiles.has(filename)) {
        knownFiles.add(filename);
        const eventsFile = path.join(activeProject.stateDir, 'events');
        if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
        console.log(JSON.stringify({ type: 'screen-added', file: filePath }));
      } else {
        console.log(JSON.stringify({ type: 'screen-updated', file: filePath }));
      }
      writeProjectManifest();
      broadcast({ type: 'reload' });
    }, 100));
  });
  watcher.on('error', (err) => console.error('content watcher error:', err.message));
  contentWatcher = watcher;
}

// ========== Server Startup ==========

function startServer() {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  // Restore last active project
  const lastActiveDir = workspace.getActiveProjectDir(WORKSPACE_DIR);
  if (lastActiveDir && fs.existsSync(lastActiveDir)) {
    setActiveProject(lastActiveDir);
  }

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch generators/templates/ for gallery live reload
  const TEMPLATES_DIR = path.join(GENERATORS_DIR, 'templates');
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  presetsWatcher = fs.watch(TEMPLATES_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;
    if (debounceTimers.has('tpl:' + filename)) clearTimeout(debounceTimers.get('tpl:' + filename));
    debounceTimers.set('tpl:' + filename, setTimeout(() => {
      debounceTimers.delete('tpl:' + filename);
      touchActivity();
      console.log(JSON.stringify({ type: 'template-updated', file: filename }));
      broadcast({ type: 'reload-templates' });
    }, 150));
  });
  presetsWatcher.on('error', (err) => console.error('templates watcher error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const pidFile = path.join(WORKSPACE_DIR, '_server.pid');
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    fs.writeFileSync(path.join(WORKSPACE_DIR, '_server-stopped'), JSON.stringify({ reason, timestamp: Date.now() }) + '\n');
    if (contentWatcher) contentWatcher.close();
    if (presetsWatcher) presetsWatcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  function ownerAlive() {
    if (!ownerPid) return true;
    try { process.kill(ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  }

  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 60 * 1000);
  lifecycleCheck.unref();

  if (ownerPid) {
    try { process.kill(ownerPid, 0); }
    catch (e) {
      if (e.code !== 'EPERM') {
        console.log(JSON.stringify({ type: 'owner-pid-invalid', pid: ownerPid, reason: 'dead at startup' }));
        ownerPid = null;
      }
    }
  }

  server.listen(PORT, HOST, () => {
    const info = JSON.stringify({
      type: 'server-started', port: Number(PORT), host: HOST,
      url_host: URL_HOST, url: 'http://' + URL_HOST + ':' + PORT,
      workspace_dir: WORKSPACE_DIR,
    });
    console.log(info);
    fs.writeFileSync(path.join(WORKSPACE_DIR, '_server-info'), info + '\n');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
