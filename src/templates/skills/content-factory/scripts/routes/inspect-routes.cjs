'use strict';

// Live element inspection for content-factory.
//
// Mirrors the html-live-inspect skill: an injected client script on every
// served HTML response reports the currently clicked element plus a
// multi-selection set, and the agent can run JS inside the page via
// /api/eval.
//
// Selection state is GLOBAL (not scoped per card). Clicking inside any
// preview iframe replaces the single active element; Cmd/Ctrl+click
// toggles multi-set membership across cards.

const fs = require('fs');
const path = require('path');

const elementStore = require('../lib/element-store.cjs');
const eventLog = require('../lib/event-log.cjs');
const evalBridge = require('../lib/eval-bridge.cjs');
const { sendJson, readJsonBody, serveFile: _serveFile } = require('../lib/http-utils.cjs');
const cardSource = require('../lib/card-source.cjs');
const cfId = require('../lib/cf-id.cjs');

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const INSPECTOR_CLIENT_PATH = path.join(__dirname, '..', 'client', 'inspector.js');

function serveInspectorClient(res) {
  if (!fs.existsSync(INSPECTOR_CLIENT_PATH)) {
    sendJson(res, 500, { error: 'inspector client missing' });
    return;
  }
  const js = fs.readFileSync(INSPECTOR_CLIENT_PATH, 'utf-8');
  const buf = Buffer.from(js, 'utf-8');
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(buf);
}

function handle(req, res, parsed /*, ctx */) {
  const pathname = parsed.pathname;
  const method = req.method || 'GET';

  // --- Internal: inspector client ---
  if (pathname === '/__inspect/inspector.js' && method === 'GET') {
    serveInspectorClient(res);
    return true;
  }

  // --- Internal: ingest (selection + events + page) ---
  if (pathname === '/__inspect/ingest' && method === 'POST') {
    readJsonBody(req, MAX_BODY_BYTES, (err, body) => {
      if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      if (body && body.page) elementStore.updatePage(body.page);
      if (body && body.clearSelection) elementStore.clearSelection();
      if (body && body.clearSelectionSet) elementStore.clearSet();
      if (body && body.selection) elementStore.setSelection(body.selection, body.context);
      if (body && body.selectionSetOp && body.selectionSetOp.op === 'add' && body.selectionSetOp.snapshot) {
        elementStore.addToSet(body.selectionSetOp.snapshot, body.context);
      }
      if (body && body.selectionSetOp && body.selectionSetOp.op === 'remove' && body.selectionSetOp.selector) {
        elementStore.removeFromSet(body.selectionSetOp.selector);
      }
      if (body && Array.isArray(body.events)) {
        for (const ev of body.events) eventLog.record(ev);
      }
      sendJson(res, 200, { ok: true, selectionSetSize: elementStore.setSize() });
    });
    return true;
  }

  // --- Internal: long-poll for agent → page eval ---
  if (pathname === '/__inspect/eval-pull' && method === 'GET') {
    evalBridge.next().then((task) => sendJson(res, 200, { task: task || null }));
    return true;
  }

  // --- Internal: push eval result back ---
  if (pathname === '/__inspect/eval-push' && method === 'POST') {
    readJsonBody(req, MAX_BODY_BYTES, (err, body) => {
      if (err || !body || typeof body.id !== 'number') {
        return sendJson(res, 400, { ok: false, error: 'invalid push payload' });
      }
      const delivered = evalBridge.submit(body.id, body);
      sendJson(res, 200, { ok: true, delivered });
    });
    return true;
  }

  // --- Agent-facing: current active element ---
  if (pathname === '/api/active-element' && method === 'GET') {
    sendJson(res, 200, elementStore.getSelection() || null);
    return true;
  }

  // --- Agent-facing: multi-selection set ---
  if (pathname === '/api/active-elements' && method === 'GET') {
    sendJson(res, 200, { count: elementStore.setSize(), selections: elementStore.listSet() });
    return true;
  }
  if (pathname === '/api/active-elements' && method === 'DELETE') {
    elementStore.clearSet();
    sendJson(res, 200, { ok: true, count: 0 });
    return true;
  }

  // --- Agent-facing: recent interactions ---
  if (pathname === '/api/inspect-events' && method === 'GET') {
    const since = Number(parsed.searchParams.get('since') || 0);
    const limit = Number(parsed.searchParams.get('limit') || 0) || undefined;
    sendJson(res, 200, eventLog.since(since, limit));
    return true;
  }

  // --- Agent-facing: persist a style edit to the card source file ---
  //
  // POST /api/persist-style
  //   { project, file, targetSelector, patches: {prop: value}, snapshot? }
  // Response: { ok, cfId, rule, sourceModified, bytesWritten }
  // 409 on selector drift (source changed since selection).
  if (pathname === '/api/persist-style' && method === 'POST') {
    readJsonBody(req, MAX_BODY_BYTES, (err, body) => {
      if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      handlePersistStyle(res, body);
    });
    return true;
  }
  // DELETE /api/persist-style?cfId=...&project=...&file=...
  if (pathname === '/api/persist-style' && method === 'DELETE') {
    const cfIdParam = parsed.searchParams.get('cfId');
    const project = parsed.searchParams.get('project');
    const file = parsed.searchParams.get('file');
    handlePersistStyleRevert(res, { cfId: cfIdParam, project, file });
    return true;
  }
  // GET /api/persist-style?project=...&file=...
  if (pathname === '/api/persist-style' && method === 'GET') {
    const project = parsed.searchParams.get('project');
    const file = parsed.searchParams.get('file');
    handlePersistStyleList(res, { project, file });
    return true;
  }

  // --- Agent-facing: run JS inside the current preview page ---
  if (pathname === '/api/eval' && method === 'POST') {
    if (!evalBridge.isEnabled()) {
      sendJson(res, 403, { ok: false, error: 'eval is disabled' });
      return true;
    }
    readJsonBody(req, MAX_BODY_BYTES, (err, body) => {
      if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      const js = body && body.js;
      const timeoutMs = body && body.timeoutMs;
      evalBridge.createTask(js, timeoutMs).then((r) => sendJson(res, r.status, r.body));
    });
    return true;
  }

  return false;
}

