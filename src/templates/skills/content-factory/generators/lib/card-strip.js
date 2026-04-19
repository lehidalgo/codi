// Card rendering core — preview card iframes, filmstrip thumbnails,
// card-level navigation, logo overlay, per-card selection, and the
// preview metadata bar.

import {
  cardFormat as _cardFormat,
  buildCardDoc as _buildCardDoc,
  computeCardSize as _computeCardSize,
} from "/static/lib/card-builder.js";

import { state } from "./state.js";
import { $, clearEl, setAppNavVisible } from "./dom.js";
import { formatTimeAgo } from "./content-descriptor.js";
import { createValidationBadge, runBatchValidation } from "./validation-badge.js";
import { loadLogo } from "./logo-loader.js";
import { runFitCheck } from "./fit-check.js";
import { scheduleSave as scheduleLogoStateSave } from "./logo-state-sync.js";

// ====== Card format + inspector-context-aware buildCardDoc ======

export function cardFormat(card) {
  return _cardFormat(card, state.format);
}

export function buildCardDoc(card, forExport = false, logo = null, cardIndex = null) {
  const fmt = cardFormat(card);
  // Inject the resolved project/brand logo bytes so exports render the
  // correct mark instead of the hardcoded built-in default.
  const logoWithSvg = logo ? { ...logo, svg: state.logoSvg || logo.svg } : logo;
  // Derive the inspector context directly from the unified active-content
  // descriptor. The shape matches what persist-style reads, so the agent
  // never has to reconcile two different models.
  const c = state.activeContent;
  const cardContext =
    !forExport && c
      ? {
          kind: c.kind,
          id: c.id,
          name: c.name,
          file: c.source && c.source.file,
          sessionDir: (c.source && c.source.sessionDir) || null,
          templateId: (c.source && c.source.templateId) || null,
          cardIndex: Number.isInteger(cardIndex) ? cardIndex : state.activeCard,
          readOnly: c.readOnly,
        }
      : null;
  return _buildCardDoc(
    card,
    fmt,
    logoWithSvg,
    state.handle || "handle",
    forExport,
    state._inspectorSource || "",
    cardContext,
  );
}

export function computeCardSize(card) {
  const fmt = cardFormat(card);
  const canvasEl = $("canvas");
  return _computeCardSize(fmt, {
    canvasW: Math.max(canvasEl.clientWidth, 400),
    canvasH: Math.max(canvasEl.clientHeight, 300),
    zoom: state.zoom,
    viewMode: state.viewMode,
  });
}

// ====== Per-card logo ======

export function getCardLogo(i) {
  return state.cardLogos[i] ? { ...state.logo, ...state.cardLogos[i] } : { ...state.logo };
}

export function applyLogoChange(prop, val) {
  // Scoping rule:
  //  - No explicit selection OR all pages selected → apply globally
  //    (state.logo + every cardLogos entry). This is the "document-wide"
  //    tweak path.
  //  - Subset of pages selected → apply per-selected-card only. This is
  //    the "per-page adjust" path: each selected page keeps its own
  //    position/size, and navigation preserves the override thanks to
  //    state.cardLogos[i].
  const noneSelected = state.selectedCards.size === 0;
  const allSelected = state.cards.length > 0 && state.selectedCards.size === state.cards.length;
  if (noneSelected || allSelected) {
    state.cards.forEach((_, i) => {
      if (!state.cardLogos[i]) state.cardLogos[i] = {};
      state.cardLogos[i][prop] = val;
    });
    state.logo[prop] = val;
  } else {
    state.selectedCards.forEach((i) => {
      if (!state.cardLogos[i]) state.cardLogos[i] = {};
      state.cardLogos[i][prop] = val;
    });
  }
  // Mark the logo as user-controlled so switching active format does not
  // overwrite the size. Only `size` triggers the override — x/y are
  // position-only and independent of the format-derived default.
  if (prop === "size") state.logo.userOverridden = true;
  applyLogoToAllCards();
  // Persist to disk so the position survives file-watcher reloads,
  // browser refresh, and server restarts. Debounced inside.
  scheduleLogoStateSave();
}

