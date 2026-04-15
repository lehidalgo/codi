'use strict';

function handleCurrent(req, res, deps) {
  const { httpUtils, selectionStore } = deps;
  httpUtils.sendJson(res, 200, selectionStore.getSelection() || null);
}

function handleHistory(req, res, deps) {
  const { httpUtils, selectionStore } = deps;
  const q = httpUtils.parseQuery(req.url || '');
  const limit = q.limit ? Number(q.limit) : 50;
  httpUtils.sendJson(res, 200, {
    history: selectionStore.getHistory(limit),
  });
}

function handleSet(req, res, deps) {
  const { httpUtils, selectionStore } = deps;
  httpUtils.sendJson(res, 200, {
    count: selectionStore.setSize(),
    selections: selectionStore.listSet(),
  });
}

function handleClearSet(req, res, deps) {
  const { httpUtils, selectionStore } = deps;
  selectionStore.clearSet();
  httpUtils.sendJson(res, 200, { ok: true, count: 0 });
}

module.exports = { handleCurrent, handleHistory, handleSet, handleClearSet };