// ============================================================================
// persist-style handlers
// ============================================================================

function resolveCardFile(project, file) {
  if (!project || !file) {
    return { error: 'project and file are required' };
  }
  const filePath = path.resolve(project, 'content', path.basename(file));
  const projectAbs = path.resolve(project);
  if (!filePath.startsWith(projectAbs + path.sep)) {
    return { error: 'path escapes project dir' };
  }
  if (!fs.existsSync(filePath)) {
    return { error: 'file does not exist: ' + filePath };
  }
  return { filePath };
}

function buildCfIdSelector(id) {
  return '[data-cf-id="' + id + '"]';
}

function contextTarget(ctx) {
  // A context is a valid persist target only when it is a session (not
  // read-only) and carries a sessionDir + file.
  if (!ctx) return null;
  // New unified shape first
  if (ctx.readOnly === true) {
    return { templateBlocked: true, templateId: ctx.templateId || ctx.id || null };
  }
  if (ctx.sessionDir && ctx.file) {
    return { project: ctx.sessionDir, file: ctx.file, source: 'context' };
  }
  // Legacy shape fallback (kind/readOnly may be missing on older clients)
  if (ctx.project && ctx.file) {
    return { project: ctx.project, file: ctx.file, source: 'legacy-context' };
  }
  if (ctx.templateId && !ctx.project && !ctx.sessionDir) {
    return { templateBlocked: true, templateId: ctx.templateId };
  }
  return null;
}

function resolvePersistTarget(body) {
  // Priority order:
  //   1. Explicit project+file in the request body (agent-driven override)
  //   2. Context from the currently-active single selection
  //   3. Context from the matching multi-selection entry
  //
  // Selection context is the authoritative source — the server never
  // guesses from global state.
  if (body && body.project && body.file) {
    return { project: body.project, file: body.file, source: 'body' };
  }
  const current = elementStore.getSelection();
  const fromCurrent = contextTarget(current && current.context);
  if (fromCurrent) return fromCurrent;
  if (body && body.targetSelector) {
    const match = elementStore.listSet().find((e) => e.selector === body.targetSelector);
    const fromMulti = contextTarget(match && match.context);
    if (fromMulti) return fromMulti;
  }
  return null;
}

