// Export panel and format-specific exporters (PNG, PDF, PPTX, DOCX,
// HTML bundle, ZIP). Pure functions over `state` + card-strip helpers;
// no DOM event listeners are wired here — the export panel is built
// on demand by updateExportPanel().

import { state } from "./state.js";
import { log } from "./dom.js";
import { cardFormat, buildCardDoc, getCardLogo } from "./card-strip.js";

const EXPORT_ICON_DOWNLOAD = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 11.5l-4-4h2.5V2h3v5.5H12L8 11.5zM2 13.5h12V12H2v1.5z"/></svg>`;

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

// Export matrix by content type:
//   social   → PNG (current), PDF, HTML
//   slides   → PNG (current), PDF, PPTX (primary), HTML
//   document → PDF (primary), DOCX, HTML
export function updateExportPanel(hasCards) {
  const container = document.getElementById("export-panel-btns");
  if (!container) return;
  container.innerHTML = "";
  const type = _getContentType();

  const extraByType = {
    slides: [
      { id: "btn-pptx", label: "PPTX · all", primary: true, handler: () => exportPptx() },
      { id: "btn-pdf", label: "PDF · all", primary: false, handler: () => exportPdf() },
      { id: "btn-html", label: "HTML · all", primary: false, handler: () => exportHtmlBundle() },
    ],
    document: [
      { id: "btn-pdf", label: "PDF · all", primary: true, handler: () => exportPdf() },
      { id: "btn-docx", label: "DOCX · all", primary: false, handler: () => exportDocx() },
      { id: "btn-html", label: "HTML · all", primary: false, handler: () => exportHtmlBundle() },
    ],
    social: [
      { id: "btn-pdf", label: "PDF · all", primary: false, handler: () => exportPdf() },
      { id: "btn-html", label: "HTML · all", primary: false, handler: () => exportHtmlBundle() },
    ],
  };
  const buttons = [
    {
      id: "btn-png",
      label: "PNG · current",
      primary: false,
      handler: () => exportCard(state.activeCard),
    },
    { id: "btn-zip", label: "ZIP · all", primary: false, handler: () => exportAll() },
    ...(extraByType[type] || []),
  ];
  for (const spec of buttons) {
    const btn = document.createElement("button");
    btn.className = "btn-export" + (spec.primary ? " primary" : "");
    btn.id = spec.id;
    btn.disabled = !hasCards;
    btn.innerHTML = EXPORT_ICON_DOWNLOAD + " " + spec.label;
    btn.addEventListener("click", spec.handler);
    container.appendChild(btn);
  }
}

// ====== Helpers ======

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

// ====== Export functions ======

export async function exportCard(index) {
  const card = state.cards[index];
  if (!card) return;
  log("Exporting PNG " + (index + 1) + "...");
  try {
    const blob = await renderCardToPngBlob(card, index);
    downloadBlob(blob, "slide-" + card.dataIdx + "-" + card.dataType + ".png");
    log("Saved slide-" + card.dataIdx + "-" + card.dataType + ".png", "ok");
  } catch (e) {
    log("Export failed: " + e.message, "err");
  }
}

export async function exportPdf() {
  if (!state.cards.length) return;
  const baseName = (state.preset || state.activeFile || "export").replace(".html", "");
  log("Building PDF (" + state.cards.length + " slides)...");
  try {
    const slides = [];
    for (let ci = 0; ci < state.cards.length; ci++) {
      const card = state.cards[ci];
      const fmt = cardFormat(card);
      const logo = getCardLogo(ci);
      const html = buildCardDoc(card, true, logo);
      slides.push({ html, width: fmt.w, height: fmt.h });
      log("  rendering slide " + (ci + 1) + "...", "accent");
    }
    const resp = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides }),
    });
    if (!resp.ok) throw new Error("PDF export failed: " + resp.statusText);
    const blob = await resp.blob();
    downloadBlob(blob, baseName + ".pdf");
    log("PDF ready — " + baseName + ".pdf", "ok");
  } catch (e) {
    log("PDF failed: " + e.message, "err");
  }
}

