// content-factory app entry — thin orchestrator that wires event listeners
// and boots the app. All feature logic lives in generators/lib/*.
//
// URL-pinned project state stays here because the URL-pinning structural
// test asserts specific strings live in this file.

import { state, STATUS_LABEL } from "./lib/state.js";
import { $, clearEl, log, setView, registerOnLeavePreview } from "./lib/dom.js";
import { buildTemplateContentFromRegistry } from "./lib/content-descriptor.js";
import { connectWS, registerWsHandlers, registerGalleryStaleSetter } from "./lib/ws.js";
import {
  loadFiles,
  reloadCurrentContent,
  loadTemplates,
  registerRenderCards,
} from "./lib/file-manager.js";
import {
  renderCards,
  setActiveCard,
  setViewMode,
  loadTemplateAsCards,
  toggleSelectAll,
  applyLogoChange,
  applyLogoToAllCards,
  syncLogoSlidersToSelection,
  registerUpdateExportPanel,
} from "./lib/card-strip.js";
import { updateExportPanel } from "./lib/exports-ui.js";
import { initGallery, filterGallery, loadSessionContent, setGalleryStale } from "./lib/gallery.js";
import { registerPanelOpener } from "./lib/validation-badge.js";
import { openValidationPanel, closeValidationPanel } from "./lib/validation-panel.js";
import { initValidationSettings } from "./lib/validation-settings.js";

// Wire forward-references so cycles resolve at runtime.
registerRenderCards(renderCards);
registerUpdateExportPanel(updateExportPanel);
registerGalleryStaleSetter(setGalleryStale);
registerWsHandlers({
  loadFiles,
  reloadCurrentContent,
  loadTemplates,
  initGallery,
  loadTemplateAsCards,
  renderCards,
});
// Validation badge -> panel wiring (validation-badge.js registers the
// opener lazily so badges don't need to import the panel directly).
registerPanelOpener((report, ctx) => openValidationPanel(report, ctx));
registerOnLeavePreview(() => closeValidationPanel());

// ====== Format switching ======
function setFormat(btn) {
  document.querySelectorAll(".fmt").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.format = { w: Number(btn.dataset.w), h: Number(btn.dataset.h) };
  log(
    "Format: " +
      btn.querySelector("b").textContent +
      " (" +
      state.format.w +
      "x" +
      state.format.h +
      ")",
  );
  if (state.cards.length) renderCards();
  updateExportPanel(state.cards.length > 0);
}

