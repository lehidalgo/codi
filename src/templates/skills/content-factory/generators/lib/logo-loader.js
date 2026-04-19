// Browser-side loader for the project logo.
//
// Fetches GET /api/project/logo once per session, caches the SVG bytes in
// shared state, and exposes a promise-based API consumers can await before
// rendering overlays or building export docs.
//
// The resolver runs server-side (scripts/lib/logo-resolver.cjs) and returns
// the project logo, then active brand, then built-in default — in that
// order. We surface only the resolved bytes; consumers do not branch on
// source here.

import { state } from "./state.js";
import { BUILTIN_DEFAULT_SVG } from "./builtin-logo.js";

let inflight = null;

export async function loadLogo(force = false) {
  if (state.logoSvg && !force) return state.logoSvg;
  if (inflight) return inflight;
  inflight = fetch("/api/project/logo")
    .then((r) => {
      if (!r.ok) return null;
      state.logoSource = r.headers.get("X-Logo-Source") || "unknown";
      return r.text();
    })
    .then((svg) => {
      // Fall back to the inline built-in if the server could not resolve
      // a project or brand logo; consumers always have something to render.
      state.logoSvg = svg && svg.includes("<svg") ? svg : BUILTIN_DEFAULT_SVG;
      if (!state.logoSource) state.logoSource = "builtin";
      inflight = null;
      return state.logoSvg;
    })
    .catch(() => {
      state.logoSvg = BUILTIN_DEFAULT_SVG;
      state.logoSource = "builtin";
      inflight = null;
      return state.logoSvg;
    });
  return inflight;
}

export function clearLogoCache() {
  state.logoSvg = null;
  state.logoSource = null;
  inflight = null;
}
