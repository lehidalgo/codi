// Validation settings widget — sidebar section with master switch + per-
// layer toggles. Reads/writes through validation-config.js.

import { $ } from "./dom.js";
import * as vcfg from "./validation-config.js";

const LAYERS = [
  { key: "badge", label: "Score badges" },
  { key: "exportPreflight", label: "Export preflight" },
  { key: "statusGate", label: "Status gate" },
  { key: "agentDiscipline", label: "Agent auto-fix" },
];

let _built = false;

function buildMarkup() {
  const panel = $("validation-settings");
  if (!panel) return;
  panel.innerHTML = `
    <div class="panel-label">
      Validation
      <button id="val-master-toggle" type="button" class="logo-toggle-btn active">ON</button>
    </div>
    <div id="val-layer-rows" style="margin-top:8px;display:flex;flex-direction:column;gap:4px;"></div>
    <div class="inspect-hint" id="val-hint" style="margin-top:6px;">Box Layout Theory checks every card and gates exports.</div>
  `;
  const rows = $("val-layer-rows");
  for (const layer of LAYERS) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:11px;color:var(--text-muted,rgba(230,237,243,0.55));";
    row.innerHTML = `
      <span style="letter-spacing:0.03em;">${layer.label}</span>
      <button type="button" class="val-layer-btn logo-toggle-btn active" data-layer="${layer.key}">ON</button>
    `;
    rows.appendChild(row);
  }
}

function syncWidgetFromConfig() {
  const cfg = vcfg.getConfig();
  const masterBtn = $("val-master-toggle");
  const hint = $("val-hint");
  if (!masterBtn) return;

  if (!cfg) {
    // Template or unavailable — disable the widget
    masterBtn.textContent = "—";
    masterBtn.disabled = true;
    masterBtn.classList.remove("active");
    document.querySelectorAll(".val-layer-btn").forEach((b) => {
      b.disabled = true;
      b.textContent = "—";
      b.classList.remove("active");
    });
    if (hint) hint.textContent = "Validation only on My Work sessions.";
    return;
  }

  masterBtn.disabled = false;
  const enabled = cfg.enabled !== false;
  masterBtn.textContent = enabled ? "ON" : "OFF";
  masterBtn.classList.toggle("active", enabled);

  for (const layer of LAYERS) {
    const btn = document.querySelector(`.val-layer-btn[data-layer="${layer.key}"]`);
    if (!btn) continue;
    btn.disabled = !enabled;
    const on = enabled && cfg.layers && cfg.layers[layer.key] !== false;
    btn.textContent = on ? "ON" : "OFF";
    btn.classList.toggle("active", on);
    btn.style.opacity = enabled ? "1" : "0.4";
  }

  if (hint) {
    hint.textContent = enabled
      ? `Preset: ${cfg.preset || "strict"} · Threshold: ${cfg.threshold || 0.85}`
      : "Validation disabled for this session.";
  }
}

function wireEvents() {
  const masterBtn = $("val-master-toggle");
  if (!masterBtn) return;
  masterBtn.addEventListener("click", async () => {
    const cfg = vcfg.getConfig();
    if (!cfg) return;
    const next = !(cfg.enabled !== false);
    await vcfg.toggleLayer("all", next);
  });
  document.querySelectorAll(".val-layer-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cfg = vcfg.getConfig();
      if (!cfg) return;
      const key = btn.dataset.layer;
      const current = cfg.layers && cfg.layers[key] !== false;
      await vcfg.toggleLayer(key, !current);
    });
  });
}

export function initValidationSettings() {
  if (!_built) {
    buildMarkup();
    wireEvents();
    _built = true;
    vcfg.onChange(syncWidgetFromConfig);
  }
  syncWidgetFromConfig();
}

export function refreshValidationSettings() {
  if (!_built) {
    initValidationSettings();
    return;
  }
  syncWidgetFromConfig();
}
