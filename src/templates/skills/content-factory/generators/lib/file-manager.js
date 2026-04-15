// File and template loading — content files in the active project's
// content/ dir, plus the built-in/brand template registry.

import { parseCards as _parseCards, parseTemplate as _parseTemplate } from "/static/lib/cards.js";

import { state } from "./state.js";
import { $, clearEl, log, showToast } from "./dom.js";

// Forward-bind renderCards from card-strip.js to avoid a hard cycle.
let _renderCards = () => {};
export function registerRenderCards(fn) {
  _renderCards = fn;
}

export function parseCards(html) {
  return _parseCards(html);
}

export function parseTemplate(html, filename) {
  return _parseTemplate(html, filename);
}

export async function loadFiles(autoSelect = false) {
  try {
    const res = await fetch("/api/files");
    if (!res.ok) return;
    state.files = await res.json();
    try {
      const briefRes = await fetch("/api/brief");
      state.brief = briefRes.ok ? await briefRes.json() : null;
    } catch {
      state.brief = null;
    }
    renderFileList(state.files, autoSelect);
  } catch {
    /* server not ready */
  }
}

function renderFileList(files, autoSelect) {
  const listEl = $("file-list");
  if (!listEl) return;
  clearEl(listEl);
  if (!files.length) {
    const em = document.createElement("div");
    em.className = "file-empty";
    em.textContent = "No content yet";
    listEl.appendChild(em);
    return;
  }
  const anchorFile = state.brief?.anchor?.file ?? null;
  files.forEach((name) => {
    const btn = document.createElement("button");
    btn.className = "file-item" + (name === state.activeFile ? " active" : "");
    btn.type = "button";
    btn.append(
      Object.assign(document.createElement("span"), { className: "file-dot" }),
      Object.assign(document.createElement("span"), { textContent: name }),
    );
    if (anchorFile && name === anchorFile) {
      btn.append(
        Object.assign(document.createElement("span"), {
          className: "file-badge file-badge-anchor",
          textContent: "anchor",
          title: "Campaign anchor — source of truth for all variants",
        }),
      );
    }
    btn.addEventListener("click", () => selectFile(name));
    listEl.appendChild(btn);
  });
  if (autoSelect && files.length) {
    selectFile(state.activeFile && files.includes(state.activeFile) ? state.activeFile : files[0]);
  }
}

export async function selectFile(name) {
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
    body: JSON.stringify({
      file: name,
      preset: null,
      sessionDir: state.activeSessionDir ?? null,
    }),
  }).catch(() => {});
  await loadContent(name);
}

export async function loadContent(filename, { preserveCard = false } = {}) {
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
    const prevCard = state.activeCard;
    state.cards = cards;
    state.activeCard = preserveCard && prevCard < cards.length ? prevCard : 0;
    state.cardLogos = {};
    state.selectedCards = new Set([state.activeCard]);
    if (!preserveCard) {
      state.zoom = 1.0;
      const zoomSlider = $("zoom-slider");
      const zoomVal = $("zoom-val");
      if (zoomSlider) zoomSlider.value = "100";
      if (zoomVal) zoomVal.textContent = "100%";
    }
    requestAnimationFrame(_renderCards);
    log("Loaded " + cards.length + " card" + (cards.length === 1 ? "" : "s"), "ok");
  } catch (e) {
    log("Error: " + e.message, "err");
  }
}

export async function reloadCurrentContent() {
  if (!state.activeFile) {
    loadFiles(true);
    return;
  }
  const filename = state.activeFile.split("/").pop();
  await loadContent(filename, { preserveCard: true });
  showToast("Content updated");
  loadFiles(false);
}

export async function loadTemplates() {
  try {
    const entries = await fetch("/api/templates").then((r) => r.json());
    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const html = await fetch(entry.url).then((r) => r.text());
          const parsed = parseTemplate(html, entry.file);
          return {
            ...parsed,
            id: entry.id,
            name: entry.name,
            type: entry.type,
            format: entry.format,
            brand: entry.brand,
            filename: entry.file,
          };
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
