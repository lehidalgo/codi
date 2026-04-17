// Gallery view — built-in templates + My Work sessions rendered as cards.
// Also hosts the session-loading + template-selection entry points.

import { buildThumbDoc as _buildThumbDoc } from "/static/lib/card-builder.js";

import { state, STATUS_CYCLE, STATUS_LABEL } from "./state.js";
import { $, clearEl, log, setView, _registerInitGallery } from "./dom.js";
import {
  buildTemplateContentFromRegistry,
  buildSessionContentFromSession,
  formatTimeAgo,
} from "./content-descriptor.js";
import { createCardMenuButton } from "./card-menu.js";
import { cardFormat, loadTemplateAsCards, renderCards } from "./card-strip.js";
import { parseTemplate } from "./file-manager.js";
import { renderMarkdownAsDocument } from "/static/lib/markdown.js";
import { loadForActiveSession } from "./validation-config.js";

let galleryInit = false;

// Expose a setter so ws.js can invalidate the gallery cache from outside.
export function setGalleryStale() {
  galleryInit = false;
}

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
  inner._coverCard = template.cards[0] ? { ...template.cards[0], format: fmt } : null;
  return inner;
}

// Filter logic split by tab panel. Gallery (#gallery-grid) holds preset
// cards only and is filtered by content type. My Work (#work-grid) holds
// session cards only and is filtered by status. Both run on every call
// so the UI stays consistent when switching tabs or editing a project.
export function filterGallery() {
  const type = state.galleryFilter;
  const workStatus = state.workStatusFilter || "all";
  document.querySelectorAll("#gallery-grid .preset-card").forEach((c) => {
    if (type === "all") c.style.display = "";
    else c.style.display = c.dataset.type === type ? "" : "none";
  });
  document.querySelectorAll("#work-grid .session-card").forEach((c) => {
    const statusMatch = workStatus === "all" || c.dataset.status === workStatus;
    c.style.display = statusMatch ? "" : "none";
  });
}