export function applyLogoStyle(el, sz, logo) {
  el.style.display = logo.visible ? "flex" : "none";
  el.style.left = logo.x + "%";
  el.style.top = logo.y + "%";
  const scaled = Math.round(logo.size * sz.scale);
  el.style.fontSize = scaled + "px";
  // Size the inner SVG (when present) to match so the resolved project
  // logo tracks the slider value the same way the text fallback does.
  // Using plain `svg` (no `:scope >`) tolerates wrappers that some
  // pipelines insert (e.g. source maps, hydration helpers).
  const inlineSvg = el.querySelector("svg");
  if (inlineSvg) {
    inlineSvg.setAttribute("height", scaled);
    inlineSvg.removeAttribute("width");
  }
}

export function applyLogoToAllCards() {
  document.querySelectorAll(".card-frame").forEach((frame) => {
    const logoEl = frame.querySelector(".card-logo-overlay");
    if (!logoEl) return;
    const cardIdx = Number(frame.dataset.index);
    const card = state.cards[cardIdx];
    if (!card) return;
    applyLogoStyle(logoEl, computeCardSize(card), getCardLogo(cardIdx));
  });
}

export function syncLogoSlidersToSelection() {
  const i =
    state.selectedCards.size > 0
      ? [...state.selectedCards][0]
      : state.cards.length > 0
        ? state.activeCard
        : null;
  const logo = i !== null ? getCardLogo(i) : state.logo;
  $("logo-size").value = logo.size;
  $("logo-size-val").textContent = logo.size;
  $("logo-x").value = logo.x;
  $("logo-x-val").textContent = logo.x + "%";
  $("logo-y").value = logo.y;
  $("logo-y-val").textContent = logo.y + "%";
  const visible = logo.visible;
  $("logo-toggle").textContent = visible ? "ON" : "OFF";
  $("logo-toggle").classList.toggle("active", visible);
  $("logo-controls").style.opacity = visible ? "" : "0.4";
}

// ====== Selection helpers ======

export function toggleCardSelection(i) {
  if (state.selectedCards.has(i)) state.selectedCards.delete(i);
  else state.selectedCards.add(i);
  updateSelectionUI();
  syncLogoSlidersToSelection();
}

export function toggleSelectAll() {
  const allSelected = state.cards.length > 0 && state.selectedCards.size === state.cards.length;
  if (allSelected) state.selectedCards.clear();
  else state.cards.forEach((_, i) => state.selectedCards.add(i));
  updateSelectionUI();
  syncLogoSlidersToSelection();
}

export function updateSelectionUI() {
  document.querySelectorAll(".card-frame").forEach((f) => {
    const idx = Number(f.dataset.index);
    const sel = state.selectedCards.has(idx);
    const active = idx === state.activeCard;
    f.classList.toggle("active-card", active);
    f.classList.toggle("selected-card", sel && !active);
  });
  // Sync the top-bar select circle — it reflects the ACTIVE card's
  // selection state (the per-card rail circles no longer exist).
  const topCircle = $("preview-meta-select");
  if (topCircle) {
    topCircle.classList.toggle("checked", state.selectedCards.has(state.activeCard));
  }
  const countEl = $("selection-count");
  if (countEl) countEl.textContent = state.selectedCards.size + " of " + state.cards.length;
  const toggleBtn = $("btn-select-toggle");
  if (toggleBtn) {
    const allSelected = state.cards.length > 0 && state.selectedCards.size === state.cards.length;
    toggleBtn.textContent = allSelected ? "Deselect all" : "Select all";
  }
  updateFilmstripStates();
}

// ====== Build card DOM element ======

