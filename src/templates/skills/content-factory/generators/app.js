import { parseCards as _parseCards, parseTemplate as _parseTemplate } from "/static/lib/cards.js";
import {
  cardFormat as _cardFormat,
  buildCardDoc as _buildCardDoc,
  buildThumbDoc as _buildThumbDoc,
  computeCardSize as _computeCardSize,
} from "/static/lib/card-builder.js";

// ====== State ======
const state = {
  format: { w: 1080, h: 1080 },
  handle: "lehidalgo",
  zoom: 0.4,
  logo: { visible: true, size: 48, x: 85, y: 85 }, // global defaults
  cardLogos: {}, // { [cardIndex]: partial logo overrides per card }
  selectedCards: new Set([0]),
  galleryFilter: "all",
  viewMode: "app", // default is app view
  files: [],
  activeFile: null,
  cards: [],
  activeCard: 0,
  preset: null, // template id of currently active template
  templates: [], // loaded from /api/templates — replaces PRESETS global
};

let ws = null,
  wsReconnectTimer = null,
  wsBackoff = 1000;

// ====== DOM helpers ======
function $(id) {
  return document.getElementById(id);
}
function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function log(msg, type = "info") {
  const logEl = $("log");
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

// ====== WebSocket ======
function connectWS() {
  if (ws && ws.readyState < 2) return;
  ws = new WebSocket("ws://" + window.location.host);
  ws.addEventListener("open", () => {
    wsBackoff = 1000;
    clearTimeout(wsReconnectTimer);
    $("ws-dot").className = "ws-dot connected";
    log("Live connection active", "ok");
    loadFiles();
  });
  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "reload") {
        log("Content updated", "accent");
        loadFiles(true);
      } else if (msg.type === "reload-templates") {
        log("Templates updated — refreshing gallery…", "accent");
        galleryInit = false;
        clearEl($("gallery-grid"));
        loadTemplates().then(() => {
          if ($("view-gallery").classList.contains("active")) initGallery();
          // If the active template changed, reload its cards
          if (state.preset) {
            const t = state.templates.find((x) => x.id === state.preset);
            if (t) {
              loadTemplateAsCards(t);
              renderCards();
            }
          }
        });
      }
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener("close", () => {
    $("ws-dot").className = "ws-dot disconnected";
    wsReconnectTimer = setTimeout(() => {
      wsBackoff = Math.min(wsBackoff * 1.5, 15000);
      connectWS();
    }, wsBackoff);
  });
  ws.addEventListener("error", () => ws.close());
}

// ====== Tab switching ======
function setView(viewId) {
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
  if (viewId === "gallery") initGallery();
}

// ====== File management ======
async function loadFiles(autoSelect = false) {
  try {
    const res = await fetch("/api/files");
    if (!res.ok) return;
    state.files = await res.json();
    renderFileList(state.files, autoSelect);
  } catch {
    /* server not ready */
  }
}

function renderFileList(files, autoSelect) {
  const listEl = $("file-list");
  clearEl(listEl);
  if (!files.length) {
    const em = document.createElement("div");
    em.className = "file-empty";
    em.textContent = "No content yet";
    listEl.appendChild(em);
    return;
  }
  files.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "file-item" + (name === state.activeFile ? " active" : "");
    btn.type = "button";
    btn.append(
      Object.assign(document.createElement("span"), { className: "file-dot" }),
      Object.assign(document.createElement("span"), { textContent: name }),
    );
    btn.addEventListener("click", () => selectFile(name));
    listEl.appendChild(btn);
  });
  if (autoSelect && files.length)
    selectFile(state.activeFile && files.includes(state.activeFile) ? state.activeFile : files[0]);
}

async function selectFile(name) {
  state.activeFile = name;
  state.preset = null;
  document
    .querySelectorAll(".file-item")
    .forEach((b) =>
      b.classList.toggle("active", b.querySelector("span:last-child").textContent === name),
    );
  log("Loading " + name);
  fetch("/api/active-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: name, preset: null }),
  }).catch(() => {});
  await loadContent(name);
}

