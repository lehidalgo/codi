const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  for (let i = 0; i < payloadLen; i++) {
    data[i] = buffer[dataOffset + i] ^ mask[i % 4];
  }

  return { opcode, payload: data, bytesConsumed: totalLen };
}

// ========== Configuration ==========

const PORT = process.env.BRAINSTORM_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.BRAINSTORM_HOST || '127.0.0.1';
const URL_HOST = process.env.BRAINSTORM_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const SESSION_DIR = process.env.BRAINSTORM_DIR || '/tmp/brainstorm';
const CONTENT_DIR = path.join(SESSION_DIR, 'content');
const STATE_DIR = path.join(SESSION_DIR, 'state');
const GENERATORS_DIR = path.join(__dirname, '..', 'generators');
const VENDOR_DIR = path.join(__dirname, 'vendor');
let ownerPid = process.env.BRAINSTORM_OWNER_PID ? Number(process.env.BRAINSTORM_OWNER_PID) : null;

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'
};

// ========== Helper Functions ==========

function writeManifest() {
  try {
    const files = fs.existsSync(CONTENT_DIR)
      ? fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'))
      : [];
    const presetFile = path.join(STATE_DIR, 'preset.json');
    const preset = fs.existsSync(presetFile) ? JSON.parse(fs.readFileSync(presetFile, 'utf-8')) : null;
    fs.writeFileSync(path.join(STATE_DIR, 'manifest.json'), JSON.stringify({
      sessionDir: SESSION_DIR, created: Date.now(), preset, files,
    }, null, 2));
  } catch { /* non-critical */ }
}

// ========== HTTP Request Handler ==========

function getContentFiles() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const fp = path.join(CONTENT_DIR, f);
      return { name: f, path: fp, mtime: fs.statSync(fp).mtime.getTime() };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(fs.readFileSync(filePath));
}

