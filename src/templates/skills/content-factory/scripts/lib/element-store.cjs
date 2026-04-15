'use strict';

// In-memory store for the currently locked DOM selection and a short history.
// The history is capped so repeated clicks do not grow unbounded.

const HISTORY_CAP = 50;

let current = null;
const history = [];
// Multi-selection set — keyed by selector so repeats dedupe automatically.
const selectionSet = new Map();
const pageMeta = {
  url: null,
  title: null,
  viewport: null,
  userAgent: null,
  lastUpdateMs: 0,
};

function setSelection(payload, context) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const snapshot = {
    ...payload,
    context: context || payload.context || null,
    timestamp: Date.now(),
  };
  current = snapshot;
  history.unshift({
    seq: snapshot.seq,
    timestamp: snapshot.timestamp,
    selector: snapshot.selector,
    tag: snapshot.tag,
    id: snapshot.id,
    classes: snapshot.classes,
    text: snapshot.text,
    pageUrl: snapshot.pageUrl,
  });
  if (history.length > HISTORY_CAP) history.length = HISTORY_CAP;
  return snapshot;
}

function clearSelection() {
  current = null;
}

function getSelection() {
  return current;
}

function getHistory(limit) {
  const n = Number.isFinite(limit) && limit > 0 ? Math.min(limit, HISTORY_CAP) : HISTORY_CAP;
  return history.slice(0, n);
}

function updatePage(meta) {
  if (!meta || typeof meta !== 'object') return;
  if (meta.url != null) pageMeta.url = meta.url;
  if (meta.title != null) pageMeta.title = meta.title;
  if (meta.viewport != null) pageMeta.viewport = meta.viewport;
  if (meta.userAgent != null) pageMeta.userAgent = meta.userAgent;
  pageMeta.lastUpdateMs = Date.now();
}

function getPage() {
  return { ...pageMeta };
}

function addToSet(snapshot, context) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.selector) return null;
  const entry = {
    ...snapshot,
    context: context || snapshot.context || null,
    timestamp: Date.now(),
  };
  selectionSet.set(snapshot.selector, entry);
  return entry;
}

function removeFromSet(selector) {
  if (!selector) return false;
  return selectionSet.delete(selector);
}

function clearSet() {
  selectionSet.clear();
}

function listSet() {
  return Array.from(selectionSet.values());
}

function setSize() {
  return selectionSet.size;
}

module.exports = {
  setSelection,
  clearSelection,
  getSelection,
  getHistory,
  updatePage,
  getPage,
  addToSet,
  removeFromSet,
  clearSet,
  listSet,
  setSize,
};