// ====== Content loading ======
async function loadContent(filename) {
  try {
    const res = await fetch("/api/content?file=" + encodeURIComponent(filename));
    if (!res.ok) {
      log("File not found: " + filename, "err");
      return;
    }
    const cards = parseCards(await res.text());
    if (!cards.length) {
      log("No .social-card elements found", "err");
      return;
    }
    state.cards = cards;
    state.activeCard = 0;
    state.cardLogos = {};
    state.selectedCards = new Set([0]);
    requestAnimationFrame(renderCards);
    log("Loaded " + cards.length + " card" + (cards.length === 1 ? "" : "s"), "ok");
  } catch (e) {
    log("Error: " + e.message, "err");
  }
}

function parseCards(html) {
  return _parseCards(html);
}

// ====== Template loading ======
function parseTemplate(html, filename) {
  return _parseTemplate(html, filename);
}

async function loadTemplates() {
  try {
    const files = await fetch("/api/templates").then((r) => r.json());
    const results = await Promise.all(
      files.map(async (f) => {
        try {
          const html = await fetch("/api/template?file=" + encodeURIComponent(f)).then((r) =>
            r.text(),
          );
          return parseTemplate(html, f);
        } catch {
          return null;
        }
      }),
    );
    state.templates = results.filter(Boolean);
  } catch {
    state.templates = [];
  }
}

// ====== Card helpers ======
function cardFormat(card) {
  return _cardFormat(card, state.format);
}

function buildCardDoc(card, forExport = false, logo = null) {
  const fmt = cardFormat(card);
  return _buildCardDoc(card, fmt, logo, state.handle || "handle", forExport);
}

function computeCardSize(card) {
  const fmt = cardFormat(card);
  const canvasEl = $("canvas");
  return _computeCardSize(fmt, {
    canvasW: Math.max(canvasEl.clientWidth, 400),
    canvasH: Math.max(canvasEl.clientHeight, 300),
    zoom: state.zoom,
    viewMode: state.viewMode,
  });
}

function _getContentType() {
  if (state.preset) {
    const t = state.templates.find((x) => x.id === state.preset);
    if (t) return t.type;
  }
  const { w, h } = state.format;
  if (w === 794) return "document";
  if (w > h) return "slides";
  return "social";
}

// ====== Per-card logo ======
function getCardLogo(i) {
  return state.cardLogos[i] ? { ...state.logo, ...state.cardLogos[i] } : { ...state.logo };
}

function applyLogoChange(prop, val) {
  const noneSelected = state.selectedCards.size === 0;
  const allSelected = state.cards.length > 0 && state.selectedCards.size === state.cards.length;
  if (noneSelected || allSelected) {
    // Apply to every card AND update global default
    state.cards.forEach((_, i) => {
      if (!state.cardLogos[i]) state.cardLogos[i] = {};
      state.cardLogos[i][prop] = val;
    });
    state.logo[prop] = val;
  } else {
    // Only selected cards — do NOT update global so unselected cards are unaffected
    state.selectedCards.forEach((i) => {
      if (!state.cardLogos[i]) state.cardLogos[i] = {};
      state.cardLogos[i][prop] = val;
    });
  }
  applyLogoToAllCards();
}

function applyLogoStyle(el, sz, logo) {
  el.style.display = logo.visible ? "flex" : "none";
  el.style.left = logo.x + "%";
  el.style.top = logo.y + "%";
  el.style.fontSize = Math.round(logo.size * sz.scale) + "px";
}

function applyLogoToAllCards() {
  document.querySelectorAll(".card-frame").forEach((frame) => {
    const logoEl = frame.querySelector(".card-logo-overlay");
    if (!logoEl) return;
    const cardIdx = Number(frame.dataset.index);
    const card = state.cards[cardIdx];
    if (!card) return;
    applyLogoStyle(logoEl, computeCardSize(card), getCardLogo(cardIdx));
  });
}