function handlePersistStyle(res, body) {
  const { targetSelector, patches, snapshot } = body || {};
  if (!targetSelector || typeof targetSelector !== 'string') {
    return sendJson(res, 400, { ok: false, error: 'targetSelector is required' });
  }
  if (!patches || typeof patches !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'patches object is required' });
  }
  const target = resolvePersistTarget(body);
  if (!target) {
    return sendJson(res, 400, {
      ok: false,
      error: 'could not resolve project+file — no active selection with context and no explicit project/file in body',
    });
  }
  if (target.templateBlocked) {
    const templateId = target.templateId;
    return sendJson(res, 409, {
      ok: false,
      error: 'cannot persist edits to a built-in template',
      templateId,
      suggestion: 'save the template to My Work first, then re-click the element and retry',
      // Ready-to-use payload for the agent: POST this to clone the template
      // into a fresh session. After cloning, reload the page with
      // ?kind=session&id=<new-id>, re-click the same element, and retry.
      cloneSuggestion: {
        endpoint: '/api/clone-template-to-session',
        method: 'POST',
        body: { templateId },
      },
    });
  }
  const resolved = resolveCardFile(target.project, target.file);
  if (resolved.error) return sendJson(res, 400, { ok: false, error: resolved.error });

  const filePath = resolved.filePath;
  let html;
  try {
    html = cardSource.readFileSafe(filePath);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'read failed: ' + e.message });
  }

  // Locate the element in the source file.
  let node;
  try {
    node = cardSource.findElement(html, targetSelector);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'selector parse: ' + e.message });
  }
  if (!node) {
    return sendJson(res, 409, {
      ok: false,
      error: 'source changed — selector no longer matches',
      suggestion: 'refresh selection and retry',
    });
  }

  // Resolve or assign a stable id. Prefer a real id attribute when present,
  // fall back to data-cf-id, otherwise generate a new one.
  let ruleSelector;
  let assignedCfId = null;
  if (node.attrs.id) {
    ruleSelector = '#' + node.attrs.id;
  } else if (node.attrs['data-cf-id']) {
    assignedCfId = node.attrs['data-cf-id'];
    ruleSelector = buildCfIdSelector(assignedCfId);
  } else {
    // Collect ids already in use to avoid collisions on generateUnique.
    const allNodes = cardSource.walk(html);
    const taken = new Set();
    for (const n of allNodes) {
      const v = n.attrs['data-cf-id'];
      if (v) taken.add(v);
    }
    const fp = snapshot || {
      tag: node.name,
      id: '',
      classes: (node.attrs.class || '').split(/\s+/).filter(Boolean),
      parentTag: node.parent ? node.parent.name : '',
      text: '',
    };
    assignedCfId = cfId.generateUnique(fp, taken);
    ruleSelector = buildCfIdSelector(assignedCfId);
    html = cardSource.setAttributeInOpenTag(html, node, 'data-cf-id', assignedCfId);
  }

  // Upsert the CSS rule in the <style> block's user-edits region.
  let newHtml;
  try {
    newHtml = cardSource.upsertStyleRule(html, ruleSelector, patches);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'css patch: ' + e.message });
  }

  let writeResult;
  try {
    writeResult = cardSource.writeAtomic(filePath, newHtml);
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: 'write failed: ' + e.message });
  }

  const rule = ruleSelector + ' { ' +
    Object.entries(patches).map(([k, v]) => k + ': ' + v + ';').join(' ') + ' }';

  sendJson(res, 200, {
    ok: true,
    cfId: assignedCfId,
    selector: ruleSelector,
    rule,
    sourceModified: !writeResult.skipped,
    bytesWritten: writeResult.bytesWritten,
  });
}

function handlePersistStyleRevert(res, params) {
  const { cfId: id, project, file } = params;
  if (!id) return sendJson(res, 400, { ok: false, error: 'cfId is required' });
  const resolved = resolveCardFile(project, file);
  if (resolved.error) return sendJson(res, 400, { ok: false, error: resolved.error });

  const filePath = resolved.filePath;
  const html = cardSource.readFileSafe(filePath);
  const selector = buildCfIdSelector(id);

  // Remove the rule first.
  const afterRuleDelete = cardSource.deleteStyleRule(html, selector);
  const remaining = cardSource.listStyleRules(afterRuleDelete);
  const stillReferenced = remaining.some((r) => r.selector === selector);

  // Strip the data-cf-id attribute from whichever element carries it.
  // We do NOT go through findElement because the parser does not handle
  // attribute selectors — walk nodes directly and match by attribute value.
  let finalHtml = afterRuleDelete;
  if (!stillReferenced) {
    const nodes = cardSource.walk(afterRuleDelete);
    const node = nodes.find((n) => n.attrs['data-cf-id'] === id);
    if (node) {
      finalHtml = cardSource.removeAttributeInOpenTag(afterRuleDelete, node, 'data-cf-id');
    }
  }

  const writeResult = cardSource.writeAtomic(filePath, finalHtml);
  sendJson(res, 200, {
    ok: true,
    cfId: id,
    removed: !stillReferenced,
    sourceModified: !writeResult.skipped,
  });
}

function handlePersistStyleList(res, params) {
  const { project, file } = params;
  const resolved = resolveCardFile(project, file);
  if (resolved.error) return sendJson(res, 400, { ok: false, error: resolved.error });
  const html = cardSource.readFileSafe(resolved.filePath);
  const rules = cardSource.listStyleRules(html);
  sendJson(res, 200, { ok: true, count: rules.length, rules });
}

// Eval enabled by default — matches html-live-inspect. Can be flipped via
// env var CONTENT_FACTORY_ALLOW_EVAL=0.
evalBridge.configure({ allowEval: process.env.CONTENT_FACTORY_ALLOW_EVAL !== '0' });
eventLog.configure({ capacity: 500 });

module.exports = {
  handle,
  // Exported for integration tests — direct handler invocation plus the
  // exact elementStore instance the handlers close over, so tests can
  // seed selection state and assert against the same singleton.
  _handlers: {
    handlePersistStyle,
    handlePersistStyleRevert,
    handlePersistStyleList,
  },
  _elementStore: elementStore,
};
