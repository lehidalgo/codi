'use strict';

// html-live-inspect HTTP server.
//
// Serves a static site (file or directory) over http, injects an inspector
// script into every HTML response, and exposes a REST API that the coding
// agent polls for the latest user selection and interaction history.

const http = require('http');
const fs = require('fs');
const path = require('path');

const httpUtils = require('./lib/http-utils.cjs');
const workspace = require('./lib/workspace.cjs');
const selectionStore = require('./lib/selection-store.cjs');
const eventLog = require('./lib/event-log.cjs');
const evalBridge = require('./lib/eval-bridge.cjs');
const injector = require('./lib/injector.cjs');

const healthRoutes = require('./routes/health-routes.cjs');
const selectionRoutes = require('./routes/selection-routes.cjs');
const eventsRoutes = require('./routes/events-routes.cjs');
const domRoutes = require('./routes/dom-routes.cjs');
const evalRoutes = require('./routes/eval-routes.cjs');
const ingestRoutes = require('./routes/ingest-routes.cjs');

// ========== Configuration ==========

const SITE_DIR = process.env.HLI_SITE_DIR;
const HOST = process.env.HLI_HOST || '127.0.0.1';
const PORT = Number(process.env.HLI_PORT) || (49152 + Math.floor(Math.random() * 16383));
const URL_HOST = HOST === '127.0.0.1' ? 'localhost' : HOST;
const WORKSPACE_DIR = process.env.HLI_WORKSPACE || `/tmp/html-live-inspect-workspace-${process.pid}`;
const ALLOW_EVAL = process.env.HLI_ALLOW_EVAL !== '0';
const EVENT_BUFFER = Number(process.env.HLI_EVENT_BUFFER) || 500;
const IDLE_TIMEOUT_MS = Number(process.env.HLI_IDLE_TIMEOUT_MS) || 30 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const OWNER_PID = process.env.HLI_OWNER_PID ? Number(process.env.HLI_OWNER_PID) : null;

if (!SITE_DIR) {
  console.error(JSON.stringify({ error: 'HLI_SITE_DIR is required' }));
  process.exit(1);
}
if (!fs.existsSync(SITE_DIR)) {
  console.error(JSON.stringify({ error: `SITE_DIR does not exist: ${SITE_DIR}` }));
  process.exit(1);
}

const siteStat = fs.statSync(SITE_DIR);
const ROOT_DIR = siteStat.isDirectory() ? SITE_DIR : path.dirname(SITE_DIR);
const ENTRY_FILE = siteStat.isDirectory() ? null : path.basename(SITE_DIR);
const START_MS = Date.now();

workspace.init(WORKSPACE_DIR);
eventLog.configure({ capacity: EVENT_BUFFER });
evalBridge.configure({ allowEval: ALLOW_EVAL });

const serverContext = {
  siteDir: SITE_DIR,
  rootDir: ROOT_DIR,
  entryFile: ENTRY_FILE,
  startMs: START_MS,
  allowEval: ALLOW_EVAL,
  version: 1,
};

// ========== Idle watchdog ==========

let lastActivityMs = Date.now();
function touch() {
  lastActivityMs = Date.now();
}

setInterval(() => {
  if (Date.now() - lastActivityMs > IDLE_TIMEOUT_MS) {
    console.log('idle-shutdown');
    process.exit(0);
  }
}, 60_000).unref();

// Exit when the owning harness process is gone
if (OWNER_PID) {
  setInterval(() => {
    try {
      process.kill(OWNER_PID, 0);
    } catch {
      console.log('owner-gone-shutdown');
      process.exit(0);
    }
  }, 5_000).unref();
}

// ========== Static file serving with HTML injection ==========

function resolveStaticPath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') {
    rel = ENTRY_FILE ? `/${ENTRY_FILE}` : '/index.html';
  }
  const absolute = path.normalize(path.join(ROOT_DIR, rel));
  // Path traversal guard — absolute must stay within ROOT_DIR.
  if (!absolute.startsWith(ROOT_DIR)) return null;
  return absolute;
}

