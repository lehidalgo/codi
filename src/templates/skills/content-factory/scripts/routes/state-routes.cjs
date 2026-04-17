'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const state = require('../lib/project-state.cjs');
const { readJson, sendJson, readJsonBody } = require('../lib/http-utils.cjs');
const { isValidType } = require('../lib/content-types.cjs');

/**
 * Routes that manage session/preset/active-file/active-card/brief state.
 * Returns true if the request was handled.
 */
function handle(req, res, parsed, ctx) {
  const { pathname } = parsed;

  // /api/preset GET
  if (req.method === 'GET' && pathname === '/api/preset') {
    const active = state.getActiveProject();
    const data = active
      ? readJson(path.join(active.stateDir, 'preset.json'), { id: null })
      : { id: null };
    sendJson(res, 200, data);
    return true;
  }

  // /api/preset POST
  if (req.method === 'POST' && pathname === '/api/preset') {
    readJsonBody(req, (err, data) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      if (data && data.type && !isValidType(data.type)) {
        return sendJson(res, 400, { ok: false, error: 'Invalid type: ' + data.type + '. Must be one of: social, slides, document' });
      }
      const active = state.getActiveProject();
      if (active) {
        fs.writeFileSync(path.join(active.stateDir, 'preset.json'), JSON.stringify(data, null, 2));
        state.writeProjectManifest();
      }
      console.log(JSON.stringify({ type: 'preset-selected', ...data }));
      sendJson(res, 200, { ok: true });
    });
    return true;
  }

  // /api/active-file GET
  if (req.method === 'GET' && pathname === '/api/active-file') {
    const active = state.getActiveProject();
    const stateDir = active ? active.stateDir : path.join(ctx.WORKSPACE_DIR, '_state');
    const data = readJson(path.join(stateDir, 'active.json'), { file: null, preset: null });
    sendJson(res, 200, data);
    return true;
  }

  // /api/active-file POST
  if (req.method === 'POST' && pathname === '/api/active-file') {
    readJsonBody(req, (err, data) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      const projDir = data.projectDir || data.sessionDir || null;
      if (projDir) state.setActiveProject(projDir);
      const active = state.getActiveProject();
      const stateDir = active ? active.stateDir : path.join(ctx.WORKSPACE_DIR, '_state');
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(path.join(stateDir, 'active.json'), JSON.stringify({ ...data, timestamp: Date.now() }, null, 2));
      sendJson(res, 200, { ok: true });
    });
    return true;
  }

  // /api/active-card GET
  if (req.method === 'GET' && pathname === '/api/active-card') {
    const active = state.getActiveProject();
    const stateDir = active ? active.stateDir : path.join(ctx.WORKSPACE_DIR, '_state');
    const data = readJson(path.join(stateDir, 'active-card.json'), {
      index: null, total: null, dataType: null, dataIdx: null, file: null, timestamp: null,
    });
    sendJson(res, 200, data);
    return true;
  }

  // /api/active-card POST
  if (req.method === 'POST' && pathname === '/api/active-card') {
    readJsonBody(req, (err, data) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      const active = state.getActiveProject();
      const stateDir = active ? active.stateDir : path.join(ctx.WORKSPACE_DIR, '_state');
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(
        path.join(stateDir, 'active-card.json'),
        JSON.stringify({ ...data, timestamp: Date.now() }, null, 2)
      );
      sendJson(res, 200, { ok: true });
    });
    return true;
  }

  // /api/brief GET
  if (req.method === 'GET' && pathname === '/api/brief') {
    const active = state.getActiveProject();
    if (!active) { sendJson(res, 200, null); return true; }
    const data = readJson(path.join(active.dir, 'brief.json'), null);
    sendJson(res, 200, data);
    return true;
  }

  // /api/brief POST
  if (req.method === 'POST' && pathname === '/api/brief') {
    const active = state.getActiveProject();
    if (!active) {
      sendJson(res, 400, { error: 'No active project — create one first via /api/create-project' });
      return true;
    }
    readJsonBody(req, (err, data) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      const briefPath = path.join(active.dir, 'brief.json');
      fs.writeFileSync(briefPath, JSON.stringify(data, null, 2));
      sendJson(res, 200, { ok: true, path: briefPath });
    });
    return true;
  }

  // /api/distill-status GET — anchor revision + per-variant staleness
  //
  // Reads the active project's brief.json and returns a summary of the
  // anchor's current revision plus each declared variant's derivation
  // status. A variant is "stale" when derivedFromRevision < anchor.revision.
  // Variants with no derivedFromRevision field are reported as status
  // "pending" (not yet distilled). Returns null when no project is active.
  //
  // Response shape:
  //   {
  //     anchor: { file, revision, status } | null,
  //     variants: [{ file, format, derivedFromRevision, status, staleBy }],
  //     stale: ["file1.html", ...]
  //   }
  if (req.method === 'GET' && pathname === '/api/distill-status') {
    const active = state.getActiveProject();
    if (!active) { sendJson(res, 200, null); return true; }
    const brief = readJson(path.join(active.dir, 'brief.json'), null);
    if (!brief) {
      sendJson(res, 200, { anchor: null, variants: [], stale: [] });
      return true;
    }
    const anchor = brief.anchor || null;
    const anchorRevision = anchor && typeof anchor.revision === 'number' ? anchor.revision : 0;
    const variants = Array.isArray(brief.variants) ? brief.variants : [];
    const stale = [];
    const enrichedVariants = variants.map((v) => {
      const derivedFrom = typeof v.derivedFromRevision === 'number' ? v.derivedFromRevision : null;
      let status = v.status || (derivedFrom === null ? 'pending' : 'ready');
      let staleBy = 0;
      if (derivedFrom !== null && derivedFrom < anchorRevision) {
        status = 'stale';
        staleBy = anchorRevision - derivedFrom;
        stale.push(v.file);
      }
      return { ...v, derivedFromRevision: derivedFrom, status, staleBy };
    });
    sendJson(res, 200, { anchor, variants: enrichedVariants, stale });
    return true;
  }

  // /api/anchor/revise POST — bump anchor revision, mark variants stale
  //
  // Call after a substantive anchor edit. Body is optional (accepts
  // { reason?: string } for audit trail). Increments brief.anchor.revision
  // by 1, sets status to "draft", marks every variant with
  // derivedFromRevision < new revision as status: "stale", and writes back.
  //
  // The agent decides what counts as a "substantive" edit — cosmetic
  // changes need not bump. When in doubt, bump: a spurious staleness flag
  // is cheaper than silent drift.
  if (req.method === 'POST' && pathname === '/api/anchor/revise') {
    const active = state.getActiveProject();
    if (!active) {
      sendJson(res, 400, { error: 'No active project' });
      return true;
    }
    readJsonBody(req, (err, body) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      const briefPath = path.join(active.dir, 'brief.json');
      const brief = readJson(briefPath, null);
      if (!brief) {
        sendJson(res, 400, { error: 'No brief.json in project — create one via POST /api/brief first' });
        return;
      }
      const currentRevision = (brief.anchor && typeof brief.anchor.revision === 'number')
        ? brief.anchor.revision : 0;
      const newRevision = currentRevision + 1;
      brief.anchor = {
        ...(brief.anchor || {}),
        revision: newRevision,
        status: 'draft',
        revisedAt: new Date().toISOString(),
        ...(body && body.reason ? { lastReviseReason: String(body.reason) } : {}),
      };
      if (Array.isArray(brief.variants)) {
        brief.variants = brief.variants.map((v) => {
          const derivedFrom = typeof v.derivedFromRevision === 'number' ? v.derivedFromRevision : null;
          if (derivedFrom !== null && derivedFrom < newRevision) {
            return { ...v, status: 'stale' };
          }
          return v;
        });
      }
      fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
      sendJson(res, 200, { ok: true, brief });
    });
    return true;
  }

  // /api/anchor/approve POST — mark anchor approved, ready for distillation
  //
  // Call when the user has explicitly approved the current anchor and
  // distillation should begin. Sets brief.anchor.status = "approved" and
  // records approvedAt timestamp. Idempotent: calling twice at the same
  // revision is a no-op.
  if (req.method === 'POST' && pathname === '/api/anchor/approve') {
    const active = state.getActiveProject();
    if (!active) {
      sendJson(res, 400, { error: 'No active project' });
      return true;
    }
    readJsonBody(req, (err) => {
      if (err) return sendJson(res, 400, { error: 'Invalid JSON' });
      const briefPath = path.join(active.dir, 'brief.json');
      const brief = readJson(briefPath, null);
      if (!brief) {
        sendJson(res, 400, { error: 'No brief.json in project — create one via POST /api/brief first' });
        return;
      }
      brief.anchor = {
        ...(brief.anchor || { revision: 1 }),
        status: 'approved',
        approvedAt: new Date().toISOString(),
      };
      fs.writeFileSync(briefPath, JSON.stringify(brief, null, 2));
      sendJson(res, 200, { ok: true, brief });
    });
    return true;
  }

  // /api/state GET — aggregate state for agent orientation
  if (req.method === 'GET' && pathname === '/api/state') {
    const active = state.getActiveProject();
    const activeBrand = state.getActiveBrand();
    const stateDir = active ? active.stateDir : path.join(ctx.WORKSPACE_DIR, '_state');
    const preset = readJson(path.join(stateDir, 'preset.json'), null);
    const activeFile = readJson(path.join(stateDir, 'active.json'), { file: null, preset: null });
    const activeCard = readJson(path.join(stateDir, 'active-card.json'), null);
    const brief = active ? readJson(path.join(active.dir, 'brief.json'), null) : null;
    const mode = active ? 'mywork' : (activeFile.preset ? 'template' : null);
    let activeFilePath = null;
    if (mode === 'mywork' && active && activeFile.file) {
      activeFilePath = path.join(active.contentDir, activeFile.file);
    } else if (mode === 'template' && activeFile.preset) {
      activeFilePath = path.join(ctx.GENERATORS_DIR, 'templates', activeFile.preset + '.html');
    }
    const contentId = activeFilePath
      ? crypto.createHash('sha256').update(activeFilePath).digest('hex').slice(0, 8)
      : null;
    let activeStatus = null;
    if (active) {
      const m = readJson(path.join(active.stateDir, 'manifest.json'), {});
      activeStatus = m.status || 'draft';
    }
    sendJson(res, 200, {
      activeFile: activeFile.file ?? null,
      activePreset: activeFile.preset ?? null,
      activeSessionDir: active ? active.dir : null,
      activeFilePath,
      mode, contentId,
      status: activeStatus,
      preset,
      activeCard,
      brief,
      activeBrand: activeBrand ? { name: activeBrand.name, display_name: activeBrand.display_name } : null,
    });
    return true;
  }

  return false;
}

module.exports = { handle };
