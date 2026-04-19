// Browser-side fit check — runs after each card iframe has loaded, measures
// canvas-root pages (.doc-page / .slide / .social-card) against the active
// format, and persists the result to <project>/state/fit-report.json via
// POST /api/validate/fit-report. Agents and the inline notice badge read
// from that file.
//
// Measurement is deliberately kept server-state-free: we post the full
// report payload each time and let the server overwrite. No retries —
// failed posts fall back to console logging so the UI never blocks.

import { state } from "./state.js";
import { measureFit, computeRemediation, buildDirective } from "./fit-measure.js";
import { log } from "./dom.js";

const NOTICE_ID = "fit-notice";

function contentType() {
  return (state.activeContent && state.activeContent.type) || "document";
}

function projectDir() {
  const c = state.activeContent;
  if (!c || !c.source) return null;
  // Prefer the explicit sessionDir (My Work projects); fall back to the
  // filename-derived project path when possible.
  return c.source.sessionDir || null;
}

function collectPages(iframeDoc) {
  if (!iframeDoc) return [];
  const nodes = iframeDoc.querySelectorAll(".doc-page, .slide, .social-card");
  const pages = [];
  nodes.forEach((n) => {
    pages.push({ scrollHeight: n.scrollHeight, scrollWidth: n.scrollWidth });
  });
  return pages;
}

function renderNotice(report) {
  const existing = document.getElementById(NOTICE_ID);
  if (existing) existing.remove();
  if (!report || report.overflowPx === 0) return;
  const el = document.createElement("div");
  el.id = NOTICE_ID;
  el.setAttribute("role", "alert");
  el.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "right:16px",
    "max-width:360px",
    "padding:12px 14px",
    "background:rgba(224,108,117,0.12)",
    "border:1px solid rgba(224,108,117,0.4)",
    "border-radius:8px",
    "color:#f0c2c6",
    "font:12px system-ui,sans-serif",
    "z-index:900",
    "box-shadow:0 6px 20px rgba(0,0,0,0.35)",
  ].join(";");
  el.innerHTML = [
    '<div style="font-weight:600;letter-spacing:0.06em;font-size:10px;text-transform:uppercase;opacity:0.9;margin-bottom:6px;">Content-fit · ' +
      (report.remediation || "tighten") +
      "</div>",
    '<div style="line-height:1.45;">' + escapeHtml(report.directive) + "</div>",
  ].join("");
  document.body.appendChild(el);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function persistReport(report) {
  const project = projectDir();
  if (!project) return; // built-in templates do not have a persistence target
  fetch("/api/validate/fit-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, report }),
  }).catch((err) => {
    log("fit-report post failed: " + (err && err.message ? err.message : "unknown"), "warn");
  });
}

export function runFitCheck(iframe) {
  try {
    const doc = iframe && iframe.contentDocument;
    const pages = collectPages(doc);
    if (pages.length === 0) return null;
    const type = contentType();
    const fit = measureFit({ canvas: state.format, pages, type });
    if (fit.overflowPx === 0) {
      renderNotice(null);
      return fit;
    }
    const { remediation, options } = computeRemediation({
      overflowPct: fit.overflowPct,
      type,
    });
    const directive = buildDirective({ ...fit, remediation });
    const c = state.activeContent;
    const file = c && c.source ? c.source.file || null : null;
    const report = {
      file,
      canvas: fit.canvas,
      measured: fit.measured,
      overflowPx: fit.overflowPx,
      overflowPct: fit.overflowPct,
      pageIndex: fit.pageIndex,
      type,
      remediation,
      options,
      directive,
    };
    renderNotice(report);
    persistReport(report);
    return report;
  } catch (err) {
    log("fit-check failed: " + (err && err.message ? err.message : "unknown"), "warn");
    return null;
  }
}