function buildCardEl(card, i, container) {
  const sz = computeCardSize(card);
  const isSelected = state.selectedCards.has(i);
  const isActive = i === state.activeCard;
  const wrapper = document.createElement("div");
  wrapper.className =
    "card-frame" +
    (isActive ? " active-card" : "") +
    (isSelected && !isActive ? " selected-card" : "");
  wrapper.dataset.index = String(i);

  // Card selection circle + validation badge used to live in a per-card
  // vertical rail alongside each card. Both were moved to the top
  // preview-meta bar so the rail doesn't crowd the card edges. The top
  // bar reflects the ACTIVE card's state; clicking another card updates
  // the selector + badge via updatePreviewMeta().

  // Card content area: iframe + logo overlay
  const contentEl = document.createElement("div");
  contentEl.className = "card-content";
  contentEl.style.cssText = "width:" + sz.displayW + "px;height:" + sz.displayH + "px";

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
  iframe.style.cssText = [
    "width:" + sz.fmt.w + "px",
    "height:" + sz.fmt.h + "px",
    "transform:scale(" + sz.scale + ")",
    "transform-origin:top left",
    "display:block",
  ].join(";");
  iframe.addEventListener("load", () => {
    try {
      const w = iframe.contentWindow;
      if (!w) return;
      const isActiveIframe =
        state.inspectOn &&
        iframe.closest(".card-frame") &&
        iframe.closest(".card-frame").classList.contains("active-card");
      if (w.__HLI__ && typeof w.__HLI__.setDormant === "function") {
        w.__HLI__.setDormant(!isActiveIframe);
      } else {
        w.__HLI_DORMANT__ = !isActiveIframe;
      }
      // Only measure the active card — avoids redundant posts when the
      // filmstrip mounts multiple frames.
      if (isActiveIframe || state.viewMode === "app") {
        runFitCheck(iframe);
      }
    } catch {}
  });
  iframe.srcdoc = buildCardDoc(card, false, null, i);

  const logoEl = document.createElement("div");
  logoEl.className = "card-logo-overlay";
  // Use the resolved project/brand SVG when available; fall back to the
  // historical "codi" text while loadLogo() is still in flight. renderCards
  // triggers applyLogoToAllCards() when the fetch resolves.
  if (state.logoSvg) {
    logoEl.innerHTML = state.logoSvg;
  } else {
    logoEl.textContent = "codi";
  }
  applyLogoStyle(logoEl, sz, getCardLogo(i));

  contentEl.append(iframe, logoEl);
  wrapper.addEventListener("click", () => setActiveCard(i));
  wrapper.append(contentEl);
  container.appendChild(wrapper);
}

// ====== Preview metadata bar ======

export function updatePreviewMeta() {
  const bar = $("preview-meta");
  _updateFormatGrid(state.activeContent ? state.activeContent.type : null);
  if (!state.cards.length) {
    bar.hidden = true;
    return;
  }
  const c = state.activeContent;
  const name = c ? c.name : "";
  const type = c ? c.type : "";
  const fmt = c ? c.format || state.format : state.format;
  const modifiedAgo = c && c.modifiedAt ? formatTimeAgo(c.modifiedAt) : "";

  $("preview-meta-name").textContent = name;
  $("preview-meta-type").textContent = type;
  $("preview-meta-format").textContent = fmt.w + " × " + fmt.h;
  $("preview-meta-slides").textContent =
    state.cards.length + (state.cards.length === 1 ? " slide" : " slides");

  // Sync the active card's select-circle state.
  const selectEl = $("preview-meta-select");
  if (selectEl) {
    selectEl.classList.toggle("checked", state.selectedCards.has(state.activeCard));
    selectEl.onclick = (e) => {
      e.stopPropagation();
      toggleCardSelection(state.activeCard);
    };
  }

  // Rebuild the validation badge so it targets the active card. The badge
  // registers itself for runBatchValidation via dataset attributes; we
  // replace the node in place on every active-card change.
  const valHost = $("preview-meta-validation");
  if (valHost) {
    clearEl(valHost);
    try {
      const activeFile = c && c.source && c.source.file ? c.source.file : null;
      const badge = createValidationBadge(state.activeCard, activeFile);
      valHost.appendChild(badge);
    } catch {
      /* badge is best-effort */
    }
  }

  const modEl = $("preview-meta-modified");
  const modSep = $("preview-meta-modified-sep");
  if (modEl) {
    if (modifiedAgo) {
      modEl.textContent = "edited " + modifiedAgo;
      modEl.title = new Date(c.modifiedAt).toLocaleString();
      modEl.hidden = false;
      if (modSep) modSep.hidden = false;
    } else {
      modEl.textContent = "";
      modEl.title = "";
      modEl.hidden = true;
      if (modSep) modSep.hidden = true;
    }
  }

  const statusWrap = $("preview-meta-status-wrap");
  const statusSelect = $("preview-status-select");
  const selectWrap = $("status-select-wrap");
  const readOnly = c ? c.readOnly : false;
  statusWrap.hidden = false;
  if (readOnly) {
    if (statusSelect) {
      statusSelect.disabled = true;
      statusSelect.value = "draft";
    }
    if (selectWrap) selectWrap.className = "status-select-wrap status-builtin";
  } else if (statusSelect) {
    statusSelect.disabled = false;
    const s = (c && c.status) || state.activeStatus || "draft";
    statusSelect.value = s;
    if (selectWrap) selectWrap.className = "status-select-wrap status-" + s;
  }

  bar.hidden = false;
}

