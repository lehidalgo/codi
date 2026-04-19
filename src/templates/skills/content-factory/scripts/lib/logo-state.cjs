'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Persist logo-overlay settings to <project>/state/logo-state.json so
// per-card positioning survives browser refresh, file watcher reloads,
// server restarts, and re-opens of the same project.
//
// On-disk shape (keyed by content file relative path):
//
//   {
//     "document/onepager.html": {
//       "logo":      { visible, size, x, y, userOverridden },
//       "cardLogos": { "0": { y: 5 }, "1": { size: 120 } }
//     },
//     "social/post-a.html": { ... }
//   }
//
// Validation is tolerant on read (malformed entries drop silently) and
// strict on write (path traversal throws, shape is coerced). Writes go
// through a temp-file-plus-rename pattern so an interrupted save never
// leaves the JSON corrupted for the next reader.

const STATE_FILENAME = 'logo-state.json';

// ── Path safety ────────────────────────────────────────────────────────────

/**
 * Validate the caller-supplied content-file path. Accepts relative POSIX
 * paths with forward slashes, rejects empty strings, absolute paths, and
 * any path containing `..` segments. Mirrors `resolveContentPath` in
 * workspace.cjs but returns a boolean — there is no filesystem lookup to
 * reject against because the state file is scoped to the project, not to
 * `content/`.
 */
function isSafeFileKey(file) {
  if (typeof file !== 'string' || file.length === 0) return false;
  if (file.startsWith('/') || file.startsWith('\\')) return false;
  if (file.includes('\\')) return false;
  const parts = file.split('/');
  for (const p of parts) {
    if (p === '' || p === '.' || p === '..') return false;
  }
  return true;
}

// ── Validation / sanitization ───────────────────────────────────────────────

const ALLOWED_OVERRIDE_KEYS = new Set(['visible', 'size', 'x', 'y']);
const DEFAULT_LOGO = Object.freeze({
  visible: true,
  size: 64,
  x: 85,
  y: 85,
  userOverridden: false,
});

function clampNumber(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (typeof min === 'number' && n < min) return min;
  if (typeof max === 'number' && n > max) return max;
  return n;
}

function coerceBoolean(v, fallback) {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function sanitizeLogo(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    visible: coerceBoolean(src.visible, DEFAULT_LOGO.visible),
    size: clampNumber(src.size, DEFAULT_LOGO.size, 1, 10000),
    x: clampNumber(src.x, DEFAULT_LOGO.x, 0, 100),
    y: clampNumber(src.y, DEFAULT_LOGO.y, 0, 100),
    userOverridden: coerceBoolean(src.userOverridden, DEFAULT_LOGO.userOverridden),
  };
}

function sanitizeCardOverride(override) {
  if (!override || typeof override !== 'object') return {};
  const out = {};
  for (const key of Object.keys(override)) {
    if (!ALLOWED_OVERRIDE_KEYS.has(key)) continue;
    const v = override[key];
    if (key === 'visible') {
      if (typeof v === 'boolean') out.visible = v;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      if (key === 'size') out.size = clampNumber(v, DEFAULT_LOGO.size, 1, 10000);
      else out[key] = clampNumber(v, DEFAULT_LOGO[key], 0, 100);
    }
  }
  return out;
}

function sanitizeCardLogos(input, cardCount) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  const max = Number.isFinite(cardCount) && cardCount >= 0 ? cardCount : Infinity;
  for (const key of Object.keys(input)) {
    const idx = Number(key);
    if (!Number.isInteger(idx) || idx < 0 || idx >= max) continue;
    const clean = sanitizeCardOverride(input[key]);
    if (Object.keys(clean).length > 0) out[String(idx)] = clean;
  }
  return out;
}

/**
 * Return a sanitized { logo, cardLogos } pair. Unknown fields drop,
 * numeric fields clamp, out-of-range cardLogos keys drop. Never throws.
 */
function sanitizeLogoState(input, opts) {
  const cardCount = opts && typeof opts.cardCount === 'number' ? opts.cardCount : Infinity;
  const src = input && typeof input === 'object' ? input : {};
  return {
    logo: sanitizeLogo(src.logo),
    cardLogos: sanitizeCardLogos(src.cardLogos, cardCount),
  };
}

// ── Disk I/O ────────────────────────────────────────────────────────────────

function statePath(projectDir) {
  return path.join(projectDir, 'state', STATE_FILENAME);
}

function readAllState(projectDir) {
  const p = statePath(projectDir);
  if (!fs.existsSync(p)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllState(projectDir, all) {
  const dir = path.join(projectDir, 'state');
  fs.mkdirSync(dir, { recursive: true });
  const dest = statePath(projectDir);
  const tmp = dest + '.tmp';
  // Write to a sibling temp file then rename — rename is atomic on the
  // same filesystem, so readers never observe a half-written JSON.
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), 'utf-8');
  fs.renameSync(tmp, dest);
}

function readLogoState(projectDir, file) {
  if (!projectDir || typeof projectDir !== 'string') return null;
  if (!isSafeFileKey(file)) return null;
  const all = readAllState(projectDir);
  const entry = all[file];
  if (!entry || typeof entry !== 'object') return null;
  return {
    logo: entry.logo && typeof entry.logo === 'object' ? { ...entry.logo } : null,
    cardLogos: entry.cardLogos && typeof entry.cardLogos === 'object' ? { ...entry.cardLogos } : {},
  };
}

function writeLogoState(projectDir, file, payload) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('writeLogoState requires a projectDir');
  }
  if (!isSafeFileKey(file)) {
    const e = new Error('invalid file path: ' + JSON.stringify(file));
    e.status = 400;
    throw e;
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('writeLogoState requires a payload');
  }
  const all = readAllState(projectDir);
  all[file] = {
    logo: payload.logo && typeof payload.logo === 'object' ? payload.logo : {},
    cardLogos: payload.cardLogos && typeof payload.cardLogos === 'object' ? payload.cardLogos : {},
  };
  writeAllState(projectDir, all);
}

module.exports = {
  readLogoState,
  writeLogoState,
  sanitizeLogoState,
  isSafeFileKey,
};
