'use strict';

// Validation REST endpoints — Layer 1 primitive + config control surface.
// Every endpoint is always reachable even when validation is disabled, so
// users/agents can always probe current state.

const path = require('node:path');

const validator = require('../lib/validator.cjs');
const cfgLib = require('../lib/validation-config.cjs');
const { sendJson, readJsonBody } = require('../lib/http-utils.cjs');

const MAX_BODY = 128 * 1024;

function isInsideWorkspace(project, ctx) {
  if (!project || !ctx.WORKSPACE_DIR) return false;
  const resolved = path.resolve(project);
  return resolved.startsWith(path.resolve(ctx.WORKSPACE_DIR) + path.sep);
}

function isValidationEnabled(cfg) {
  if (!cfg) return true;
  if (cfg.enabled === false) return false;
  return true;
}

function disabledResponse(reason) {
  return {
    ok: true,
    skipped: reason || 'validation-disabled',
    pass: true,
    valid: true,
    score: null,
    violations: [],
  };
}

// ============================================================================
// Handlers
// ============================================================================

async function handleValidateCardPost(req, res, ctx) {
  readJsonBody(req, MAX_BODY, async (err, body) => {
    if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
    const { project, file, cardIndex, force } = body || {};
    if (!project || !file || !Number.isInteger(cardIndex)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'project, file, and integer cardIndex are required',
      });
    }
    if (!isInsideWorkspace(project, ctx)) {
      return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
    }
    try {
      const { config } = cfgLib.resolveConfig({
        workspaceDir: ctx.WORKSPACE_DIR,
        projectDir: project,
        file,
      });
      if (!force && !isValidationEnabled(config)) {
        return sendJson(res, 200, disabledResponse('master-switch-off'));
      }
      if (!force && config.layers && config.layers.endpoint === false) {
        return sendJson(res, 200, disabledResponse('endpoint-layer-off'));
      }
      const result = await validator.validateCard(project, file, cardIndex, {
        preset: config.preset,
        threshold: config.threshold,
        tolerance: config.tolerance,
      });
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || String(e) });
    }
  });
}

async function handleValidateCardsGet(req, res, ctx, parsed) {
  const project = parsed.searchParams.get('project');
  const file = parsed.searchParams.get('file');
  const force = parsed.searchParams.get('force') === '1';
  if (!project || !file) {
    return sendJson(res, 400, { ok: false, error: 'project and file are required' });
  }
  if (!isInsideWorkspace(project, ctx)) {
    return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
  }
  try {
    const { config } = cfgLib.resolveConfig({
      workspaceDir: ctx.WORKSPACE_DIR,
      projectDir: project,
      file,
    });
    if (!force && !isValidationEnabled(config)) {
      return sendJson(res, 200, { ok: true, skipped: 'master-switch-off', pass: true, cards: [] });
    }
    const result = await validator.validateAllCards(project, file, {
      preset: config.preset,
      threshold: config.threshold,
      tolerance: config.tolerance,
    });
    sendJson(res, 200, result);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message || String(e) });
  }
}

function handleGetConfig(req, res, ctx, parsed) {
  const project = parsed.searchParams.get('project');
  const file = parsed.searchParams.get('file') || null;
  const user = parsed.searchParams.get('user') === 'true';

  if (user) {
    const defaults = cfgLib.readUserDefaults(ctx.WORKSPACE_DIR) || {};
    return sendJson(res, 200, { scope: 'user', config: defaults });
  }
  if (!project) {
    return sendJson(res, 400, { ok: false, error: 'project or user=true is required' });
  }
  if (!isInsideWorkspace(project, ctx)) {
    return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
  }
  try {
    const resolved = cfgLib.resolveConfig({
      workspaceDir: ctx.WORKSPACE_DIR,
      projectDir: project,
      file,
    });
    sendJson(res, 200, {
      scope: 'session',
      config: resolved.config,
      source: resolved.source,
      contentType: resolved.type,
    });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message || String(e) });
  }
}

