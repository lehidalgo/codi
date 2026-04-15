'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const workspace = require('./lib/workspace.cjs');
const wsProtocol = require('./lib/ws-protocol.cjs');
const state = require('./lib/project-state.cjs');
const stateRoutes = require('./routes/state-routes.cjs');
const brandRoutes = require('./routes/brand-routes.cjs');
const projectRoutes = require('./routes/project-routes.cjs');
const fileRoutes = require('./routes/file-routes.cjs');
const exportRoutes = require('./routes/export-routes.cjs');
const inspectRoutes = require('./routes/inspect-routes.cjs');
const contentRoutes = require('./routes/content-routes.cjs');

// ========== Configuration ==========

const PORT = process.env.BRAINSTORM_PORT || (49152 + Math.floor(Math.random() * 16383));
const HOST = process.env.BRAINSTORM_HOST || '127.0.0.1';
const URL_HOST = process.env.BRAINSTORM_URL_HOST || (HOST === '127.0.0.1' ? 'localhost' : HOST);
const WORKSPACE_DIR = process.env.BRAINSTORM_WORKSPACE || '/tmp/brainstorm-workspace';
const GENERATORS_DIR = path.join(__dirname, '..', 'generators');
const VENDOR_DIR = path.join(__dirname, 'vendor');
// Parent of the content-factory skill directory — contains all installed skills
const SKILLS_DIR = path.join(__dirname, '..', '..');
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

let ownerPid = process.env.BRAINSTORM_OWNER_PID ? Number(process.env.BRAINSTORM_OWNER_PID) : null;

const ctx = { WORKSPACE_DIR, GENERATORS_DIR, VENDOR_DIR, SKILLS_DIR };

state.init({ workspaceDir: WORKSPACE_DIR });

// ========== Request Dispatch ==========

function handleRequest(req, res) {
  state.touchActivity();
  const parsed = new URL(req.url, 'http://localhost');
  if (inspectRoutes.handle(req, res, parsed, ctx)) return;
  if (contentRoutes.handle(req, res, parsed, ctx)) return;
  if (stateRoutes.handle(req, res, parsed, ctx)) return;
  if (brandRoutes.handle(req, res, parsed, ctx)) return;
  if (projectRoutes.handle(req, res, parsed, ctx)) return;
  if (exportRoutes.handle(req, res, parsed, ctx)) return;
  if (fileRoutes.handle(req, res, parsed, ctx)) return;
  res.writeHead(404);
  res.end('Not found');
}

// ========== WebSocket Upgrade ==========

function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = wsProtocol.computeAcceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  let buffer = Buffer.alloc(0);
  const clients = state.getClients();
  clients.add(socket);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      let result;
      try { result = wsProtocol.decodeFrame(buffer); }
      catch {
        socket.end(wsProtocol.encodeFrame(wsProtocol.OPCODES.CLOSE, Buffer.alloc(0)));
        clients.delete(socket);
        return;
      }
      if (!result) break;
      buffer = buffer.slice(result.bytesConsumed);
      switch (result.opcode) {
        case wsProtocol.OPCODES.TEXT:
          handleMessage(result.payload.toString());
          break;
        case wsProtocol.OPCODES.CLOSE:
          socket.end(wsProtocol.encodeFrame(wsProtocol.OPCODES.CLOSE, Buffer.alloc(0)));
          clients.delete(socket);
          return;
        case wsProtocol.OPCODES.PING:
          socket.write(wsProtocol.encodeFrame(wsProtocol.OPCODES.PONG, result.payload));
          break;
        case wsProtocol.OPCODES.PONG:
          break;
        default: {
          const cb = Buffer.alloc(2);
          cb.writeUInt16BE(1003);
          socket.end(wsProtocol.encodeFrame(wsProtocol.OPCODES.CLOSE, cb));
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
  try { event = JSON.parse(text); } catch (e) { console.error('WS parse error:', e.message); return; }
  state.touchActivity();
  console.log(JSON.stringify({ source: 'user-event', ...event }));
  const active = state.getActiveProject();
  if (event.choice && active) {
    const eventsFile = path.join(active.stateDir, 'events');
    fs.appendFileSync(eventsFile, JSON.stringify(event) + '\n');
  }
}

// ========== Server Startup ==========

function startServer() {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  // Restore last active project
  const lastActiveDir = workspace.getActiveProjectDir(WORKSPACE_DIR);
  if (lastActiveDir && fs.existsSync(lastActiveDir)) {
    state.setActiveProject(lastActiveDir);
  }

  const server = http.createServer(handleRequest);
  server.on('upgrade', handleUpgrade);

  // Watch generators/templates/ for gallery live reload
  const TEMPLATES_DIR = path.join(GENERATORS_DIR, 'templates');
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  const templatesDebounce = new Map();
  const presetsWatcher = fs.watch(TEMPLATES_DIR, (eventType, filename) => {
    if (!filename || !filename.endsWith('.html')) return;
    const key = 'tpl:' + filename;
    if (templatesDebounce.has(key)) clearTimeout(templatesDebounce.get(key));
    templatesDebounce.set(key, setTimeout(() => {
      templatesDebounce.delete(key);
      state.touchActivity();
      console.log(JSON.stringify({ type: 'template-updated', file: filename }));
      state.broadcast({ type: 'reload-templates' });
    }, 150));
  });
  presetsWatcher.on('error', (err) => console.error('templates watcher error:', err.message));

  function shutdown(reason) {
    console.log(JSON.stringify({ type: 'server-stopped', reason }));
    const pidFile = path.join(WORKSPACE_DIR, '_server.pid');
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    fs.writeFileSync(
      path.join(WORKSPACE_DIR, '_server-stopped'),
      JSON.stringify({ reason, timestamp: Date.now() }) + '\n'
    );
    state.closeContentWatcher();
    presetsWatcher.close();
    clearInterval(lifecycleCheck);
    server.close(() => process.exit(0));
  }

  function ownerAlive() {
    if (!ownerPid) return true;
    try { process.kill(ownerPid, 0); return true; }
    catch (e) { return e.code === 'EPERM'; }
  }

  const lifecycleCheck = setInterval(() => {
    if (!ownerAlive()) shutdown('owner process exited');
    else if (Date.now() - state.getLastActivity() > IDLE_TIMEOUT_MS) shutdown('idle timeout');
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

module.exports = {
  computeAcceptKey: wsProtocol.computeAcceptKey,
  encodeFrame: wsProtocol.encodeFrame,
  decodeFrame: wsProtocol.decodeFrame,
  OPCODES: wsProtocol.OPCODES,
};