// ====== Init ======
function init() {
  // Format grid
  $("format-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".fmt");
    if (btn) setFormat(btn);
  });

  // Handle input
  const handleEl = $("handle");
  handleEl.value = state.handle;
  handleEl.addEventListener("input", () => {
    state.handle = handleEl.value;
    if (state.cards.length) requestAnimationFrame(renderCards);
  });

  // Zoom
  const zoomSlider = $("zoom-slider");
  const zoomVal = $("zoom-val");
  zoomSlider.value = String(Math.round(state.zoom * 100));
  zoomVal.textContent = Math.round(state.zoom * 100) + "%";
  zoomSlider.addEventListener("input", () => {
    state.zoom = Number(zoomSlider.value) / 100;
    zoomVal.textContent = zoomSlider.value + "%";
    if (state.cards.length) renderCards();
  });

  // Window resize debounce
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.cards.length && state.viewMode === "app") renderCards();
    }, 60);
  });

  // Logo controls
  $("logo-toggle").addEventListener("click", () => {
    const newVisible = !state.logo.visible;
    state.logo.visible = newVisible;
    state.cards.forEach((_, i) => {
      if (!state.cardLogos[i]) state.cardLogos[i] = {};
      state.cardLogos[i].visible = newVisible;
    });
    applyLogoToAllCards();
    syncLogoSlidersToSelection();
  });
  $("logo-size").addEventListener("input", () => {
    applyLogoChange("size", Number($("logo-size").value));
    $("logo-size-val").textContent = $("logo-size").value;
  });
  $("logo-x").addEventListener("input", () => {
    applyLogoChange("x", Number($("logo-x").value));
    $("logo-x-val").textContent = $("logo-x").value + "%";
  });
  $("logo-y").addEventListener("input", () => {
    applyLogoChange("y", Number($("logo-y").value));
    $("logo-y-val").textContent = $("logo-y").value + "%";
  });

  // Gallery filters
  $("gallery-filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.galleryFilter = btn.dataset.type;
    if (btn.dataset.type !== "work") {
      state.workStatusFilter = "all";
      document
        .querySelectorAll(".status-filter-btn")
        .forEach((b) => b.classList.toggle("active", b.dataset.status === "all"));
    }
    filterGallery();
  });

  $("work-status-filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".status-filter-btn");
    if (!btn) return;
    document.querySelectorAll(".status-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.workStatusFilter = btn.dataset.status;
    filterGallery();
  });

  // Preview status dropdown
  $("preview-status-select").addEventListener("change", async (e) => {
    const next = e.target.value;
    state.activeStatus = next;
    const wrap = $("status-select-wrap");
    if (wrap) wrap.className = "status-select-wrap status-" + next;
    if (state.activeSessionDir) {
      const card = document.querySelector(
        `.session-card[data-session-dir="${CSS.escape(state.activeSessionDir)}"]`,
      );
      if (card) {
        card.dataset.status = next;
        const badge = card.querySelector(".session-status-badge");
        if (badge) {
          badge.dataset.status = next;
          badge.className = "session-status-badge status-" + next;
          badge.textContent = STATUS_LABEL[next];
        }
      }
      await fetch("/api/session-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDir: state.activeSessionDir, status: next }),
      }).catch(() => {});
    }
  });

  // Tabs
  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

  // View mode toggle
  $("btn-vm-grid").addEventListener("click", () => setViewMode("grid"));
  $("btn-vm-app").addEventListener("click", () => setViewMode("app"));

  // Card nav
  $("btn-prev").addEventListener("click", () => {
    if (state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
  });
  $("btn-next").addEventListener("click", () => {
    if (state.activeCard < state.cards.length - 1) setActiveCard(state.activeCard + 1, false);
  });

  // Refresh button
  $("btn-refresh").addEventListener("click", async () => {
    const btn = $("btn-refresh");
    btn.classList.add("spinning");
    await reloadCurrentContent();
    setTimeout(() => btn.classList.remove("spinning"), 500);
  });

  // App-mode prev/next
  const appPrev = $("app-prev");
  const appNext = $("app-next");
  if (appPrev)
    appPrev.addEventListener("click", () => {
      if (state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
    });
  if (appNext)
    appNext.addEventListener("click", () => {
      if (state.activeCard < state.cards.length - 1) setActiveCard(state.activeCard + 1, false);
    });

  // Keyboard nav
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
    if (e.key === "ArrowRight" && state.activeCard < state.cards.length - 1)
      setActiveCard(state.activeCard + 1, false);
  });

  // Default view mode button state
  $("btn-vm-grid").classList.remove("active");
  $("btn-vm-app").classList.add("active");

  $("btn-select-toggle").addEventListener("click", toggleSelectAll);

  // ====== Validation settings widget ======
  initValidationSettings();

  // ====== Inspect-elements toggle ======
  state.inspectOn = false;
  const inspectBtn = $("inspect-toggle");
  function applyInspectMode() {
    // Wake ONLY the currently-active card iframe; every other .card-frame
    // iframe stays dormant. This guarantees /api/eval tasks route to the
    // card the user is looking at.
    const all = document.querySelectorAll(".card-content iframe");
    for (const f of all) {
      const frame = f.closest(".card-frame");
      const isActive = state.inspectOn && frame && frame.classList.contains("active-card");
      try {
        const w = f.contentWindow;
        if (!w) continue;
        if (w.__HLI__ && typeof w.__HLI__.setDormant === "function") {
          w.__HLI__.setDormant(!isActive);
        } else {
          w.__HLI_DORMANT__ = !isActive;
        }
      } catch {}
    }
  }
  window._cfApplyInspect = applyInspectMode;
  inspectBtn.addEventListener("click", () => {
    state.inspectOn = !state.inspectOn;
    inspectBtn.textContent = state.inspectOn ? "ON" : "OFF";
    inspectBtn.classList.toggle("active", state.inspectOn);
    document.body.classList.toggle("inspect-on", state.inspectOn);
    applyInspectMode();
  });

  // Fetch the inspector source once and cache for buildCardDoc to inline.
  fetch("/__inspect/inspector.js")
    .then((r) => (r.ok ? r.text() : ""))
    .then((src) => {
      state._inspectorSource = src || "";
      if (state.cards.length) requestAnimationFrame(renderCards);
    })
    .catch(() => {});

  // ====== URL-pinned tab state ======
  // The URL is the SINGLE SOURCE OF TRUTH for what this tab is viewing.
  // Reload always lands here. Two tabs = two URLs = two independent states.
  function updateUrlFromState() {
    try {
      const c = state.activeContent;
      const p = new URLSearchParams();
      if (c && c.kind && c.id) {
        p.set("kind", c.kind);
        p.set("id", c.id);
        if (c.source && c.source.file) p.set("file", c.source.file);
      }
      if (Number.isInteger(state.activeCard) && state.activeCard > 0) {
        p.set("card", String(state.activeCard));
      }
      const qs = p.toString();
      const next = qs ? "?" + qs : location.pathname;
      if (location.search !== "?" + qs && location.href !== next) {
        history.replaceState(null, "", next || location.pathname);
      }
    } catch {}
  }
  window._cfUpdateUrl = updateUrlFromState;

  async function restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    const kind = params.get("kind");
    const id = params.get("id");
    const cardIdx = Number(params.get("card")) || 0;

    // Back-compat: honor the old ?project= and ?preset= params for one
    // release so existing bookmarks keep working.
    const legacyProject = params.get("project");
    const legacyPreset = params.get("preset");
    const resolvedKind = kind || (legacyProject ? "session" : legacyPreset ? "template" : null);
    const resolvedId =
      id || (legacyProject ? legacyProject.split("/").pop() : null) || legacyPreset || null;

    if (!resolvedKind || !resolvedId) return false;

    if (!state.templates || !state.templates.length) {
      try {
        await loadTemplates();
      } catch {}
    }

    if (resolvedKind === "session") {
      try {
        const res = await fetch("/api/sessions");
        const list = await res.json();
        const session = Array.isArray(list)
          ? list.find((s) => s.sessionDir && s.sessionDir.endsWith("/" + resolvedId)) ||
            list.find((s) => s.sessionDir === legacyProject)
          : null;
        if (session) {
          try {
            await fetch("/api/open-project", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectDir: session.sessionDir }),
            });
          } catch {}
          await loadSessionContent(session);
          if (cardIdx) setActiveCard(cardIdx, false);
          return true;
        }
      } catch {}
      return false;
    }

    if (resolvedKind === "template") {
      const t = state.templates.find((x) => x.id === resolvedId);
      if (t) {
        state.preset = t.id;
        state.activeContent = buildTemplateContentFromRegistry(t);
        setView("preview");
        loadTemplateAsCards(t);
        if (cardIdx) setTimeout(() => setActiveCard(cardIdx, false), 50);
        return true;
      }
    }
    return false;
  }
  window._cfRestoreFromUrl = restoreFromUrl;

  updateExportPanel(false);
  connectWS();
  log("Content factory ready", "ok");

  // Load templates in background — gallery populates when ready.
  loadTemplates()
    .then(async () => {
      log("Loaded " + state.templates.length + " templates", "ok");
      setGalleryStale();
      clearEl($("gallery-grid"));
      if ($("view-gallery").classList.contains("active")) initGallery();

      // URL is the source of truth for "what is this tab viewing".
      // If it has ?kind= / ?id= (or legacy ?project= / ?preset=), restore
      // from it and stop. Otherwise fall back to /api/preset.
      const restored = await restoreFromUrl();
      if (restored) return null;
      return fetch("/api/preset").then((r) => r.json());
    })
    .then((data) => {
      if (data && data.id) {
        const t = state.templates.find((x) => x.id === data.id);
        if (t) {
          state.preset = t.id;
          log("Template: " + t.name);
          setView("preview");
          loadTemplateAsCards(t);
          updateUrlFromState();
        }
      }
    })
    .catch(() => {
      /* non-critical */
    });
}

document.addEventListener("DOMContentLoaded", init);
