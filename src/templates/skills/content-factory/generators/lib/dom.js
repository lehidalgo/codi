// DOM helpers used across every module. Small, dependency-free utilities
// that wrap the few document APIs we use.

import { state } from "./state.js";

export function $(id) {
  return document.getElementById(id);
}

export function clearEl(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

export function log(msg, type = "info") {
  const logEl = $("log");
  if (!logEl) return;
  const entry = document.createElement("div");
  entry.className = "log-entry " + type;
  const ts = new Date().toLocaleTimeString("en", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  entry.textContent = ts + "  " + msg;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
}

// Lazy import to avoid a cycle — gallery.js imports from dom.js, and
// setView needs to trigger gallery's initGallery. We resolve at call time.
let _initGallery = null;
export function _registerInitGallery(fn) {
  _initGallery = fn;
}

// Callbacks invoked when leaving preview (validation panel, inspect mode, etc.)
const _onLeavePreview = [];
export function registerOnLeavePreview(fn) {
  _onLeavePreview.push(fn);
}

export function setView(viewId) {
  document.querySelectorAll(".tab").forEach((t) => {
    const a = t.dataset.view === viewId;
    t.classList.toggle("active", a);
    t.setAttribute("aria-selected", String(a));
  });
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.toggle("active", v.id === "view-" + viewId));
  const vmBar = $("view-mode-bar");
  if (vmBar) vmBar.style.display = viewId === "preview" ? "" : "none";
  if (viewId !== "preview")
    _onLeavePreview.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  // Both Gallery and My Work panels are populated by initGallery — it
  // renders preset cards into #gallery-grid and session cards into
  // #work-grid in a single pass. Triggering on either tab ensures the
  // right grid is fresh after a new project or edit.
  if ((viewId === "gallery" || viewId === "work") && _initGallery) _initGallery();
}

export function setAppNavVisible(show) {
  const prev = $("app-prev");
  const next = $("app-next");
  if (!prev || !next) return;
  const total = state.cards.length;
  prev.style.display = show && state.activeCard > 0 ? "flex" : "none";
  next.style.display = show && state.activeCard < total - 1 ? "flex" : "none";
}

// Brief toast notification — appears, then fades out after 2s.
let _toastTimer = null;
export function showToast(message) {
  const el = $("update-toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("visible"), 2000);
}