function syncLogoSlidersToSelection() {
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
function toggleCardSelection(i) {
  if (state.selectedCards.has(i)) state.selectedCards.delete(i);
  else state.selectedCards.add(i);
  updateSelectionUI();
  syncLogoSlidersToSelection();
}

function toggleSelectAll() {
  const allSelected = state.cards.length > 0 && state.selectedCards.size === state.cards.length;
  if (allSelected) state.selectedCards.clear();
  else state.cards.forEach((_, i) => state.selectedCards.add(i));
  updateSelectionUI();
  syncLogoSlidersToSelection();
}

function updateSelectionUI() {
  document.querySelectorAll(".card-frame").forEach((f) => {
    const idx = Number(f.dataset.index);
    const sel = state.selectedCards.has(idx);
    const active = idx === state.activeCard;
    f.classList.toggle("active-card", active);
    f.classList.toggle("selected-card", sel && !active);
    const circle = f.querySelector(".card-select-circle");
    if (circle) circle.classList.toggle("checked", sel);
  });
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
  wrapper.style.cssText = "width:" + sz.displayW + "px;height:" + sz.displayH + "px";
  wrapper.dataset.index = String(i);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.style.cssText = [
    "width:" + sz.fmt.w + "px",
    "height:" + sz.fmt.h + "px",
    "transform:scale(" + sz.scale + ")",
    "transform-origin:top left",
    "display:block",
  ].join(";");
  iframe.srcdoc = buildCardDoc(card);

  const logoEl = document.createElement("div");
  logoEl.className = "card-logo-overlay";
  logoEl.textContent = "codi";
  applyLogoStyle(logoEl, sz, getCardLogo(i));

  // Selection circle — toggles multi-selection; does not change active card
  const circleEl = document.createElement("div");
  circleEl.className = "card-select-circle" + (isSelected ? " checked" : "");
  circleEl.title = "Select / deselect this slide";
  circleEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleCardSelection(i);
  });

  // Card body click — sets active card for navigation (single-select)
  wrapper.addEventListener("click", () => setActiveCard(i));
  wrapper.append(iframe, logoEl, circleEl);
  container.appendChild(wrapper);
}

// ====== Render cards ======
function renderCards() {
  const strip = $("card-strip");
  const emptyEl = $("empty-state");
  const countEl = $("selection-count");
  if (!state.cards.length) {
    strip.hidden = true;
    emptyEl.style.display = "";
    $("btn-png").disabled = $("btn-zip").disabled = true;
    $("card-nav").hidden = true;
    setAppNavVisible(false);
    if (countEl) countEl.textContent = "0 of 0";
    return;
  }
  if (countEl) countEl.textContent = state.selectedCards.size + " of " + state.cards.length;
  emptyEl.style.display = "none";
  strip.hidden = false;
  $("btn-png").disabled = $("btn-zip").disabled = false;
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
}

function setAppNavVisible(show) {
  const prev = $("app-prev"),
    next = $("app-next");
  if (!prev || !next) return;
  const total = state.cards.length;
  prev.style.display = show && state.activeCard > 0 ? "flex" : "none";
  next.style.display = show && state.activeCard < total - 1 ? "flex" : "none";
}

