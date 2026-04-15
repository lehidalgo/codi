'use strict';

// Validation config cascade:
//   built-in defaults (by content type) ← user defaults ← session manifest ← perFile overrides
//
// Every layer can override any field. The resolver merges them top-down
// and returns a single resolved object plus a source map so the UI can
// show which scope each field came from.

const fs = require('node:fs');
const path = require('node:path');

const USER_DEFAULTS_FILE = '_validation-defaults.json';

// Built-in defaults per content type. These are the last-resort values
// when nothing has been set by user/session/perFile.
const DEFAULTS_BY_TYPE = {
  social: {
    enabled: true,
    layers: {
      endpoint: true,
      badge: true,
      agentDiscipline: true,
      exportPreflight: true,
      statusGate: true,
    },
    preset: 'lenient',
    threshold: 0.8,
    tolerance: null,
    blockStatus: ['done'],
    overrideExport: 'soft',
    iterateLimit: 3,
    perFile: {},
  },
  slides: {
    enabled: true,
    layers: {
      endpoint: true,
      badge: true,
      agentDiscipline: true,
      exportPreflight: true,
      statusGate: true,
    },
    preset: 'strict',
    threshold: 0.9,
    tolerance: null,
    blockStatus: ['review', 'done'],
    overrideExport: 'soft',
    iterateLimit: 3,
    perFile: {},
  },
  document: {
    enabled: true,
    layers: {
      endpoint: true,
      badge: true,
      agentDiscipline: true,
      exportPreflight: true,
      statusGate: true,
    },
    preset: 'strict',
    threshold: 0.9,
    tolerance: null,
    blockStatus: ['review', 'done'],
    overrideExport: 'soft',
    iterateLimit: 3,
    perFile: {},
  },
};

function getDefaultsFor(contentType) {
  const type = (contentType || 'social').toLowerCase();
  return deepClone(DEFAULTS_BY_TYPE[type] || DEFAULTS_BY_TYPE.social);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Deep merge: patch wins on every key. Arrays replace, objects merge.
function deepMerge(base, patch) {
  if (patch == null) return base;
  if (typeof patch !== 'object' || Array.isArray(patch)) return patch;
  if (typeof base !== 'object' || base == null || Array.isArray(base)) {
    return patch;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      out[k] = null;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function readUserDefaults(workspaceDir) {
  const file = path.join(workspaceDir, USER_DEFAULTS_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function writeUserDefaults(workspaceDir, cfg) {
  fs.mkdirSync(workspaceDir, { recursive: true });
  const file = path.join(workspaceDir, USER_DEFAULTS_FILE);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

function readSessionConfig(projectDir) {
  const manifestPath = path.join(projectDir, 'state', 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { manifest: null, cfg: null, type: null };
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const cfg = manifest.validation || null;
    const type = (manifest.preset && manifest.preset.type) || null;
    return { manifest, cfg, type };
  } catch {
    return { manifest: null, cfg: null, type: null };
  }
}

function writeSessionConfig(projectDir, cfg) {
  const manifestPath = path.join(projectDir, 'state', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('session manifest not found: ' + manifestPath);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  manifest.validation = cfg;
  manifest.updatedAt = Date.now();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Resolve the effective validation config for a session, merging the
 * cascade: built-in default (by type) → user defaults → session cfg →
 * per-file override.
 *
 * Returns { config, source, scope } where source is a flat map of
 * top-level keys to their originating scope name.
 */
function resolveConfig({ workspaceDir, projectDir, file }) {
  const session = readSessionConfig(projectDir);
  const typeDefaults = getDefaultsFor(session.type);
  const userDefaults = workspaceDir ? readUserDefaults(workspaceDir) : null;
  const sessionCfg = session.cfg;

  let merged = typeDefaults;
  if (userDefaults) merged = deepMerge(merged, userDefaults);
  if (sessionCfg) merged = deepMerge(merged, sessionCfg);

  // Per-file override: if file is given and perFile[file] exists, merge it
  // on top, EXCEPT for perFile itself (avoid recursive nesting).
  if (file && merged.perFile && merged.perFile[file]) {
    const override = merged.perFile[file];
    merged = deepMerge(merged, override);
  }

  // Build a source map showing which scope provided each top-level field.
  const source = {};
  for (const key of Object.keys(merged)) {
    source[key] = 'type-default';
    if (userDefaults && key in userDefaults) source[key] = 'user';
    if (sessionCfg && key in sessionCfg) source[key] = 'session';
    if (file && merged.perFile[file] && key in merged.perFile[file]) {
      source[key] = 'perFile';
    }
  }

  return { config: merged, source, type: session.type };
}

/**
 * Patch the session config — merges a partial patch into the existing
 * session cfg and writes the manifest. Returns the new resolved config.
 */
function patchSessionConfig({ workspaceDir, projectDir, patch }) {
  const session = readSessionConfig(projectDir);
  const current = session.cfg || {};
  const merged = deepMerge(current, patch);
  writeSessionConfig(projectDir, merged);
  return resolveConfig({ workspaceDir, projectDir });
}

/**
 * Flip a single layer on/off. Convenience for the UI toggles.
 * Layer values: "all" | "endpoint" | "badge" | "agentDiscipline" |
 *               "exportPreflight" | "statusGate"
 * "all" maps to the top-level `enabled` flag.
 */
function setLayer({ workspaceDir, projectDir, layer, value }) {
  let patch;
  if (layer === 'all') {
    patch = { enabled: Boolean(value) };
  } else {
    patch = { layers: { [layer]: Boolean(value) } };
  }
  return patchSessionConfig({ workspaceDir, projectDir, patch });
}

function addIgnoreRule({ workspaceDir, projectDir, file, rule, selector, cardIndex }) {
  const session = readSessionConfig(projectDir);
  const current = session.cfg || {};
  const perFile = { ...(current.perFile || {}) };
  const entry = perFile[file] || {};
  const ignoreList = entry.ignoreViolations || [];
  const newEntry = { rule, selector, cardIndex };
  // Dedupe: don't add the same rule+selector+card twice.
  const exists = ignoreList.some(
    (e) => e.rule === rule && e.selector === selector && e.cardIndex === cardIndex,
  );
  if (!exists) ignoreList.push(newEntry);
  perFile[file] = { ...entry, ignoreViolations: ignoreList };
  return patchSessionConfig({ workspaceDir, projectDir, patch: { perFile } });
}

module.exports = {
  DEFAULTS_BY_TYPE,
  getDefaultsFor,
  deepMerge,
  readUserDefaults,
  writeUserDefaults,
  readSessionConfig,
  writeSessionConfig,
  resolveConfig,
  patchSessionConfig,
  setLayer,
  addIgnoreRule,
};
