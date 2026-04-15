// Validation violations side panel — opens when a validation badge is
// clicked. Lists violations grouped by rule with fix hints and actions:
// Jump to element, Ignore this violation, Ask agent to fix.

import { log } from "./dom.js";
import * as vcfg from "./validation-config.js";

let _panel = null;
let _currentContext = null;

function buildPanel() {
  const panel = document.createElement("aside");
  panel.id = "validation-panel";
  panel.hidden = true;
  panel.setAttribute("role", "complementary");
  panel.style.cssText = [
    "position:fixed",
    "top:0",
    "right:0",
    "width:360px",
    "max-width:90vw",
    "height:100vh",
    "background:var(--surface2,#161b22)",
    "border-left:1px solid var(--border-hover,rgba(255,255,255,0.14))",
    "box-shadow:-10px 0 40px rgba(0,0,0,0.6)",
    "z-index:1100",
    "display:flex",
    "flex-direction:column",
    "color:var(--text,#e6edf3)",
    "font:13px system-ui,sans-serif",
    "transform:translateX(100%)",
    "transition:transform 0.2s ease",
  ].join(";");
  document.body.appendChild(panel);
  return panel;
}

function header(report) {
  const h = document.createElement("div");
  h.style.cssText =
    "padding:16px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;flex-shrink:0;";
  const score = report.score != null ? Math.round(report.score * 100) : "—";
  const pass = report.pass ? "PASS" : "FAIL";
  const passColor = report.pass ? "#98c379" : "#e06c75";
  h.innerHTML = `
    <div style="font-size:24px;font-weight:700;">${score}<span style="font-size:11px;opacity:0.5;"> / 100</span></div>
    <div style="flex:1;">
      <div style="font-size:11px;letter-spacing:0.08em;color:${passColor};font-weight:600;">${pass}</div>
      <div style="font-size:11px;opacity:0.55;margin-top:2px;">${report.summary ? report.summary.errors + " errors, " + report.summary.warnings + " warnings" : ""}</div>
    </div>
    <button type="button" class="vpanel-close" style="background:none;border:none;color:inherit;font-size:20px;cursor:pointer;padding:4px 8px;" aria-label="Close">×</button>
  `;
  return h;
}

function body(report) {
  const b = document.createElement("div");
  b.style.cssText = "flex:1;overflow-y:auto;padding:12px 16px;";
  if (!report.violations || !report.violations.length) {
    b.innerHTML =
      '<div style="opacity:0.5;text-align:center;margin-top:40px;">No violations. Layout passes all checks.</div>';
    return b;
  }
  // Group by rule
  const byRule = {};
  for (const v of report.violations) {
    if (!byRule[v.rule]) byRule[v.rule] = [];
    byRule[v.rule].push(v);
  }
  for (const [rule, items] of Object.entries(byRule)) {
    const section = document.createElement("div");
    section.style.cssText = "margin-bottom:20px;";
    const errors = items.filter((i) => i.severity === "error").length;
    const warnings = items.filter((i) => i.severity === "warning").length;
    section.innerHTML = `
      <div style="font-size:11px;letter-spacing:0.08em;font-weight:600;color:var(--text-muted,rgba(230,237,243,0.5));margin-bottom:8px;">
        ${rule} · ${errors > 0 ? errors + " error" + (errors === 1 ? "" : "s") + " " : ""}${warnings > 0 ? warnings + " warning" + (warnings === 1 ? "" : "s") : ""}
      </div>
    `;
    for (const v of items) {
      const row = document.createElement("div");
      row.style.cssText =
        "padding:10px 12px;margin-bottom:6px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);";
      const sevColor = v.severity === "error" ? "#e06c75" : "#e5c07b";
      row.innerHTML = `
        <div style="font-size:11px;color:${sevColor};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${v.severity}</div>
        <div style="font-family:ui-monospace,monospace;font-size:10px;opacity:0.6;margin-bottom:6px;word-break:break-all;">${v.path}</div>
        <div style="font-size:12px;line-height:1.4;margin-bottom:6px;">${escapeHtml(v.message)}</div>
        ${v.fix ? `<div style="font-size:11px;opacity:0.7;line-height:1.4;padding:6px 8px;background:rgba(86,182,194,0.08);border-left:2px solid var(--accent,#56b6c2);margin-top:6px;">${escapeHtml(v.fix)}</div>` : ""}
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button type="button" class="vpanel-ignore" data-rule="${v.rule}" data-path="${escapeHtml(v.path)}" style="font-size:10px;padding:4px 8px;background:rgba(255,255,255,0.06);color:inherit;border:1px solid rgba(255,255,255,0.12);border-radius:4px;cursor:pointer;">Ignore</button>
          <button type="button" class="vpanel-ask" data-rule="${v.rule}" data-path="${escapeHtml(v.path)}" style="font-size:10px;padding:4px 8px;background:rgba(86,182,194,0.15);color:var(--accent,#56b6c2);border:1px solid rgba(86,182,194,0.3);border-radius:4px;cursor:pointer;">Ask agent to fix</button>
        </div>
      `;
      section.appendChild(row);
    }
    b.appendChild(section);
  }
  return b;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function handleIgnore(rule, path) {
  if (!_currentContext) return;
  const { cardIndex, file } = _currentContext;
  vcfg.ignoreViolation({ file, rule, selector: path, cardIndex }).then(() => {
    log(`Ignored ${rule} at ${path}`, "ok");
  });
}

function handleAskAgent(rule, pathStr) {
  if (!_currentContext) return;
  log(
    `Agent, please fix ${rule} at ${pathStr} in card #${_currentContext.cardIndex + 1}.`,
    "accent",
  );
}

export function openValidationPanel(report, context) {
  if (!_panel) _panel = buildPanel();
  _currentContext = context || null;
  _panel.innerHTML = "";
  _panel.appendChild(header(report));
  _panel.appendChild(body(report));
  _panel.hidden = false;
  requestAnimationFrame(() => {
    _panel.style.transform = "translateX(0)";
  });
  _panel.querySelector(".vpanel-close").addEventListener("click", closeValidationPanel);
  _panel.querySelectorAll(".vpanel-ignore").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleIgnore(btn.dataset.rule, btn.dataset.path);
      btn.closest("div[style*='padding:10px']").style.opacity = "0.4";
    });
  });
  _panel.querySelectorAll(".vpanel-ask").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleAskAgent(btn.dataset.rule, btn.dataset.path);
    });
  });
}

export function closeValidationPanel() {
  if (!_panel) return;
  _panel.style.transform = "translateX(100%)";
  setTimeout(() => {
    if (_panel) _panel.hidden = true;
  }, 200);
}
