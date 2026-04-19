// Sidebar resize + collapse behaviour.
//
// The sidebar lives at `--sidebar-w` (a CSS variable on :root). This module
// lets the user drag its right edge to change that variable, and click a
// chevron button to collapse/expand it. Both values persist in localStorage
// so the layout sticks across reloads.

const MIN_W = 200;
const MAX_W = 420;
const DEFAULT_W = 264;
const KEY_W = "codi:sidebar-w";
const KEY_COLLAPSED = "codi:sidebar-collapsed";

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

function setWidth(px) {
  const w = clamp(Math.round(px), MIN_W, MAX_W);
  document.documentElement.style.setProperty("--sidebar-w", w + "px");
  try {
    localStorage.setItem(KEY_W, String(w));
  } catch {
    /* ignore */
  }
  return w;
}

function readWidth() {
  try {
    const raw = localStorage.getItem(KEY_W);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? clamp(n, MIN_W, MAX_W) : DEFAULT_W;
  } catch {
    return DEFAULT_W;
  }
}

function setCollapsed(on) {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.toggle("sidebar-collapsed", !!on);
  const toggle = document.getElementById("sidebar-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", on ? "false" : "true");
    toggle.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
  }
  try {
    localStorage.setItem(KEY_COLLAPSED, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function readCollapsed() {
  try {
    return localStorage.getItem(KEY_COLLAPSED) === "1";
  } catch {
    return false;
  }
}

function initResize() {
  const handle = document.getElementById("sidebar-resize");
  if (!handle) return;
  let dragging = false;
  let startX = 0;
  let startW = 0;
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    setWidth(startW + dx);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("sidebar-dragging");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  handle.addEventListener("mousedown", (e) => {
    // Ignore drag attempts while collapsed — handle is hidden anyway, but be safe.
    const app = document.getElementById("app");
    if (app && app.classList.contains("sidebar-collapsed")) return;
    dragging = true;
    startX = e.clientX;
    startW = readWidth();
    document.body.classList.add("sidebar-dragging");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
  // Double-click the handle to reset to default.
  handle.addEventListener("dblclick", () => setWidth(DEFAULT_W));
}

function initToggle() {
  const toggle = document.getElementById("sidebar-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const app = document.getElementById("app");
    const isCollapsed = app && app.classList.contains("sidebar-collapsed");
    setCollapsed(!isCollapsed);
  });
}

export function initSidebarResize() {
  // Restore persisted state before paint.
  setWidth(readWidth());
  setCollapsed(readCollapsed());
  initResize();
  initToggle();
}
