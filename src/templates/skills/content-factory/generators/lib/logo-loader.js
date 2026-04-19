// Browser-side loader for the project logo.
//
// Fetches GET /api/project/logo and caches the SVG bytes in shared state.
// The cache is keyed by the active project path — switching to a different
// project auto-invalidates the cache and re-fetches, so the overlay never
// shows a stale mark from a previous session.
//
// The resolver runs server-side (scripts/lib/logo-resolver.cjs) and returns
// the project logo, then active brand, then built-in default — in that
// order. We surface only the resolved bytes; consumers do not branch on
// source here.

import { state } from "./state.js";
import { BUILTIN_DEFAULT_SVG } from "./builtin-logo.js";

let inflight = null;
let cachedForProject = null;

function currentProjectKey() {
  const c = state.activeContent;
  if (c && c.source && c.source.sessionDir) return c.source.sessionDir;
  if (state.activeSessionDir) return state.activeSessionDir;
  return null; // built-in template preview — no project
}

export async function loadLogo(force = false) {
  const projectKey = currentProjectKey();
  const cacheHit = state.logoSvg && cachedForProject === projectKey;
  if (cacheHit && !force) return state.logoSvg;
  // Project switched (or force): invalidate before the new fetch.
  if (cachedForProject !== projectKey) {
    state.logoSvg = null;
    state.logoSource = null;
    inflight = null;
  }
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
      cachedForProject = projectKey;
      inflight = null;
      return state.logoSvg;
    })
    .catch(() => {
      state.logoSvg = BUILTIN_DEFAULT_SVG;
      state.logoSource = "builtin";
      cachedForProject = projectKey;
      inflight = null;
      return state.logoSvg;
    });
  return inflight;
}

export function clearLogoCache() {
  state.logoSvg = null;
  state.logoSource = null;
  cachedForProject = null;
  inflight = null;
}