function handlePatchConfig(req, res, ctx) {
  readJsonBody(req, MAX_BODY, (err, body) => {
    if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
    const { project, user, patch } = body || {};
    if (!patch || typeof patch !== 'object') {
      return sendJson(res, 400, { ok: false, error: 'patch object is required' });
    }
    try {
      if (user === true) {
        const current = cfgLib.readUserDefaults(ctx.WORKSPACE_DIR) || {};
        const merged = cfgLib.deepMerge(current, patch);
        cfgLib.writeUserDefaults(ctx.WORKSPACE_DIR, merged);
        return sendJson(res, 200, { ok: true, scope: 'user', config: merged });
      }
      if (!project) {
        return sendJson(res, 400, { ok: false, error: 'project or user=true is required' });
      }
      if (!isInsideWorkspace(project, ctx)) {
        return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
      }
      const resolved = cfgLib.patchSessionConfig({
        workspaceDir: ctx.WORKSPACE_DIR,
        projectDir: project,
        patch,
      });
      sendJson(res, 200, {
        ok: true,
        scope: 'session',
        config: resolved.config,
        source: resolved.source,
      });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || String(e) });
    }
  });
}

function handleToggle(req, res, ctx) {
  readJsonBody(req, MAX_BODY, (err, body) => {
    if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
    const { project, layer, value } = body || {};
    if (!project || !layer || typeof value !== 'boolean') {
      return sendJson(res, 400, { ok: false, error: 'project, layer, boolean value required' });
    }
    if (!isInsideWorkspace(project, ctx)) {
      return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
    }
    const validLayers = ['all', 'endpoint', 'badge', 'agentDiscipline', 'exportPreflight', 'statusGate'];
    if (!validLayers.includes(layer)) {
      return sendJson(res, 400, { ok: false, error: 'unknown layer: ' + layer });
    }
    try {
      const resolved = cfgLib.setLayer({
        workspaceDir: ctx.WORKSPACE_DIR,
        projectDir: project,
        layer,
        value,
      });
      sendJson(res, 200, { ok: true, layer, value, config: resolved.config });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || String(e) });
    }
  });
}

function handleIgnoreViolation(req, res, ctx) {
  readJsonBody(req, MAX_BODY, (err, body) => {
    if (err) return sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
    const { project, file, rule, selector, cardIndex } = body || {};
    if (!project || !file || !rule) {
      return sendJson(res, 400, { ok: false, error: 'project, file, rule required' });
    }
    if (!isInsideWorkspace(project, ctx)) {
      return sendJson(res, 403, { ok: false, error: 'project outside workspace' });
    }
    try {
      const resolved = cfgLib.addIgnoreRule({
        workspaceDir: ctx.WORKSPACE_DIR,
        projectDir: project,
        file,
        rule,
        selector: selector || null,
        cardIndex: Number.isInteger(cardIndex) ? cardIndex : null,
      });
      sendJson(res, 200, { ok: true, config: resolved.config });
    } catch (e) {
      sendJson(res, 500, { ok: false, error: e.message || String(e) });
    }
  });
}

function handleHealth(req, res) {
  sendJson(res, 200, validator.getHealth());
}

// ============================================================================
// Dispatcher
// ============================================================================

function handle(req, res, parsed, ctx) {
  const pathname = parsed.pathname;
  const method = req.method || 'GET';

  if (pathname === '/api/validate-card' && method === 'POST') {
    handleValidateCardPost(req, res, ctx);
    return true;
  }
  if (pathname === '/api/validate-cards' && method === 'GET') {
    handleValidateCardsGet(req, res, ctx, parsed);
    return true;
  }
  if (pathname === '/api/validation-config' && method === 'GET') {
    handleGetConfig(req, res, ctx, parsed);
    return true;
  }
  if (pathname === '/api/validation-config' && method === 'PATCH') {
    handlePatchConfig(req, res, ctx);
    return true;
  }
  if (pathname === '/api/validation-config/toggle' && method === 'POST') {
    handleToggle(req, res, ctx);
    return true;
  }
  if (pathname === '/api/validation-config/ignore-violation' && method === 'POST') {
    handleIgnoreViolation(req, res, ctx);
    return true;
  }
  if (pathname === '/api/validator-health' && method === 'GET') {
    handleHealth(req, res);
    return true;
  }
  return false;
}

module.exports = {
  handle,
  // Exported for integration tests
  _handlers: {
    handleValidateCardPost,
    handleValidateCardsGet,
    handleGetConfig,
    handlePatchConfig,
    handleToggle,
    handleIgnoreViolation,
    handleHealth,
  },
  _validator: validator,
  _cfgLib: cfgLib,
};
