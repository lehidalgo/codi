// Export panel and format-specific exporters (PNG, PDF, PPTX, DOCX,
// HTML bundle, ZIP). Pure functions over `state` + card-strip helpers;
// no DOM event listeners are wired here — the export panel is built
// on demand by updateExportPanel().

import { state } from "./state.js";
import { log } from "./dom.js";
import { cardFormat, buildCardDoc, getCardLogo } from "./card-strip.js";
import * as vcfg from "./validation-config.js";
import { openValidationPanel } from "./validation-panel.js";

// ====== Export preflight (Layer 4) ======
//
// Before every export, check the current session's cards for validation
// errors. If any fail AND the preflight layer is on, show a modal with
// three actions: Export anyway / Fix first / Show report. Returns:
//   { proceed: true }               — user cleared (pass or soft-override)
//   { proceed: false }              — user chose not to export
async function exportPreflight() {
  const cfg = vcfg.getConfig();
  if (!cfg || cfg.enabled === false) return { proceed: true };
  if (cfg.layers && cfg.layers.exportPreflight === false) return { proceed: true };
  if (cfg.overrideExport === "disabled") return { proceed: true };

  const c = state.activeContent;
  if (!c || c.kind !== "session" || !c.source || !c.source.sessionDir) {
    return { proceed: true }; // templates bypass preflight
  }

  try {
    const res = await fetch(
      "/api/validate-cards?project=" +
        encodeURIComponent(c.source.sessionDir) +
        "&file=" +
        encodeURIComponent(c.source.file),
    );
    const batch = await res.json();
    if (!batch.ok) return { proceed: true }; // degraded or errored — don't block
    if (batch.pass !== false) return { proceed: true };

    // One or more failing cards. Show the modal.
    return await showPreflightModal(batch, cfg.overrideExport || "soft");
  } catch {
    return { proceed: true };
  }
}

function showPreflightModal(batch, overrideMode) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.style.cssText =
      "position:fixed;inset:0;background:rgba(7,10,15,0.78);z-index:1200;display:flex;align-items:center;justify-content:center;";
    const modal = document.createElement("div");
    modal.style.cssText =
      "background:var(--surface2,#161b22);border:1px solid var(--border-hover,rgba(255,255,255,0.14));border-radius:12px;padding:24px;max-width:460px;color:var(--text,#e6edf3);font:13px system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,0.6);";
    const failCount = batch.failingCards ? batch.failingCards.length : 0;
    const hardBlock = overrideMode === "hard";
    modal.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;color:#e06c75;">Layout validation failed</div>
      <div style="opacity:0.8;line-height:1.5;margin-bottom:16px;">
        ${failCount} card${failCount === 1 ? "" : "s"} fail Box Layout Theory checks.
        ${hardBlock ? "Fix the issues before exporting." : "You can export anyway, but the output may have layout issues."}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;">
        <button type="button" id="pf-cancel" style="padding:8px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:inherit;border-radius:6px;cursor:pointer;font:inherit;">Cancel</button>
        <button type="button" id="pf-report" style="padding:8px 14px;background:rgba(86,182,194,0.15);border:1px solid var(--accent,#56b6c2);color:var(--accent,#56b6c2);border-radius:6px;cursor:pointer;font:inherit;">Show report</button>
        ${hardBlock ? "" : '<button type="button" id="pf-force" style="padding:8px 14px;background:rgba(224,108,117,0.18);border:1px solid #e06c75;color:#e06c75;border-radius:6px;cursor:pointer;font:inherit;">Export anyway</button>'}
      </div>
    `;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function close(proceed) {
      document.body.removeChild(backdrop);
      resolve({ proceed });
    }
    modal.querySelector("#pf-cancel").addEventListener("click", () => close(false));
    const reportBtn = modal.querySelector("#pf-report");
    reportBtn.addEventListener("click", () => {
      const first = batch.failingCards && batch.failingCards[0];
      if (first) {
        openValidationPanel(first, {
          cardIndex: first.cardIndex,
          file: state.activeContent?.source?.file,
          projectDir: state.activeContent?.source?.sessionDir,
        });
      }
      close(false);
    });
    if (!hardBlock) {
      modal.querySelector("#pf-force").addEventListener("click", () => close(true));
    }
  });
}

const EXPORT_ICON_DOWNLOAD = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 11.5l-4-4h2.5V2h3v5.5H12L8 11.5zM2 13.5h12V12H2v1.5z"/></svg>`;

function _getContentType() {
  const c = state.activeContent;
  if (c && c.type) return c.type;
  if (state.preset) {
    const t = state.templates.find((x) => x.id === state.preset);
    if (t && t.type) return t.type;
  }
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
  const preflight = await exportPreflight();
  if (!preflight.proceed) return;
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
