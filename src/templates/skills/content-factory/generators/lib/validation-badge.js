// Validation score badge — a small chip rendered on every card in the
// Preview strip. Async-fetches the validation report and colors itself.
//
// States: pending (gray), pass (green), warn (yellow), fail (red),
// disabled (muted "off"), skipped (muted "—"), error (dark red).

import { state } from "./state.js";
import * as vcfg from "./validation-config.js";

let _panelOpener = null;
export function registerPanelOpener(fn) {
  _panelOpener = fn;
}

// Sync all badge visibility when validation config changes.
let _configListenerSet = false;
function ensureConfigListener() {
  if (_configListenerSet) return;
  _configListenerSet = true;
  vcfg.onChange(() => {
    const show = vcfg.isEnabled() && vcfg.getLayer("badge");
    document.querySelectorAll(".validation-badge").forEach((b) => {
      b.style.display = show ? "" : "none";
    });
  });
}

// Inject tooltip styles once — native title is unreliable over iframes.
let _tooltipStyled = false;
function ensureTooltipStyle() {
  if (_tooltipStyled) return;
  _tooltipStyled = true;
  const s = document.createElement("style");
  s.textContent = `
    .validation-badge[data-tooltip]:hover::after {
      content: attr(data-tooltip);
      position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%);
      margin-bottom: 6px; padding: 4px 8px; border-radius: 4px;
      background: rgba(20,24,34,0.95); color: rgba(230,237,243,0.85);
      font-size: 11px; font-weight: 400; letter-spacing: 0.01em;
      white-space: nowrap; pointer-events: none; z-index: 10;
    }
  `;
  document.head.appendChild(s);
}

function classifyScore(report, threshold) {
  if (!report) return "pending";
  if (report.skipped) return "skipped";
  if (!report.ok) return "error";
  if (report.pass) return "pass";
  if (report.score != null && report.score >= (threshold || 0.85) - 0.1) return "warn";
  return "fail";
}

function renderText(state, report) {
  if (state === "pending") return "…";
  if (state === "skipped") return "—";
  if (state === "disabled") return "off";
  if (state === "error") return "!";
  if (report && report.score != null) return Math.round(report.score * 100) + "";
  return "";
}

function styleFor(state) {
  const base = {
    position: "absolute",
    left: "10px",
    bottom: "10px",
    width: "34px",
    height: "22px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
    borderRadius: "11px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.04em",
    cursor: "pointer",
    zIndex: "3",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(6px)",
    transition: "background 0.12s, border-color 0.12s, transform 0.12s",
  };
  const palette = {
    pending: {
      bg: "rgba(20,24,34,0.85)",
      color: "rgba(230,237,243,0.5)",
      border: "rgba(255,255,255,0.12)",
    },
    skipped: {
      bg: "rgba(20,24,34,0.85)",
      color: "rgba(230,237,243,0.4)",
      border: "rgba(255,255,255,0.12)",
    },
    disabled: {
      bg: "rgba(20,24,34,0.85)",
      color: "rgba(230,237,243,0.4)",
      border: "rgba(255,255,255,0.12)",
    },
    pass: { bg: "rgba(152,195,121,0.18)", color: "#98c379", border: "rgba(152,195,121,0.4)" },
    warn: { bg: "rgba(229,192,123,0.18)", color: "#e5c07b", border: "rgba(229,192,123,0.4)" },
    fail: { bg: "rgba(224,108,117,0.2)", color: "#e06c75", border: "rgba(224,108,117,0.5)" },
    error: { bg: "rgba(224,108,117,0.25)", color: "#e06c75", border: "rgba(224,108,117,0.6)" },
  };
  const p = palette[state] || palette.pending;
  return {
    ...base,
    background: p.bg,
    color: p.color,
    borderColor: p.border,
  };
}

function applyStyle(el, styleObj) {
  for (const [k, v] of Object.entries(styleObj)) {
    el.style[k] = v;
  }
}

export function createValidationBadge(cardIndex, file) {
  ensureTooltipStyle();
  ensureConfigListener();
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "validation-badge";
  badge.setAttribute("aria-label", "Validation score");
  badge.dataset.cardIndex = String(cardIndex);
  badge.dataset.file = file || "";
  applyStyle(badge, styleFor("pending"));
  badge.textContent = "…";

  // If badges are disabled, hide entirely
  if (!vcfg.getLayer("badge")) {
    badge.style.display = "none";
    return badge;
  }

  // Kick off async validation
  const c = state.activeContent;
  if (!c || c.kind !== "session" || !c.source || !c.source.sessionDir) {
    // Templates: show a muted "—" chip
    applyStyle(badge, styleFor("skipped"));
    badge.textContent = "—";
    badge.dataset.tooltip = "Validation only on My Work sessions";
    return badge;
  }

  const projectDir = c.source.sessionDir;
  const fileName = file || c.source.file;

  fetch("/api/validate-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: projectDir, file: fileName, cardIndex }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((report) => {
      if (!report) {
        applyStyle(badge, styleFor("error"));
        badge.textContent = "!";
        badge.dataset.tooltip = "Validation error";
        return;
      }
      const cfg = vcfg.getConfig();
      const threshold = (cfg && cfg.threshold) || 0.85;
      const stateName = classifyScore(report, threshold);
      applyStyle(badge, styleFor(stateName));
      badge.textContent = renderText(stateName, report);
      const label =
        stateName === "pending"
          ? "Validating..."
          : stateName === "pass"
            ? "Layout passes all checks"
            : stateName === "warn"
              ? `${report.violations?.length || 0} minor issues`
              : stateName === "fail"
                ? `${report.violations?.length || 0} issues — click to review`
                : stateName === "skipped"
                  ? "Validation skipped: " + (report.skipped || "")
                  : "Validation error";
      badge.dataset.tooltip = label;
      badge._report = report;
    })
    .catch(() => {
      applyStyle(badge, styleFor("error"));
      badge.textContent = "!";
    });

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (_panelOpener && badge._report) {
      _panelOpener(badge._report, { cardIndex, file: fileName, projectDir });
    }
  });

  return badge;
}
