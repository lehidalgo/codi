'use strict';

function handleHealth(req, res, deps) {
  const { httpUtils, serverContext } = deps;
  httpUtils.sendJson(res, 200, {
    status: 'ok',
    uptimeMs: Date.now() - serverContext.startMs,
    siteDir: serverContext.siteDir,
    allowEval: serverContext.allowEval,
    version: serverContext.version,
  });
}

function handlePage(req, res, deps) {
  const { httpUtils, selectionStore } = deps;
  httpUtils.sendJson(res, 200, selectionStore.getPage());
}

module.exports = { handleHealth, handlePage };
