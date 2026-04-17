'use strict';

// Internal sink: POST /__inspect/ingest
// The injected inspector pushes selection snapshots, interaction events,
// and page-meta updates here.
//
// Body schema (all fields optional, any combination allowed):
//   {
//     "page": {url, title, viewport, userAgent}?,
//     "selection": {...fullSnapshot}?,      // replaces current selection
//     "clearSelection": true?,
//     "events": [{type, selector, ...}, ...]?
//   }

function handleIngest(req, res, deps) {
  const { httpUtils, selectionStore, eventLog, maxBodyBytes } = deps;

  if (req.method !== 'POST') {
    httpUtils.sendStatus(res, 405, 'method not allowed');
    return;
  }

  httpUtils.readJsonBody(req, maxBodyBytes, (err, body) => {
    if (err) {
      httpUtils.sendJson(res, 400, { ok: false, error: 'invalid JSON body' });
      return;
    }

    let recordedEvents = 0;
    let savedSelection = null;

    if (body && body.page) {
      selectionStore.updatePage(body.page);
    }
    if (body && body.clearSelection) {
      selectionStore.clearSelection();
    }
    if (body && body.clearSelectionSet) {
      selectionStore.clearSet();
    }
    if (body && body.selection) {
      savedSelection = selectionStore.setSelection(body.selection);
    }
    if (body && body.selectionSetOp && body.selectionSetOp.op === 'add' && body.selectionSetOp.snapshot) {
      selectionStore.addToSet(body.selectionSetOp.snapshot);
    }
    if (body && body.selectionSetOp && body.selectionSetOp.op === 'remove' && body.selectionSetOp.selector) {
      selectionStore.removeFromSet(body.selectionSetOp.selector);
    }
    if (body && Array.isArray(body.events)) {
      for (const ev of body.events) {
        if (eventLog.record(ev)) recordedEvents++;
      }
    }

    httpUtils.sendJson(res, 200, {
      ok: true,
      recordedEvents,
      selection: savedSelection ? { seq: savedSelection.seq, selector: savedSelection.selector } : null,
      selectionSetSize: selectionStore.setSize(),
    });
  });
}

module.exports = { handleIngest };
