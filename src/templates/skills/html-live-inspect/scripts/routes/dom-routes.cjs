'use strict';

// GET /api/dom?selector=<css>
// Uses the eval-bridge to ask the page to resolve the selector and return
// a selection-shape snapshot. Requires eval to be enabled because it
// executes JS in the page context.

function handleDom(req, res, deps) {
  const { httpUtils, evalBridge } = deps;
  const q = httpUtils.parseQuery(req.url || '');
  const selector = q.selector;

  if (!selector) {
    httpUtils.sendJson(res, 400, { ok: false, error: 'selector query param is required' });
    return;
  }
  if (!evalBridge.isEnabled()) {
    httpUtils.sendJson(res, 403, { ok: false, error: 'dom query requires eval to be enabled' });
    return;
  }

  const js = `return window.__HLI__ && window.__HLI__.describe(${JSON.stringify(selector)});`;

  evalBridge
    .createTask(js, 5_000)
    .then((result) => {
      httpUtils.sendJson(res, result.status, result.body);
    })
    .catch((err) => {
      httpUtils.sendJson(res, 500, { ok: false, error: String((err && err.message) || err) });
    });
}

module.exports = { handleDom };
