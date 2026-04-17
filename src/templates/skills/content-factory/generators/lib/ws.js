// WebSocket connection — live-reload channel from the server.
//
// On `reload` we refresh the active content in place; on `reload-templates`
// we rebuild the gallery. Reconnects with exponential backoff.

import { state } from "./state.js";
import { $, clearEl, log } from "./dom.js";

let ws = null;
let wsReconnectTimer = null;
let wsBackoff = 1000;

// Module-local references set by app.js once all circular-dep modules are
// loaded. This avoids ES-module cycles between ws.js → file-manager.js →
// card-strip.js → gallery.js.
let _loadFiles = () => {};
let _reloadCurrentContent = () => {};
let _loadTemplates = () => Promise.resolve();
let _initGallery = () => {};
let _loadTemplateAsCards = () => {};
let _renderCards = () => {};

export function registerWsHandlers(handlers) {
  if (handlers.loadFiles) _loadFiles = handlers.loadFiles;
  if (handlers.reloadCurrentContent) _reloadCurrentContent = handlers.reloadCurrentContent;
  if (handlers.loadTemplates) _loadTemplates = handlers.loadTemplates;
  if (handlers.initGallery) _initGallery = handlers.initGallery;
  if (handlers.loadTemplateAsCards) _loadTemplateAsCards = handlers.loadTemplateAsCards;
  if (handlers.renderCards) _renderCards = handlers.renderCards;
}

// galleryInit is a mutable flag owned by gallery.js. We import and set it
// via a setter so the WS can invalidate the cache.
let _setGalleryStale = () => {};
export function registerGalleryStaleSetter(fn) {
  _setGalleryStale = fn;
}

export function connectWS() {
  if (ws && ws.readyState < 2) return;
  ws = new WebSocket("ws://" + window.location.host);
  ws.addEventListener("open", () => {
    wsBackoff = 1000;
    clearTimeout(wsReconnectTimer);
    const dot = $("ws-dot");
    if (dot) dot.className = "ws-dot connected";
    log("Live connection active", "ok");
    _loadFiles();
  });
  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "reload") {
        log("Content updated", "accent");
        _reloadCurrentContent();
      } else if (msg.type === "reload-templates") {
        log("Templates updated — refreshing gallery…", "accent");
        _setGalleryStale();
        const grid = $("gallery-grid");
        if (grid) clearEl(grid);
        _loadTemplates().then(() => {
          if ($("view-gallery") && $("view-gallery").classList.contains("active")) {
            _initGallery();
          }
          if (state.preset) {
            const t = state.templates.find((x) => x.id === state.preset);
            if (t) {
              _loadTemplateAsCards(t);
              _renderCards();
            }
          }
        });
      }
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener("close", () => {
    const dot = $("ws-dot");
    if (dot) dot.className = "ws-dot disconnected";
    wsReconnectTimer = setTimeout(() => {
      wsBackoff = Math.min(wsBackoff * 1.5, 15000);
      connectWS();
    }, wsBackoff);
  });
  ws.addEventListener("error", () => ws && ws.close());
}