export async function exportPptx() {
  if (!state.cards.length) return;
  const baseName = (state.preset || state.activeFile || "export").replace(".html", "");
  log("Building PPTX (" + state.cards.length + " slides)...");
  try {
    const PptxGenJS = window.PptxGenJS;
    if (!PptxGenJS) throw new Error("PptxGenJS not loaded");
    const pptx = new PptxGenJS();
    const { w: fw, h: fh } = cardFormat(state.cards[0]);
    pptx.defineLayout({
      name: "CUSTOM",
      width: +(fw / 96).toFixed(3),
      height: +(fh / 96).toFixed(3),
    });
    pptx.layout = "CUSTOM";

    for (let ci = 0; ci < state.cards.length; ci++) {
      const card = state.cards[ci];
      const fmt = cardFormat(card);
      const logo = getCardLogo(ci);
      const html = buildCardDoc(card, true, logo);
      log("  rendering slide " + (ci + 1) + "...", "accent");
      const resp = await fetch("/api/export-png", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, width: fmt.w, height: fmt.h }),
      });
      if (!resp.ok) throw new Error("PNG render failed for slide " + (ci + 1));
      const pngBlob = await resp.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(pngBlob);
      });
      const slide = pptx.addSlide();
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: "100%", h: "100%" });
    }
    const pptxBlob = await pptx.write({ outputType: "blob" });
    downloadBlob(pptxBlob, baseName + ".pptx");
    log("PPTX ready — " + baseName + ".pptx", "ok");
  } catch (e) {
    log("PPTX failed: " + e.message, "err");
  }
}

export async function exportDocx() {
  if (!state.cards.length) return;
  const baseName = (state.preset || state.activeFile || "export").replace(".html", "");
  log("Building DOCX (" + state.cards.length + " slides)...");
  try {
    const slides = state.cards.map((card, ci) => {
      const fmt = cardFormat(card);
      const logo = getCardLogo(ci);
      const html = buildCardDoc(card, true, logo);
      return { html, width: fmt.w, height: fmt.h };
    });
    const resp = await fetch("/api/export-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      throw new Error(err.error || resp.statusText);
    }
    const blob = await resp.blob();
    downloadBlob(blob, baseName + ".docx");
    log("DOCX ready — " + baseName + ".docx", "ok");
  } catch (e) {
    log("DOCX failed: " + e.message, "err");
  }
}

export async function exportHtmlBundle() {
  log("Building HTML bundle...");
  try {
    const payload = buildExportHtmlBundlePayload();
    if (!payload) {
      log("No active content to export", "err");
      return;
    }
    const res = await fetch("/api/export-html-bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(detail.error || res.statusText);
    }
    const baseName = resolveBundleBaseName(payload);
    const blob = await res.blob();
    downloadBlob(blob, baseName + ".html");
    log("HTML bundle ready — " + baseName + ".html", "ok");
  } catch (e) {
    log("HTML export failed: " + e.message, "err");
  }
}

function buildExportHtmlBundlePayload() {
  if (!state.activeFile && state.preset) {
    const tmpl = state.templates.find((t) => t.id === state.preset);
    if (!tmpl) return null;
    return { source: "template", file: tmpl.filename, brand: tmpl.brand || undefined };
  }
  if (state.activeFile) {
    const filename = String(state.activeFile).split("/").pop();
    if (state.activeSessionDir) {
      return { source: "session", sessionDir: state.activeSessionDir, file: filename };
    }
    return { source: "content", file: filename };
  }
  return null;
}

function resolveBundleBaseName(payload) {
  if (!payload || !payload.file) return "bundle";
  return payload.file.replace(/\.html$/i, "") || "bundle";
}

export async function exportAll() {
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