function serveStatic(req, res, urlPath) {
  const filePath = resolveStaticPath(urlPath);
  if (!filePath) {
    httpUtils.sendStatus(res, 403, 'forbidden');
    return;
  }
  if (!fs.existsSync(filePath)) {
    httpUtils.sendStatus(res, 404, 'not found');
    return;
  }
  const st = fs.statSync(filePath);
  if (st.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      serveStaticFile(res, indexPath);
      return;
    }
    httpUtils.sendStatus(res, 404, 'directory listing not enabled');
    return;
  }
  serveStaticFile(res, filePath);
}

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = httpUtils.mimeFor(ext);
  if (ext === '.html' || ext === '.htm') {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const injected = injector.inject(raw);
    httpUtils.sendText(res, 200, contentType, injected);
    return;
  }
  const buf = fs.readFileSync(filePath);
  httpUtils.sendText(res, 200, contentType, buf);
}

// ========== Inspector client serving ==========

const INSPECTOR_CLIENT_PATH = path.join(__dirname, 'client', 'inspector.js');

function serveInspectorClient(res) {
  if (!fs.existsSync(INSPECTOR_CLIENT_PATH)) {
    httpUtils.sendStatus(res, 500, 'inspector client missing');
    return;
  }
  const js = fs.readFileSync(INSPECTOR_CLIENT_PATH, 'utf-8');
  httpUtils.sendText(res, 200, httpUtils.mimeFor('.js'), js);
}

// ========== Router ==========

function router(req, res) {
  touch();
  const method = req.method || 'GET';
  const urlPath = (req.url || '/').split('?')[0];

  // Inspector client + internal ingest/pull/push
  if (urlPath === '/__inspect/inspector.js') {
    serveInspectorClient(res);
    return;
  }
  if (urlPath.startsWith('/__inspect/') || urlPath.startsWith('/api/')) {
    const deps = {
      httpUtils,
      selectionStore,
      eventLog,
      evalBridge,
      serverContext,
      maxBodyBytes: MAX_BODY_BYTES,
    };

    if (urlPath === '/api/health') return healthRoutes.handleHealth(req, res, deps);
    if (urlPath === '/api/page') return healthRoutes.handlePage(req, res, deps);
    if (urlPath === '/api/selection') return selectionRoutes.handleCurrent(req, res, deps);
    if (urlPath === '/api/selection/history') return selectionRoutes.handleHistory(req, res, deps);
    if (urlPath === '/api/selections') {
      if (method === 'DELETE') return selectionRoutes.handleClearSet(req, res, deps);
      return selectionRoutes.handleSet(req, res, deps);
    }
    if (urlPath === '/api/events') {
      if (method === 'DELETE') return eventsRoutes.handleClear(req, res, deps);
      return eventsRoutes.handleSince(req, res, deps);
    }
    if (urlPath === '/api/dom') return domRoutes.handleDom(req, res, deps);
    if (urlPath === '/api/eval') return evalRoutes.handleEval(req, res, deps);
    if (urlPath === '/__inspect/ingest') return ingestRoutes.handleIngest(req, res, deps);
    if (urlPath === '/__inspect/eval-pull') return evalRoutes.handlePull(req, res, deps);
    if (urlPath === '/__inspect/eval-push') return evalRoutes.handlePush(req, res, deps);

    httpUtils.sendStatus(res, 404, 'unknown endpoint');
    return;
  }

  // Static site
  serveStatic(req, res, urlPath);
}

const server = http.createServer((req, res) => {
  try {
    router(req, res);
  } catch (err) {
    console.error('router-error', err && err.stack ? err.stack : err);
    try {
      httpUtils.sendStatus(res, 500, 'server error');
    } catch {
      // Response may already be sent — nothing more we can do.
    }
  }
});

server.listen(PORT, HOST, () => {
  const actualPort = server.address().port;
  const url = `http://${URL_HOST}:${actualPort}`;
  const apiBase = `${url}/api`;
  workspace.writePid(process.pid);
  const startMessage = JSON.stringify({
    type: 'server-started',
    url,
    apiBase,
    pid: process.pid,
    siteDir: SITE_DIR,
    allowEval: ALLOW_EVAL,
    workspace: WORKSPACE_DIR,
  });
  console.log(startMessage);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