// ====== Main render ======

// Forward binding from exports-ui — avoids a hard cycle.
let _updateExportPanel = () => {};
export function registerUpdateExportPanel(fn) {
  _updateExportPanel = fn;
}

// Forward binding from app.js — avoids a hard cycle. The app registers a
// handler that gates the format picker by the active content's type.
let _updateFormatGrid = () => {};
export function registerUpdateFormatGrid(fn) {
  _updateFormatGrid = fn;
}

export function renderCards() {
  const strip = $("card-strip");
  const emptyEl = $("empty-state");
  const countEl = $("selection-count");
  if (!state.cards.length) {
    strip.hidden = true;
    emptyEl.style.display = "";
    _updateExportPanel(false);
    $("card-nav").hidden = true;
    setAppNavVisible(false);
    if (countEl) countEl.textContent = "0 of 0";
    updatePreviewMeta();
    return;
  }
  if (countEl) countEl.textContent = state.selectedCards.size + " of " + state.cards.length;
  emptyEl.style.display = "none";
  strip.hidden = false;
  _updateExportPanel(true);
  $("btn-refresh").hidden = false;
  clearEl(strip);

  const canvas = $("canvas");

  if (state.viewMode === "app") {
    canvas.className = "canvas mode-single";
    strip.className = "card-strip single-view";
    buildCardEl(state.cards[state.activeCard], state.activeCard, strip);
    $("card-nav").hidden = false;
    updateCardNav();
    setAppNavVisible(true);
  } else {
    canvas.className = "canvas mode-grid";
    strip.className = "card-strip grid-view";
    state.cards.forEach((card, i) => buildCardEl(card, i, strip));
    setAppNavVisible(false);
    updateCardNav();
  }
  renderFilmstrip();
  updatePreviewMeta();
  runBatchValidation();
  // Resolve the project/brand/builtin logo in the background. When the
  // fetch settles, inject the SVG into each overlay AND re-run
  // applyLogoToAllCards so the inner <svg>'s `height` attribute is
  // reapplied (innerHTML replaces children and strips any earlier sizing).
  loadLogo().then((svg) => {
    if (!svg) return;
    document.querySelectorAll(".card-logo-overlay").forEach((el) => {
      el.innerHTML = svg;
    });
    applyLogoToAllCards();
  });
}

export function reportActiveCard() {
  const i = state.activeCard;
  const card = state.cards[i];
  if (!card) return;
  fetch("/api/active-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index: i,
      total: state.cards.length,
      dataType: card.dataType ?? null,
      dataIdx: card.dataIdx ?? null,
      file: state.activeFile ?? null,
    }),
  }).catch(() => {});
}

