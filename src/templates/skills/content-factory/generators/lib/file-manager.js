// File and template loading — content files in the active project's
// content/ dir, plus the built-in/brand template registry.

import { parseCards as _parseCards, parseTemplate as _parseTemplate } from "/static/lib/cards.js";
import { renderMarkdownAsDocument } from "/static/lib/markdown.js";

import { state } from "./state.js";
import { $, clearEl, log, showToast } from "./dom.js";
import { loadLogoState } from "./logo-state-sync.js";

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

// Group files by their top-level folder. Files directly in content/ (no
// slash in the relative path) are collected under a virtual "root" group —
// this is where the 00-anchor.md lives. Every other file goes into its
// platform folder (linkedin/, instagram/, facebook/, tiktok/, x/, blog/,
// deck/). Order: root first (anchor), then platform folders alphabetically.
function groupFilesByFolder(files) {
  const groups = new Map();
  for (const name of files) {
    const ix = name.indexOf("/");
    const folder = ix === -1 ? "__root__" : name.slice(0, ix);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(name);
  }
  const root = groups.get("__root__") || [];
  groups.delete("__root__");
  const sortedFolders = [...groups.keys()].sort();
  return [
    ...(root.length ? [{ folder: null, files: root }] : []),
    ...sortedFolders.map((folder) => ({ folder, files: groups.get(folder) })),
  ];
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
  const groups = groupFilesByFolder(files);
  for (const { folder, files: group } of groups) {
    if (folder) {
      const header = document.createElement("div");
      header.className = "file-folder";
      header.textContent = folder;
      listEl.appendChild(header);
    }
    for (const name of group) {
      const btn = document.createElement("button");
      btn.className = "file-item" + (name === state.activeFile ? " active" : "");
      btn.type = "button";
      const displayName = folder ? name.slice(folder.length + 1) : name;
      btn.append(
        Object.assign(document.createElement("span"), { className: "file-dot" }),
        Object.assign(document.createElement("span"), { textContent: displayName }),
      );
      const isAnchorByBrief = anchorFile && name === anchorFile;
      const isAnchorByConvention = !folder && name.toLowerCase().endsWith(".md");
      const isPlanMd = !!folder && name.toLowerCase().endsWith(".md");
      if (isAnchorByBrief || isAnchorByConvention) {
        btn.append(
          Object.assign(document.createElement("span"), {
            className: "file-badge file-badge-anchor",
            textContent: "anchor",
            title: "Campaign anchor — Markdown source of truth for all variants",
          }),
        );
      } else if (isPlanMd) {
        // Markdown files in a platform subfolder are variant plans — the
        // Markdown source the user iterates on before the matching
        // .html is rendered. The PLAN badge makes the plan/render
        // distinction visible at a glance in the file tree.
        btn.append(
          Object.assign(document.createElement("span"), {
            className: "file-badge file-badge-plan",
            textContent: "plan",
            title:
              "Markdown plan for this variant. The .html is rendered only after user approval.",
          }),
        );
      }
      btn.addEventListener("click", () => selectFile(name));
      listEl.appendChild(btn);
    }
  }
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
    const text = await res.text();
    // Markdown anchors are rendered into a full HTML document (one
    // <article class="doc-page"> per natural page break) and parsed back
    // through parseCards, so the preview pipeline sees them as a regular
    // document file. No fake card wrappers, no special data-types.
    const isMarkdown = filename.toLowerCase().endsWith(".md");
    const html = isMarkdown ? renderMarkdownAsDocument(text) : text;
    const cards = parseCards(html);
    if (!cards.length) {
      log(
        isMarkdown
          ? "Anchor Markdown rendered to no content — file empty?"
          : "No .social-card / .slide / .doc-page elements found",
        "err",
      );
      return;
    }
    const prevCard = state.activeCard;
    state.cards = cards;
    state.cardRevision++;
    state.activeCard = preserveCard && prevCard < cards.length ? prevCard : 0;
    state.selectedCards = new Set([state.activeCard]);
    if (!preserveCard) {
      // Hard load — a different file is being opened. Reset per-card
      // overrides; the subsequent loadLogoState call will restore the
      // new file's persisted state (or leave defaults if none).
      state.cardLogos = {};
      state.zoom = 1.0;
      const zoomSlider = $("zoom-slider");
      const zoomVal = $("zoom-val");
      if (zoomSlider) zoomSlider.value = "100";
      if (zoomVal) zoomVal.textContent = "100%";
    } else {
      // Soft reload — same file, watcher-triggered. Drop cardLogos
      // entries for indices that no longer exist (e.g. user removed a
      // page) but keep everything else so the user's layout survives.
      for (const key of Object.keys(state.cardLogos)) {
        const idx = Number(key);
        if (!Number.isInteger(idx) || idx < 0 || idx >= cards.length) {
          delete state.cardLogos[key];
        }
      }
    }
    // Restore persisted logo state for this file before the first render
    // so overlays paint at the right position on the first frame, not a
    // default-then-snap. Fire and forget — loadLogoState is idempotent
    // and the render path picks up whatever it applied.
    loadLogoState().finally(() => requestAnimationFrame(_renderCards));
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
  // state.activeFile is a relative POSIX path under content/ (e.g.
  // "linkedin/carousel.html" or "00-anchor.md"). Keep it intact — legacy
  // code that stripped to basename broke subfolder lookups.
  await loadContent(state.activeFile, { preserveCard: true });
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