function setActiveCard(i, updateSelection = true) {
  state.activeCard = i;
  // Only card body clicks update selection; arrow navigation leaves selection intact
  if (updateSelection) state.selectedCards = new Set([i]);
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

function updateCardNav() {
  const total = state.cards.length;
  $("card-nav").hidden = total === 0;
  if (total) {
    $("card-idx").textContent = state.activeCard + 1 + " / " + total;
    $("btn-prev").disabled = state.activeCard === 0;
    $("btn-next").disabled = state.activeCard >= total - 1;
  }
}

// ====== Filmstrip ======
function renderFilmstrip() {
  const strip = $("filmstrip");
  if (!strip) return;
  const show = state.viewMode === "app" && state.cards.length > 1;
  strip.style.display = show ? "" : "none";
  // Clear the HTML `hidden` attribute so strip.hidden reflects reality
  if (show) strip.removeAttribute("hidden");
  if (!show) {
    clearEl(strip);
    return;
  }

  const fmt = cardFormat(state.cards[0]);
  const THUMB_H = 62;
  const THUMB_W = Math.round((THUMB_H * fmt.w) / fmt.h);
  const scale = THUMB_H / fmt.h;

  // Rebuild when card count OR source changes (same count, different source = stale iframes)
  const sourceKey = state.activeFile || "preset:" + state.preset;
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
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.style.cssText = [
      "width:" + fmt.w + "px",
      "height:" + fmt.h + "px",
      "transform:scale(" + scale + ")",
      "transform-origin:top left",
      "display:block",
    ].join(";");
    iframe.srcdoc = buildCardDoc(card);

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

function updateFilmstripStates() {
  const strip = $("filmstrip");
  if (!strip || strip.style.display === "none") return;
  strip.querySelectorAll(".filmstrip-thumb").forEach((t) => {
    const i = Number(t.dataset.index);
    t.classList.toggle("active", i === state.activeCard);
    const circle = t.querySelector(".filmstrip-circle");
    if (circle) circle.classList.toggle("checked", state.selectedCards.has(i));
  });
  // Scroll active thumb into view
  const activeThumb = strip.querySelector(".filmstrip-thumb.active");
  if (activeThumb)
    activeThumb.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

// ====== View mode ======
function setViewMode(mode) {
  state.viewMode = mode;
  $("btn-vm-grid").classList.toggle("active", mode === "grid");
  $("btn-vm-app").classList.toggle("active", mode === "app");
  if (state.cards.length) renderCards();
}

// ====== Template card loading ======
function loadTemplateAsCards(template) {
  // Cards from parseCards() already have styleText + linkTags — just stamp format
  state.cards = template.cards.map((card) => ({ ...card, format: template.format }));
  state.activeCard = 0;
  state.cardLogos = {};
  state.selectedCards = new Set([0]);
  requestAnimationFrame(renderCards);
}

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
}

// ====== Export ======
async function renderCardToPngBlob(card, cardIndex) {
  const fmt = cardFormat(card);
  const logo = cardIndex !== undefined ? getCardLogo(cardIndex) : state.logo;
  const html = buildCardDoc(card, true, logo);
  const resp = await fetch("/api/export-png", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, width: fmt.w, height: fmt.h }),
  });
  if (!resp.ok) throw new Error("Export failed: " + resp.statusText);
  return resp.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportCard(index) {
  const card = state.cards[index];
  if (!card) return;
  log("Exporting slide " + (index + 1) + "...");
  try {
    const blob = await renderCardToPngBlob(card, index);
    downloadBlob(blob, "slide-" + card.dataIdx + "-" + card.dataType + ".png");
    log("Saved slide-" + card.dataIdx + "-" + card.dataType + ".png", "ok");
  } catch (e) {
    log("Export failed: " + e.message, "err");
  }
}

