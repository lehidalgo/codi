// Client-side validation config cache + helpers. Fetches the resolved
// config from /api/validation-config and exposes synchronous accessors.
// All other validation UI modules read through here.

import { state } from "./state.js";

let _config = null;
let _loading = null;
const _subscribers = new Set();

export function getConfig() {
  return _config;
}

export function getLayer(name) {
  if (!_config) return true; // default-on until we know otherwise
  if (_config.enabled === false) return false;
  if (!_config.layers) return true;
  return _config.layers[name] !== false;
}

export function isEnabled() {
  if (!_config) return true;
  return _config.enabled !== false;
}

export function onChange(fn) {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

function notify() {
  for (const fn of _subscribers) {
    try {
      fn(_config);
    } catch {}
  }
}

export async function loadForActiveSession() {
  if (_loading) return _loading;
  const c = state.activeContent;
  if (!c) {
    _config = null;
    notify();
    return null;
  }
  // Only sessions have a per-session config; templates fall back to defaults.
  if (c.kind !== "session" || !c.source || !c.source.sessionDir) {
    _config = null;
    notify();
    return null;
  }
  _loading = (async () => {
    try {
      const url = "/api/validation-config?project=" + encodeURIComponent(c.source.sessionDir);
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      _config = data.config || null;
    } catch {
      _config = null;
    }
    notify();
    _loading = null;
    return _config;
  })();
  return _loading;
}

export async function toggleLayer(layer, value) {
  const c = state.activeContent;
  if (!c || c.kind !== "session" || !c.source || !c.source.sessionDir) return null;
  try {
    const res = await fetch("/api/validation-config/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: c.source.sessionDir, layer, value }),
    });
    const data = await res.json();
    if (data.ok) {
      _config = data.config;
      notify();
    }
    return data;
  } catch {
    return null;
  }
}

export async function patchConfig(patch) {
  const c = state.activeContent;
  if (!c || c.kind !== "session" || !c.source || !c.source.sessionDir) return null;
  try {
    const res = await fetch("/api/validation-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: c.source.sessionDir, patch }),
    });
    const data = await res.json();
    if (data.ok) {
      _config = data.config;
      notify();
    }
    return data;
  } catch {
    return null;
  }
}

export async function ignoreViolation({ file, rule, selector, cardIndex }) {
  const c = state.activeContent;
  if (!c || c.kind !== "session" || !c.source || !c.source.sessionDir) return null;
  try {
    const res = await fetch("/api/validation-config/ignore-violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: c.source.sessionDir,
        file,
        rule,
        selector,
        cardIndex,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      _config = data.config;
      notify();
    }
    return data;
  } catch {
    return null;
  }
}

export async function fetchHealth() {
  try {
    const res = await fetch("/api/validator-health");
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