export async function initGallery() {
  const grid = $("gallery-grid");
  if (!grid) return;

  if (galleryInit) {
    document
      .querySelectorAll(".preset-card:not(.session-card)")
      .forEach((c) => c.classList.toggle("selected", c.dataset.id === state.preset));
    filterGallery();
    return;
  }
  galleryInit = true;

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
        // Deferred metadata fetch for template cards
        if (el._tmplMetaCtx) {
          const { templateId, timeEl } = el._tmplMetaCtx;
          fetch("/api/content-metadata?kind=template&id=" + encodeURIComponent(templateId))
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (!d || !d.modifiedAt) return;
              timeEl.textContent = "edited " + formatTimeAgo(d.modifiedAt);
              timeEl.title = new Date(d.modifiedAt).toLocaleString();
              timeEl.hidden = false;
            })
            .catch(() => {});
        }
        observer.unobserve(el);
      });
    },
    { threshold: 0.05 },
  );

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

    const tmplTime = document.createElement("div");
    tmplTime.className = "preset-meta preset-meta-time";
    tmplTime.style.cssText = "font-size:10px;opacity:0.6;margin-top:2px;";
    tmplTime.hidden = true;
    // Defer metadata fetch until the card is visible (via IntersectionObserver)
    inner._tmplMetaCtx = { templateId: template.id, timeEl: tmplTime };

    async function cloneTemplateAction() {
      try {
        const res = await fetch("/api/clone-template-to-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.id }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "clone failed");
        log("Saved '" + template.name + "' to My Work as " + data.session.name, "ok");
        const listRes = await fetch("/api/sessions");
        const list = await listRes.json();
        const newSession = Array.isArray(list)
          ? list.find((s) => s.sessionDir === data.sessionDir)
          : null;
        if (!newSession) throw new Error("cloned session not found in /api/sessions");
        galleryInit = false;
        if ($("view-gallery").classList.contains("active")) {
          clearEl($("gallery-grid"));
          initGallery();
        }
        await loadSessionContent(newSession);
      } catch (err) {
        log("Clone failed: " + (err.message || err), "err");
      }
    }
    const menuBtn = createCardMenuButton([
      { label: "Save to My Work", glyph: "&#43;", handler: cloneTemplateAction },
    ]);

    info.append(nameRow, meta, tmplTime);
    card.append(cover, info, menuBtn);
    card.addEventListener("click", () => selectTemplate(template.filename));
    grid.appendChild(card);
    observer.observe(inner);
  });

  // Session cards go to the My Work grid, not the preset library.
  const workGrid = $("work-grid");
  if (workGrid) await renderSessions(workGrid);
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
    card.dataset.status = session.status || "draft";
    card.dataset.sessionDir = session.sessionDir;
    card.style.display = "none";

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
      fetch(
        "/api/session-content?session=" +
          encodeURIComponent(session.sessionDir) +
          "&file=" +
          encodeURIComponent(session.files[0]),
      )
        .then((r) => r.text())
        .then((raw) => {
          const file = session.files[0];
          // Markdown anchor → render into a full HTML document with real
          // .doc-page articles before parsing. Mirrors loadSessionContent.
          const html = file.toLowerCase().endsWith(".md") ? renderMarkdownAsDocument(raw) : raw;
          const t = parseTemplate(html, file);
          const genericName = file
            .replace(/\.(html|md)$/i, "")
            .replace(/^\d+[-_]/, "")
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          const contentName = t.name !== genericName ? t.name : session.preset?.name || t.name;
          const nameEl = card.querySelector(".session-content-name");
          if (nameEl && contentName) nameEl.textContent = contentName;
          const firstCard = t.cards[0];
          if (!firstCard) return;
          iframe.srcdoc = buildThumbDoc({ ...firstCard, format: fmt });
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
    const displayName = session.name && session.slug ? session.name : dateStr;
    const presetLabel = session.preset ? session.preset.name || session.preset.id : "No preset";
    const fileCount = session.files ? session.files.length : 0;

    const nameRow = document.createElement("div");
    nameRow.className = "preset-name-row";
    const nameText = document.createElement("span");
    nameText.className = "preset-name-text";
    nameText.textContent = displayName;
    const workBadge = document.createElement("span");
    workBadge.className = "preset-type-badge type-slides";
    workBadge.textContent = "WORK";
    nameRow.append(nameText, workBadge);
    info.appendChild(nameRow);

    if (fileCount) {
      const contentNameEl = document.createElement("div");
      contentNameEl.className = "session-content-name preset-name-text";
      contentNameEl.style.cssText =
        "font-size:12px;margin-top:2px;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      info.appendChild(contentNameEl);
    }

    const metaEl = document.createElement("div");
    metaEl.className = "preset-meta";
    metaEl.textContent =
      fileCount + " file" + (fileCount === 1 ? "" : "s") + " \xb7 " + presetLabel;
    info.appendChild(metaEl);

    const timeEl = document.createElement("div");
    timeEl.className = "preset-meta preset-meta-time";
    timeEl.style.cssText = "font-size:10px;opacity:0.6;margin-top:2px;";
    timeEl.hidden = true;
    info.appendChild(timeEl);

    const sessionBasename = session.sessionDir.split("/").pop();
    fetch("/api/content-metadata?kind=session&id=" + encodeURIComponent(sessionBasename))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const slideLabel = d.cardCount + " slide" + (d.cardCount === 1 ? "" : "s");
        metaEl.textContent =
          fileCount +
          " file" +
          (fileCount === 1 ? "" : "s") +
          " \xb7 " +
          slideLabel +
          " \xb7 " +
          presetLabel;
        if (d.modifiedAt) {
          timeEl.textContent = "edited " + formatTimeAgo(d.modifiedAt);
          timeEl.title = new Date(d.modifiedAt).toLocaleString();
          timeEl.hidden = false;
        }
      })
      .catch(() => {});

    const initialStatus = session.status || "draft";
    const statusBadge = document.createElement("span");
    statusBadge.className = "session-status-badge status-" + initialStatus;
    statusBadge.textContent = STATUS_LABEL[initialStatus];
    statusBadge.title = "Click to change status";
    statusBadge.dataset.status = initialStatus;
    const statusRow = document.createElement("div");
    statusRow.className = "session-status-row";
    statusRow.appendChild(statusBadge);
    info.appendChild(statusRow);

    statusBadge.addEventListener("click", async (e) => {
      e.stopPropagation();
      const cur = statusBadge.dataset.status;
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
      statusBadge.dataset.status = next;
      statusBadge.className = "session-status-badge status-" + next;
      statusBadge.textContent = STATUS_LABEL[next];
      card.dataset.status = next;
      if (state.activeSessionDir === session.sessionDir) {
        state.activeStatus = next;
        const wrap = $("status-select-wrap");
        const sel = $("preview-status-select");
        if (sel) sel.value = next;
        if (wrap) wrap.className = "status-select-wrap status-" + next;
      }
      await fetch("/api/session-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionDir: session.sessionDir, status: next }),
      }).catch(() => {});
      filterGallery();
    });

    async function deleteSessionAction() {
      const sessionId = session.sessionDir.split("/").pop();
      const displayName = session.name || sessionId;
      if (
        !window.confirm(
          'Delete "' +
            displayName +
            '"? This removes the folder from .codi_output and cannot be undone.',
        )
      ) {
        return;
      }
      try {
        const res = await fetch("/api/sessions?id=" + encodeURIComponent(sessionId), {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "delete failed");
        log("Deleted project '" + displayName + "'", "ok");
        card.remove();
        if (
          state.activeContent &&
          state.activeContent.kind === "session" &&
          state.activeContent.source &&
          state.activeContent.source.sessionDir === session.sessionDir
        ) {
          state.activeContent = null;
          state.activeSessionDir = null;
          state.activeFile = null;
          state.activeMeta = null;
          state.activeStatus = null;
          state.preset = null;
          state.cards = [];
          state.cardRevision++;
          state.activeCard = 0;
          renderCards();
          if (window._cfUpdateUrl) window._cfUpdateUrl();
          setView("gallery");
        }
        galleryInit = false;
        filterGallery();
      } catch (err) {
        log("Delete failed: " + (err.message || err), "err");
      }
    }
    const menuBtn = createCardMenuButton([
      { label: "Delete project", glyph: "&times;", danger: true, handler: deleteSessionAction },
    ]);

    card.append(cover, info, menuBtn);
    card.addEventListener("click", () =>
      loadSessionContent({ ...session, status: card.dataset.status }),
    );
    grid.appendChild(card);
  });
}

