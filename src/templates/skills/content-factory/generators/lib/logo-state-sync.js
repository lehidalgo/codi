// Persist logo-overlay state per content file to <project>/state/logo-state.json
// and restore it on load, so per-page positions survive browser refresh,
// file-watcher reloads, and server restarts.
//
// The module owns two operations:
//   - loadLogoState(): fetch persisted state for the currently-active file
//     and apply it to `state.logo` + `state.cardLogos`. Called from the
//     content-load path (file-manager) after cards are parsed.
//   - scheduleSave(): debounce a POST to /api/project/logo-state reflecting
//     the current state.logo + state.cardLogos. Called from every slider /
//     toggle mutation.
//
// No hardcoded defaults — the defaults live in state.js (`defaultLogoSize`
// and the initial `state.logo`). This module is a pure sync layer.

import { state } from "./state.js";

const SAVE_DEBOUNCE_MS = 300;
let saveTimer = null;
let saveInFlight = null;

function currentFileKey() {
  // Match what the server expects: a relative POSIX path under content/.
  // `state.activeFile` is already that shape (e.g. "document/onepager.html").
  return state.activeFile || null;
}

function builtPayload() {
  return {
    file: currentFileKey(),
    logo: {
      visible: state.logo.visible,
      size: state.logo.size,
      x: state.logo.x,
      y: state.logo.y,
      userOverridden: state.logo.userOverridden,
    },
    cardLogos: state.cardLogos,
    cardCount: state.cards.length,
  };
}

/**
 * Fetch persisted state for the active content file and apply it over the
 * current in-memory state. Safe to call when no state is persisted yet —
 * the 404 leaves the in-memory defaults in place.
 */
export async function loadLogoState() {
  const file = currentFileKey();
  if (!file) return;
  const qs = new URLSearchParams({ file, cardCount: String(state.cards.length) });
  try {
    const r = await fetch("/api/project/logo-state?" + qs.toString());
    if (r.status === 404) return;
    if (!r.ok) return;
    const saved = await r.json();
    if (saved && saved.logo && typeof saved.logo === "object") {
      state.logo.visible = saved.logo.visible;
      state.logo.size = saved.logo.size;
      state.logo.x = saved.logo.x;
      state.logo.y = saved.logo.y;
      state.logo.userOverridden = !!saved.logo.userOverridden;
    }
    // Replace cardLogos wholesale — the server already sanitized out any
    // keys beyond state.cards.length, so trusting the response keeps the
    // in-memory map aligned with the authoritative on-disk state.
    state.cardLogos =
      saved && saved.cardLogos && typeof saved.cardLogos === "object" ? saved.cardLogos : {};
  } catch {
    /* network / JSON errors — fall back to current in-memory defaults */
  }
}

/**
 * Debounced save. Coalesces rapid slider movements into a single POST and
 * always schedules the latest state, so the on-disk file cannot lag the
 * UI by more than SAVE_DEBOUNCE_MS + one request latency.
 */
export function scheduleSave() {
  if (!currentFileKey()) return; // no active file → nowhere to persist
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

async function flushSave() {
  saveTimer = null;
  // If a previous save is still in flight, chain a new one behind it so
  // we never POST two concurrent writes for the same file.
  if (saveInFlight) {
    await saveInFlight.catch(() => {});
  }
  const payload = builtPayload();
  if (!payload.file) return;
  saveInFlight = fetch("/api/project/logo-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .catch(() => {
      /* surface through console only — persistence is best-effort */
    })
    .finally(() => {
      saveInFlight = null;
    });
}

/**
 * Flush pending save synchronously-ish. Call from beforeunload handlers
 * to reduce the chance of losing the last tweak when the user closes the
 * tab mid-debounce.
 */
export function flushPendingSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return flushSave();
  }
  return Promise.resolve();
}
