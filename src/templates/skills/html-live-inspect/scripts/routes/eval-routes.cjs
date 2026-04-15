'use strict';

// Agent-facing POST /api/eval
// Internal inspector long-poll GET /__inspect/eval-pull
// Internal inspector result POST /__inspect/eval-push

function handleEval(req, res, deps) {
  const { httpUtils, evalBridge, maxBodyBytes } = deps;

  if (req.method !== 'POST') {
    httpUtils.sendStatus(res, 405, 'method not allowed');
    return;
  }
  if (!evalBridge.isEnabled()) {
    httpUtils.sendJson(res, 403, { ok: false, error: 'eval is disabled (server started with --no-eval)' });
    return;
  }

  httpUtils.readJsonBody(req, maxBodyBytes, (err, body) => {
    if (err) {
      httpUtils.sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      return;
    }
    const js = body && body.js;
    const timeoutMs = body && body.timeoutMs;
    evalBridge
      .createTask(js, timeoutMs)
      .then((result) => {
        httpUtils.sendJson(res, result.status, result.body);
      })
      .catch((e) => {
        httpUtils.sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
      });
  });
}

function handlePull(req, res, deps) {
  const { httpUtils, evalBridge } = deps;
  evalBridge.next().then((task) => {
    if (!task) {
      httpUtils.sendJson(res, 200, { task: null });
      return;
    }
    httpUtils.sendJson(res, 200, { task });
  });
}

function handlePush(req, res, deps) {
  const { httpUtils, evalBridge, maxBodyBytes } = deps;
  if (req.method !== 'POST') {
    httpUtils.sendStatus(res, 405, 'method not allowed');
    return;
  }
  httpUtils.readJsonBody(req, maxBodyBytes, (err, body) => {
    if (err || !body || typeof body.id !== 'number') {
      httpUtils.sendJson(res, 400, { ok: false, error: 'invalid push payload' });
      return;
    }
    const delivered = evalBridge.submit(body.id, body);
    httpUtils.sendJson(res, 200, { ok: true, delivered });
  });
}

module.exports = { handleEval, handlePull, handlePush };