// ====== Session loading + template selection ======

export async function loadSessionContent(session) {
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
    const raw = await res.text();
    // Markdown anchors render into a full HTML document with real
    // .doc-page articles, so parseTemplate handles them identically to
    // any other HTML variant.
    const html = file.toLowerCase().endsWith(".md") ? renderMarkdownAsDocument(raw) : raw;
    const template = parseTemplate(html, file);
    if (!template.cards.length) {
      log("No slides found", "err");
      return;
    }
    const presetMeta = session.preset
      ? state.templates.find((t) => t.id === session.preset.id)
      : null;
    const fmt =
      template.format.w !== 1080 || template.format.h !== 1080
        ? template.format
        : presetMeta
          ? presetMeta.format
          : state.format;
    template.cards.forEach((c) => (c.format = fmt));
    state.format = fmt;
    state.cards = template.cards;
    state.cardRevision++;
    const genericName = file
      .replace(/\.(html|md)$/i, "")
      .replace(/^\d+[-_]/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const resolvedName =
      template.name !== genericName ? template.name : session.preset?.name || template.name;
    const resolvedType =
      template.type !== "social" || session.preset?.type === "social"
        ? template.type
        : session.preset?.type || template.type;
    state.activeMeta = { name: resolvedName, type: resolvedType, format: fmt };
    state.preset = null;
    // Keep activeFile as the relative path under content/ so reload + the
    // file-panel active-item matcher + /api/content fetches all agree on
    // the same identifier. The session's absolute dir lives separately in
    // state.activeSessionDir.
    state.activeFile = file;
    state.activeSessionDir = session.sessionDir;
    state.activeStatus = session.status || "draft";
    state.viewMode = "app";
    state.activeCard = 0;
    state.cardLogos = {};
    state.selectedCards = new Set([0]);
    state.activeContent = buildSessionContentFromSession(session, [file], template.cards);
    loadForActiveSession();
    $("btn-vm-grid").classList.remove("active");
    $("btn-vm-app").classList.add("active");
    setView("preview");
    requestAnimationFrame(renderCards);
    log("Loaded " + template.cards.length + " slides from session", "ok");
    fetch("/api/open-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectDir: session.sessionDir }),
    }).catch(() => {});
    fetch("/api/active-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: file,
        preset: session.preset?.id || null,
        sessionDir: session.sessionDir,
      }),
    }).catch(() => {});
    if (window._cfUpdateUrl) window._cfUpdateUrl();
  } catch (e) {
    log("Error loading session: " + e.message, "err");
  }
}

export async function selectTemplate(filename) {
  const template = state.templates.find((t) => t.filename === filename);
  if (!template) return;

  state.preset = template.id;
  state.activeFile = null;
  state.activeSessionDir = null;
  state.activeMeta = null;
  state.activeStatus = null;
  state.activeContent = buildTemplateContentFromRegistry(template);
  loadForActiveSession();
  state.zoom = 1.0;
  state.viewMode = "app";
  state.activeCard = 0;
  state.cardLogos = {};
  state.selectedCards = new Set([0]);
  $("zoom-slider").value = "100";
  $("zoom-val").textContent = "100%";
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
  if (window._cfUpdateUrl) window._cfUpdateUrl();

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

// Register initGallery with dom.js so setView("gallery") can trigger it
// without creating a hard circular import.
_registerInitGallery(initGallery);