function handleRequest(req, res) {
  touchActivity();
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = parsed.pathname;

  // /api/preset GET — read preset selection (agent reads this to know which style to use)
  if (req.method === 'GET' && pathname === '/api/preset') {
    const presetFile = path.join(STATE_DIR, 'preset.json');
    const data = fs.existsSync(presetFile)
      ? fs.readFileSync(presetFile, 'utf-8')
      : JSON.stringify({ id: null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
    return;
  }

  // /api/preset POST — write preset selection from app UI
  if (req.method === 'POST' && pathname === '/api/preset') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(path.join(STATE_DIR, 'preset.json'), JSON.stringify(data, null, 2));
        writeManifest();
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

  // /api/active-file GET — return which file/preset the user currently has loaded in Preview
  if (req.method === 'GET' && pathname === '/api/active-file') {
    const activeFile = path.join(STATE_DIR, 'active.json');
    const data = fs.existsSync(activeFile)
      ? fs.readFileSync(activeFile, 'utf-8')
      : JSON.stringify({ file: null, preset: null });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
    return;
  }

  // /api/active-file POST — record which file/preset the user just loaded
  if (req.method === 'POST' && pathname === '/api/active-file') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        fs.writeFileSync(
          path.join(STATE_DIR, 'active.json'),
          JSON.stringify({ ...data, timestamp: Date.now() }, null, 2)
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // /api/state GET — aggregate: active file + preset selection (agent reads this to orient itself)
  if (req.method === 'GET' && pathname === '/api/state') {
    const presetFile = path.join(STATE_DIR, 'preset.json');
    const activeStateFile = path.join(STATE_DIR, 'active.json');
    const preset = fs.existsSync(presetFile) ? JSON.parse(fs.readFileSync(presetFile, 'utf-8')) : null;
    const active = fs.existsSync(activeStateFile)
      ? JSON.parse(fs.readFileSync(activeStateFile, 'utf-8'))
      : { file: null, preset: null, sessionDir: null };

    // Derive mode and the canonical absolute path to the file being edited
    const mode = active.sessionDir ? 'mywork' : (active.preset ? 'template' : null);
    let activeFilePath = null;
    if (mode === 'mywork' && active.sessionDir && active.file) {
      activeFilePath = path.join(active.sessionDir, 'content', active.file);
    } else if (mode === 'template' && active.preset) {
      activeFilePath = path.join(GENERATORS_DIR, 'templates', active.preset + '.html');
    }

    // Stable 8-char hash so the agent can uniquely identify the open item even when
    // a built-in template and a My Work project share the same name
    const contentId = activeFilePath
      ? crypto.createHash('sha256').update(activeFilePath).digest('hex').slice(0, 8)
      : null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      activeFile: active.file ?? null,
      activePreset: active.preset ?? null,
      activeSessionDir: active.sessionDir ?? null,
      activeFilePath,
      mode,
      contentId,
      preset,
    }));
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

  // /api/template?file=xxx — serve a template HTML file from generators/templates/
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

  // /api/content — return raw HTML without script injection (app extracts .social-card elements)
  if (req.method === 'GET' && pathname === '/api/content') {
    const fileParam = parsed.searchParams.get('file');
    if (!fileParam) { res.writeHead(400); res.end('Missing ?file='); return; }
    const filePath = path.join(CONTENT_DIR, path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // /api/files — return sorted list of HTML files in content dir
  if (req.method === 'GET' && pathname === '/api/files') {
    const files = getContentFiles().map(f => f.name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  // /static/* — serve generator app assets (app.html, app.css, app.js, lib/*)
  if (req.method === 'GET' && pathname.startsWith('/static/')) {
    const rel = pathname.slice(8); // strip "/static/"
    const filePath = path.resolve(GENERATORS_DIR, rel);
    // Guard against path traversal outside generators dir
    if (!filePath.startsWith(GENERATORS_DIR + path.sep) && filePath !== GENERATORS_DIR) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    serveFile(res, filePath);
    return;
  }

  // /vendor/* — serve vendor scripts (html2canvas, jszip)
  if (req.method === 'GET' && pathname.startsWith('/vendor/')) {
    const filePath = path.join(VENDOR_DIR, path.basename(pathname.slice(8)));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    serveFile(res, filePath);
    return;
  }

  // /api/sessions — list all sessions from the .codi_output parent
  // Includes sessions with manifest.json AND sessions that only have content files (legacy)
  if (req.method === 'GET' && pathname === '/api/sessions') {
    const sessionsParent = path.dirname(SESSION_DIR);
    const sessions = [];
    if (fs.existsSync(sessionsParent)) {
      let dirs;
      try { dirs = fs.readdirSync(sessionsParent); } catch { dirs = []; }
      for (const dir of dirs) {
        const sessionAbsDir = path.join(sessionsParent, dir);
        const manifestPath = path.join(sessionAbsDir, 'state', 'manifest.json');
        const contentDir = path.join(sessionAbsDir, 'content');
        const htmlFiles = fs.existsSync(contentDir)
          ? fs.readdirSync(contentDir).filter(f => f.endsWith('.html'))
          : [];

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            // Only include if it has content OR is the active session
            if (htmlFiles.length > 0 || manifest.sessionDir === SESSION_DIR) {
              sessions.push({ ...manifest, sessionDir: sessionAbsDir, files: htmlFiles });
            }
          } catch { /* skip corrupt manifest */ }
        } else if (htmlFiles.length > 0) {
          // Legacy session: no manifest, but has content — synthesize one
          const stat = fs.statSync(sessionAbsDir);
          sessions.push({
            sessionDir: sessionAbsDir,
            created: stat.birthtimeMs || stat.ctimeMs,
            preset: null,
            files: htmlFiles,
          });
        }
      }
    }
    sessions.sort((a, b) => (b.created || 0) - (a.created || 0));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // /api/session-content — serve an HTML file from a specific session's content dir
  if (req.method === 'GET' && pathname === '/api/session-content') {
    const sessionParam = parsed.searchParams.get('session');
    const fileParam = parsed.searchParams.get('file');
    if (!sessionParam || !fileParam) { res.writeHead(400); res.end('Missing params'); return; }
    const sessionsParent = path.normalize(path.dirname(SESSION_DIR));
    const resolvedSession = path.normalize(path.resolve(sessionParam));
    if (!resolvedSession.startsWith(sessionsParent + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    const filePath = path.join(resolvedSession, 'content', path.basename(fileParam));
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath, 'utf-8'));
    return;
  }

  // /api/export-png — render card HTML to PNG using Playwright (pixel-perfect)
  if (req.method === 'POST' && pathname === '/api/export-png') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', async () => {
      try {
        const { html, width, height } = JSON.parse(body);
        if (!html || !width || !height) { res.writeHead(400); res.end('Missing html/width/height'); return; }
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        // deviceScaleFactor: 2 → exports at 2× resolution (2160×2160 for 1:1 cards)
        // giving retina-quality output for LinkedIn, Instagram, and other social platforms
        const page = await browser.newPage({ deviceScaleFactor: 2 });
        await page.setViewportSize({ width, height });
        await page.setContent(html, { waitUntil: 'networkidle' });
        // Extra wait to ensure fonts (Google Fonts) have rendered
        await page.waitForTimeout(500);
        // clip uses CSS pixels — Playwright scales up by deviceScaleFactor automatically
        // so a 1080×1080 clip with deviceScaleFactor:2 → 2160×2160px PNG
        const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
        await browser.close();
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
        res.end(png);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // / — always serve the content factory app
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

// ========== WebSocket Connection Handling ==========

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
      try {
        result = decodeFrame(buffer);
      } catch (e) {
        socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
        clients.delete(socket);
        return;
      }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);

      switch (result.opcode) {
        case OPCODES.TEXT:
          handleMessage(result.payload.toString());
          break;
        case OPCODES.CLOSE:
          socket.end(encodeFrame(OPCODES.CLOSE, Buffer.alloc(0)));
          clients.delete(socket);
          return;
        case OPCODES.PING:
          socket.write(encodeFrame(OPCODES.PONG, result.payload));
          break;
        case OPCODES.PONG:
          break;
        default: {
          const closeBuf = Buffer.alloc(2);
          closeBuf.writeUInt16BE(1003);
          socket.end(encodeFrame(OPCODES.CLOSE, closeBuf));
          clients.delete(socket);
          return;
        }
      }
    }
  });

  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}

function handleMessage(text) {
  let event;
  try {
    event = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse WebSocket message:', e.message);
    return;
  }
  touchActivity();
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  if (event.choice) {
    const eventsFile = path.join(STATE_DIR, 'events');
    fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  }
}

function broadcast(msg) {
  const frame = encodeFrame(OPCODES.TEXT, Buffer.from(JSON.stringify(msg)));
  for (const socket of clients) {
    try { socket.write(frame); } catch (e) { clients.delete(socket); }
  }
}

// ========== Activity Tracking ==========

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivity = Date.now();

function touchActivity() {
  lastActivity = Date.now();
}

// ========== File Watching ==========

const debounceTimers = new Map();

// ========== Server Startup ==========

function startServer() {
  if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  writeManifest();

  // Track known files to distinguish new screens from updates.
  // macOS fs.watch reports 'rename' for both new files and overwrites,
  // so we can't rely on eventType alone.
  const knownFiles = new Set(
    fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.html'))
  );

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch generators/templates/ — when the agent adds or edits a template HTML file,
  // broadcast reload-templates so the browser refreshes the gallery without a full page reload.
  const TEMPLATES_DIR = path.join(GENERATORS_DIR, 'templates');
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  const presetsWatcher = fs.watch(TEMPLATES_DIR, (eventType, filename) => {
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

  const watcher = fs.watch(CONTENT_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;

    if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      const filePath = path.join(CONTENT_DIR, filename);

      if (!fs.existsSync(filePath)) return; // file was deleted
      touchActivity();

      if (!knownFiles.has(filename)) {
        knownFiles.add(filename);
        const eventsFile = path.join(STATE_DIR, 'events');
        if (fs.existsSync(eventsFile)) fs.unlinkSync(eventsFile);
        console.log(JSON.stringify({ type: 'screen-added', file: filePath }));
      } else {
        console.log(JSON.stringify({ type: 'screen-updated', file: filePath }));
      }

      writeManifest();
      broadcast({ type: 'reload' });
    }, 100));
  });
  watcher.on('error', (err) => console.error('fs.watch error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const infoFile = path.join(STATE_DIR, 'server-info');
    if (fs.existsSync(infoFile)) fs.unlinkSync(infoFile);
    fs.writeFileSync(
      path.join(STATE_DIR, 'server-stopped'),
      JSON.stringify({ reason, timestamp: Date.now() }) + '\n'
    );
    watcher.close();
    presetsWatcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  function ownerAlive() {
    if (!ownerPid) return true;
    try { process.kill(ownerPid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
  }

  // Check every 60s: exit if owner process died or idle for 30 minutes
  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) shutdown('idle timeout');
  }, 60 * 1000);
  lifecycleCheck.unref();

  // Validate owner PID at startup. If it's already dead, the PID resolution
  // was wrong (common on WSL, Tailscale SSH, and cross-user scenarios).
  // Disable monitoring and rely on the idle timeout instead.
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
      session_dir: SESSION_DIR, screen_dir: CONTENT_DIR, state_dir: STATE_DIR
    });
    console.log(info);
    fs.writeFileSync(path.join(STATE_DIR, 'server-info'), info + '\n');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { computeAcceptKey, encodeFrame, decodeFrame, OPCODES };