export function setActiveCard(i, updateSelection = true) {
  state.activeCard = i;
  if (updateSelection) state.selectedCards = new Set([i]);
  reportActiveCard();
  if (window._cfApplyInspect) setTimeout(window._cfApplyInspect, 0);
  if (window._cfUpdateUrl) window._cfUpdateUrl();
  if (state.viewMode === "app") {
    renderCards();
  } else {
    updateSelectionUI();
    if (state.viewMode === "grid") {
      const frames = document.querySelectorAll(".card-frame");
      if (frames[i])
        frames[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    updateCardNav();
  }
  syncLogoSlidersToSelection();
}

export function updateCardNav() {
  const total = state.cards.length;
  $("card-nav").hidden = total === 0;
  if (total) {
    $("card-idx").textContent = state.activeCard + 1 + " / " + total;
    $("btn-prev").disabled = state.activeCard === 0;
    $("btn-next").disabled = state.activeCard >= total - 1;
  }
}

// ====== Filmstrip ======

export function renderFilmstrip() {
  const strip = $("filmstrip");
  if (!strip) return;
  const show = state.viewMode === "app" && state.cards.length > 1;
  strip.style.display = show ? "" : "none";
  if (show) strip.removeAttribute("hidden");
  if (!show) {
    clearEl(strip);
    return;
  }

  const fmt = cardFormat(state.cards[0]);
  const THUMB_H = 62;
  const THUMB_W = Math.round((THUMB_H * fmt.w) / fmt.h);
  const scale = THUMB_H / fmt.h;

  const sourceKey = (state.activeFile || "preset:" + state.preset) + "@" + state.cardRevision;
  const existing = strip.querySelectorAll(".filmstrip-thumb");
  if (existing.length === state.cards.length && strip.dataset.source === sourceKey) {
    updateFilmstripStates();
    return;
  }
  strip.dataset.source = sourceKey;

  clearEl(strip);
  state.cards.forEach((card, i) => {
    const thumb = document.createElement("div");
    thumb.className = "filmstrip-thumb" + (i === state.activeCard ? " active" : "");
    thumb.style.cssText = "width:" + THUMB_W + "px;height:" + THUMB_H + "px";
    thumb.dataset.index = String(i);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
    iframe.style.cssText = [
      "width:" + fmt.w + "px",
      "height:" + fmt.h + "px",
      "transform:scale(" + scale + ")",
      "transform-origin:top left",
      "display:block",
    ].join(";");
    iframe.srcdoc = buildCardDoc(card, false, null, i);

    const circleEl = document.createElement("div");
    circleEl.className = "filmstrip-circle" + (state.selectedCards.has(i) ? " checked" : "");
    circleEl.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCardSelection(i);
    });
    thumb.appendChild(circleEl);

    thumb.addEventListener("click", () => setActiveCard(i, false));
    thumb.appendChild(iframe);
    strip.appendChild(thumb);
  });
}

export function updateFilmstripStates() {
  const strip = $("filmstrip");
  if (!strip || strip.style.display === "none") return;
  strip.querySelectorAll(".filmstrip-thumb").forEach((t) => {
    const i = Number(t.dataset.index);
    t.classList.toggle("active", i === state.activeCard);
    const circle = t.querySelector(".filmstrip-circle");
    if (circle) circle.classList.toggle("checked", state.selectedCards.has(i));
  });
  const activeThumb = strip.querySelector(".filmstrip-thumb.active");
  if (activeThumb)
    activeThumb.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

export function setViewMode(mode) {
  state.viewMode = mode;
  $("btn-vm-grid").classList.toggle("active", mode === "grid");
  $("btn-vm-app").classList.toggle("active", mode === "app");
  if (state.cards.length) renderCards();
}

export function loadTemplateAsCards(template) {
  state.cards = template.cards.map((card) => ({ ...card, format: template.format }));
  state.cardRevision++;
  state.activeCard = 0;
  state.cardLogos = {};
  state.selectedCards = new Set([0]);
  requestAnimationFrame(renderCards);
}