async function exportAll() {
  if (!state.cards.length) return;
  log("Building ZIP (" + state.cards.length + " slides)...");
  try {
    const zip = new JSZip();
    for (let ci = 0; ci < state.cards.length; ci++) {
      const card = state.cards[ci];
      const blob = await renderCardToPngBlob(card, ci);
      const filename = "slide-" + card.dataIdx + "-" + card.dataType + ".png";
      zip.file(filename, blob);
      log("  + " + filename, "accent");
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (state.preset || state.activeFile || "cards").replace(".html", "") + ".zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    log("ZIP ready", "ok");
  } catch (e) {
    log("ZIP failed: " + e.message, "err");
  }
}

// ====== Gallery ======
let galleryInit = false;

// Build a thumbnail srcdoc from any card object (works for both templates and content files)
function buildThumbDoc(card) {
  const fmt = cardFormat(card);
  return _buildThumbDoc(card, fmt);
}

function buildTemplateCoverEl(template, BOX_W, BOX_H) {
  const fmt = template.format;
  const sc = Math.min(BOX_W / fmt.w, BOX_H / fmt.h) * 0.98;
  const inner = document.createElement("div");
  inner.className = "preset-cover-inner";
  inner.setAttribute("data-pending", "1");
  inner.style.cssText =
    "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(" +
    sc +
    ");width:" +
    fmt.w +
    "px;height:" +
    fmt.h +
    "px;transform-origin:center;";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.style.cssText =
    "width:" + fmt.w + "px;height:" + fmt.h + "px;border:none;display:block;pointer-events:none;";
  inner.appendChild(iframe);
  // Store the cover card as a property for the IntersectionObserver to pick up
  inner._coverCard = template.cards[0] ? { ...template.cards[0], format: fmt } : null;
  return inner;
}

function filterGallery() {
  const type = state.galleryFilter;
  document.querySelectorAll(".preset-card").forEach((c) => {
    const isWork = c.classList.contains("session-card");
    if (type === "work") {
      c.style.display = isWork ? "" : "none";
    } else if (type === "all") {
      c.style.display = isWork ? "none" : "";
    } else {
      c.style.display = !isWork && c.dataset.type === type ? "" : "none";
    }
  });
}

async function initGallery() {
  const grid = $("gallery-grid");

  if (galleryInit) {
    // Just sync active state and filter — no rebuild
    document
      .querySelectorAll(".preset-card:not(.session-card)")
      .forEach((c) => c.classList.toggle("selected", c.dataset.id === state.preset));
    filterGallery();
    return;
  }
  galleryInit = true;

  // Lazy-load cover iframes via IntersectionObserver
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.hasAttribute("data-pending") && el._coverCard) {
          const native = el._coverCard.format || state.format;
          el.querySelector("iframe").srcdoc = _buildThumbDoc(el._coverCard, native);
          el.removeAttribute("data-pending");
        }
        observer.unobserve(el);
      });
    },
    { threshold: 0.05 },
  );

  // Render one card per template — uses state.templates (fetched HTML files)
  state.templates.forEach((template) => {
    const card = document.createElement("div");
    card.className = "preset-card" + (state.preset === template.id ? " selected" : "");
    card.dataset.id = template.id;
    card.dataset.type = template.type;

    const cover = document.createElement("div");
    cover.className = "preset-cover";
    const inner = buildTemplateCoverEl(template, 320, 200);
    const chipRow = document.createElement("div");
    chipRow.className = "preset-cover-chips";
    template.cards.forEach((_, si) => {
      chipRow.appendChild(
        Object.assign(document.createElement("span"), {
          className: "cover-chip" + (si === 0 ? " active" : ""),
        }),
      );
    });
    cover.append(inner, chipRow);

    const info = document.createElement("div");
    info.className = "preset-info";
    const nameRow = document.createElement("div");
    nameRow.className = "preset-name-row";
    nameRow.innerHTML =
      '<span class="preset-name-text">' +
      template.name +
      "</span>" +
      '<span class="preset-type-badge type-' +
      template.type +
      '">' +
      template.type.toUpperCase() +
      "</span>" +
      (state.preset === template.id ? '<span class="preset-badge">ACTIVE</span>' : "");
    const meta = document.createElement("div");
    meta.className = "preset-meta";
    meta.textContent =
      template.cards.length +
      " slide" +
      (template.cards.length === 1 ? "" : "s") +
      " \xb7 " +
      template.format.w +
      "\xd7" +
      template.format.h;
    info.append(nameRow, meta);
    card.append(cover, info);
    card.addEventListener("click", () => selectTemplate(template.filename));
    grid.appendChild(card);
    observer.observe(inner);
  });

  // Load sessions (My Work)
  await renderSessions(grid);
  filterGallery();
}

