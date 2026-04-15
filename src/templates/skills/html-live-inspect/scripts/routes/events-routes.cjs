'use strict';

function handleSince(req, res, deps) {
  const { httpUtils, eventLog } = deps;
  const q = httpUtils.parseQuery(req.url || '');
  const since = q.since ? Number(q.since) : 0;
  const limit = q.limit ? Number(q.limit) : undefined;
  httpUtils.sendJson(res, 200, eventLog.since(since, limit));
}

function handleClear(req, res, deps) {
  const { httpUtils, eventLog } = deps;
  eventLog.clear();
  httpUtils.sendJson(res, 200, { ok: true });
}

module.exports = { handleSince, handleClear };