async function renderSessions(grid) {
  let sessions = [];
  try {
    const r = await fetch("/api/sessions");
    if (r.ok) sessions = await r.json();
  } catch {
    /* ignore */
  }

  sessions.forEach((session) => {
    const card = document.createElement("div");
    card.className = "preset-card session-card";
    card.style.display = "none"; // shown only in "My Work" filter

    const cover = document.createElement("div");
    cover.className = "preset-cover";

    if (session.files && session.files.length) {
      const presetMeta = session.preset
        ? state.templates.find((t) => t.id === session.preset.id)
        : null;
      const fmt = (presetMeta ? presetMeta.format : null) || { w: 1080, h: 1080 };
      const sc = Math.min(320 / fmt.w, 200 / fmt.h) * 0.98;
      const inner = document.createElement("div");
      inner.style.cssText =
        "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) scale(" +
        sc +
        ");width:" +
        fmt.w +
        "px;height:" +
        fmt.h +
        "px;transform-origin:center;";
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-same-origin");
      iframe.style.cssText =
        "width:" +
        fmt.w +
        "px;height:" +
        fmt.h +
        "px;border:none;display:block;pointer-events:none;";
      inner.appendChild(iframe);
      cover.appendChild(inner);
      // Lazy load: fetch session content and show first card
      fetch(
        "/api/session-content?session=" +
          encodeURIComponent(session.sessionDir) +
          "&file=" +
          encodeURIComponent(session.files[0]),
      )
        .then((r) => r.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const firstCard = doc.querySelector(".social-card");
          if (!firstCard) return;
          const styleText = Array.from(doc.querySelectorAll("style"))
            .map((s) => s.textContent)
            .join("\n");
          const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
            .map((l) => l.outerHTML)
            .join("\n");
          iframe.srcdoc = buildThumbDoc({
            html: firstCard.outerHTML,
            styleText,
            linkTags,
            format: fmt,
          });
        })
        .catch(() => {});
    } else {
      const ph = document.createElement("div");
      ph.style.cssText =
        "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:rgba(255,255,255,0.15);font-size:40px;";
      ph.textContent = "○";
      cover.appendChild(ph);
    }

    const info = document.createElement("div");
    info.className = "preset-info";
    const dateStr = session.created
      ? new Date(session.created).toLocaleString("en", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : session.sessionDir;
    const presetLabel = session.preset ? session.preset.name || session.preset.id : "No preset";
    const fileCount = session.files ? session.files.length : 0;
    info.innerHTML =
      '<div class="preset-name-row"><span class="preset-name-text">' +
      dateStr +
      "</span>" +
      '<span class="preset-type-badge type-slides">WORK</span></div>' +
      '<div class="preset-meta">' +
      fileCount +
      " file" +
      (fileCount === 1 ? "" : "s") +
      " \xb7 " +
      presetLabel +
      "</div>";
    card.append(cover, info);
    card.addEventListener("click", () => loadSessionContent(session));
    grid.appendChild(card);
  });
}

async function loadSessionContent(session) {
  if (!session.files || !session.files.length) {
    log("Session has no content files", "err");
    return;
  }
  const file = session.files[0];
  log("Loading session: " + session.sessionDir, "accent");
  try {
    const res = await fetch(
      "/api/session-content?session=" +
        encodeURIComponent(session.sessionDir) +
        "&file=" +
        encodeURIComponent(file),
    );
    if (!res.ok) {
      log("Session not found", "err");
      return;
    }
    const cards = parseCards(await res.text());
    if (!cards.length) {
      log("No slides found", "err");
      return;
    }
    const presetMeta = session.preset
      ? state.templates.find((t) => t.id === session.preset.id)
      : null;
    if (presetMeta) {
      cards.forEach((c) => (c.format = presetMeta.format));
      state.format = presetMeta.format;
    }
    state.cards = cards;
    state.preset = null;
    state.activeFile = session.sessionDir + "/" + file;
    state.activeCard = 0;
    state.cardLogos = {};
    state.selectedCards = new Set([0]);
    setView("preview");
    requestAnimationFrame(renderCards);
    log("Loaded " + cards.length + " slides from session", "ok");
  } catch (e) {
    log("Error loading session: " + e.message, "err");
  }
}

async function selectTemplate(filename) {
  const template = state.templates.find((t) => t.filename === filename);
  if (!template) return;

  state.preset = template.id;
  state.activeFile = null;
  state.zoom = 0.4;
  state.viewMode = "app";
  state.activeCard = 0;
  state.cardLogos = {};
  state.selectedCards = new Set([0]);
  $("zoom-slider").value = "40";
  $("zoom-val").textContent = "40%";
  $("btn-vm-grid").classList.remove("active");
  $("btn-vm-app").classList.add("active");

  document
    .querySelectorAll(".preset-card")
    .forEach((c) => c.classList.toggle("selected", c.dataset.id === template.id));
  document.querySelectorAll(".file-item").forEach((b) => b.classList.remove("active"));

  log("Template: " + template.name, "accent");

  const fmtBtn = document.querySelector(
    '.fmt[data-w="' + template.format.w + '"][data-h="' + template.format.h + '"]',
  );
  if (fmtBtn) {
    document.querySelectorAll(".fmt").forEach((b) => b.classList.remove("active"));
    fmtBtn.classList.add("active");
    state.format = template.format;
  }

  setView("preview");
  loadTemplateAsCards(template);

  try {
    await fetch("/api/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: template.id,
        name: template.name,
        type: template.type,
        timestamp: Date.now(),
      }),
    });
    fetch("/api/active-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: null, preset: template.id }),
    }).catch(() => {});
  } catch {
    /* non-critical */
  }

  log("Loaded " + template.cards.length + " slides", "ok");
}

// ====== Init ======
function init() {
  // Register all UI event listeners synchronously — must be responsive from page load
  $("format-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".fmt");
    if (btn) setFormat(btn);
  });

  const handleEl = $("handle");
  handleEl.value = state.handle;
  handleEl.addEventListener("input", () => {
    state.handle = handleEl.value;
    if (state.cards.length) requestAnimationFrame(renderCards); // re-render to update @handle
  });

  const zoomSlider = $("zoom-slider"),
    zoomVal = $("zoom-val");
  zoomSlider.value = String(Math.round(state.zoom * 100));
  zoomVal.textContent = Math.round(state.zoom * 100) + "%";
  zoomSlider.addEventListener("input", () => {
    state.zoom = Number(zoomSlider.value) / 100;
    zoomVal.textContent = zoomSlider.value + "%";
    if (state.cards.length) renderCards();
  });

  $("logo-toggle").addEventListener("click", () => {
    // Logo ON/OFF is a global control — always affects all cards and the global default
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

  $("gallery-filters").addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.galleryFilter = btn.dataset.type;
    filterGallery();
  });

  document
    .querySelectorAll(".tab")
    .forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.view)));

  $("btn-vm-grid").addEventListener("click", () => setViewMode("grid"));
  $("btn-vm-app").addEventListener("click", () => setViewMode("app"));

  $("btn-prev").addEventListener("click", () => {
    if (state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
  });
  $("btn-next").addEventListener("click", () => {
    if (state.activeCard < state.cards.length - 1) setActiveCard(state.activeCard + 1, false);
  });

  const appPrev = $("app-prev"),
    appNext = $("app-next");
  if (appPrev)
    appPrev.addEventListener("click", () => {
      if (state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
    });
  if (appNext)
    appNext.addEventListener("click", () => {
      if (state.activeCard < state.cards.length - 1) setActiveCard(state.activeCard + 1, false);
    });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft" && state.activeCard > 0) setActiveCard(state.activeCard - 1, false);
    if (e.key === "ArrowRight" && state.activeCard < state.cards.length - 1)
      setActiveCard(state.activeCard + 1, false);
  });

  $("btn-png").addEventListener("click", () => exportCard(state.activeCard));
  $("btn-zip").addEventListener("click", exportAll);

  // Default view mode button state
  $("btn-vm-grid").classList.remove("active");
  $("btn-vm-app").classList.add("active");

  $("btn-select-toggle").addEventListener("click", toggleSelectAll);

  connectWS();
  log("Content factory ready", "ok");

  // Load templates in background — gallery populates when ready, UI is already responsive
  loadTemplates()
    .then(() => {
      log("Loaded " + state.templates.length + " templates", "ok");
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
        }
      }
    })
    .catch(() => {
      /* non-critical */
    });
}

document.addEventListener("DOMContentLoaded", init);
