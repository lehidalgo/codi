'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { discoverBrands } = require('./brand-discovery.cjs');

// Built-in default SVG (matches the legacy hardcoded "codi" overlay).
// Kept inlined to avoid a runtime file read for the always-available fallback.
const BUILTIN_DEFAULT_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64">',
  '<defs><linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">',
  '<stop offset="0%" stop-color="#56b6c2"/>',
  '<stop offset="100%" stop-color="#61afef"/>',
  '</linearGradient></defs>',
  '<text x="100" y="44" font-family="\'Geist Mono\',monospace" font-size="40" font-weight="500" fill="url(#cg)" text-anchor="middle">codi</text>',
  '</svg>',
].join('');

// Project/brand canonical filenames. Order encodes preference (SVG first,
// PNG second). Consumers iterate these against both project and brand roots.
const LOGO_FILENAMES = ['logo.svg', 'logo.png'];

// Extensions accepted by the auto-discovery scanner.
const SCAN_EXTENSIONS = new Set(['.svg', '.png']);

// Max scan depth so the scanner never descends into node_modules-like trees.
const MAX_SCAN_DEPTH = 4;

// Directories the scanner skips outright.
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'evals']);

function readBytes(p) {
  try { return fs.readFileSync(p); } catch { return null; }
}

function readSvgSafe(p) {
  const bytes = readBytes(p);
  if (!bytes) return null;
  const text = bytes.toString('utf-8');
  if (!text.includes('<svg')) return null;
  return text;
}

function isSvgContent(text) {
  return typeof text === 'string' && text.includes('<svg');
}

/**
 * Recursively enumerate logo candidates under `rootDir` with a score.
 * The scorer rewards filename signals (logo, brand-name pattern), shallow
 * paths, preferred parent directories, and SVG over PNG. See
 * references/logo-convention.md for the full ranking table.
 */
function discoverLogoCandidates(rootDir, options = {}) {
  const out = [];
  const brandName = (options.brandName || '').replace(/-brand$/, '').toLowerCase();
  if (!rootDir || !fs.existsSync(rootDir)) return out;

  function walk(dir, depth) {
    if (depth > MAX_SCAN_DEPTH) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (IGNORED_DIRS.has(ent.name)) continue;
        walk(full, depth + 1);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!SCAN_EXTENSIONS.has(ext)) continue;
      const base = path.basename(ent.name, ext).toLowerCase();
      const rel = path.relative(rootDir, full);
      const parts = rel.split(path.sep);
      const parent = parts.length > 1 ? parts[parts.length - 2] : '';
      let score = 0;
      const reasons = [];
      if (base === 'logo') { score += 100; reasons.push('filename "logo"'); }
      else if (base.startsWith('logo')) { score += 90; reasons.push('filename starts with "logo"'); }
      else if (brandName && base.toLowerCase().includes(brandName)) { score += 80; reasons.push('filename contains brand name'); }
      else if (/^[a-z]{2,8}_(rgb|cmyk|logo|mark)\b/i.test(ent.name)) { score += 70; reasons.push('brand-style filename'); }
      else if (base.includes('logo')) { score += 20; reasons.push('filename mentions "logo"'); }
      if (parent === 'assets') { score += 20; reasons.push('in assets/'); }
      else if (parent === 'brand') { score += 15; reasons.push('in brand/'); }
      if (ext === '.svg') { score += 10; reasons.push('is SVG'); }
      if (parts.length <= 2) { score += 5; reasons.push('shallow path'); }
      if (score === 0) continue;
      out.push({ path: full, relpath: rel, score, ext, reasons });
    }
  }
  walk(rootDir, 1);
  out.sort((a, b) => b.score - a.score || a.relpath.length - b.relpath.length);
  return out;
}

function firstExisting(dir, filenames, relRoot) {
  for (const name of filenames) {
    const p = path.join(dir, relRoot || '', name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Resolve the logo for a render. 7-step chain:
 *
 *   1. <projectDir>/assets/logo.svg
 *   2. <projectDir>/assets/logo.png
 *   3. <brandDir>/assets/logo.svg
 *   4. <brandDir>/assets/logo.png
 *   5. <brandDir> recursive — best filename signal (logo*, brand-name)
 *   6. <brandDir> recursive — fallback to any SVG anywhere in the skill
 *   7. BUILTIN_DEFAULT_SVG
 *
 * Returns { source, svg?, binary?, contentType, path, conforming }.
 *   - `source`: 'project' | 'brand' | 'brand-discovered' | 'builtin'
 *   - `svg` for text payloads, `binary` (Buffer) for PNG/raster.
 *   - `conforming`: true when resolved via steps 1-4 (standard paths).
 */
function resolveLogo({ projectDir, skillsDir, activeBrand }) {
  // Steps 1-2 — project standard paths.
  if (projectDir) {
    const svgPath = path.join(projectDir, 'assets', 'logo.svg');
    const svg = readSvgSafe(svgPath);
    if (svg) return { source: 'project', svg, contentType: 'image/svg+xml', path: svgPath, conforming: true };
    const pngPath = path.join(projectDir, 'assets', 'logo.png');
    const png = readBytes(pngPath);
    if (png) return { source: 'project', binary: png, contentType: 'image/png', path: pngPath, conforming: true };
  }

  // Resolve brand directory (if any).
  const brand = activeBrand && skillsDir
    ? discoverBrands(skillsDir).find((b) => b.name === activeBrand)
    : null;

  if (brand) {
    // Steps 3-4 — brand standard paths.
    const svgPath = path.join(brand.dir, 'assets', 'logo.svg');
    const svg = readSvgSafe(svgPath);
    if (svg) return { source: 'brand', svg, contentType: 'image/svg+xml', path: svgPath, conforming: true };
    const pngPath = path.join(brand.dir, 'assets', 'logo.png');
    const png = readBytes(pngPath);
    if (png) return { source: 'brand', binary: png, contentType: 'image/png', path: pngPath, conforming: true };

    // Steps 5-6 — auto-discovery for non-conforming brands.
    const candidates = discoverLogoCandidates(brand.dir, { brandName: brand.name });
    if (candidates.length > 0) {
      const top = candidates[0];
      if (top.ext === '.svg') {
        const text = readSvgSafe(top.path);
        if (text) return { source: 'brand-discovered', svg: text, contentType: 'image/svg+xml', path: top.path, conforming: false, score: top.score };
      } else {
        const bin = readBytes(top.path);
        if (bin) return { source: 'brand-discovered', binary: bin, contentType: 'image/png', path: top.path, conforming: false, score: top.score };
      }
    }
  }

  // Step 7 — built-in default.
  return { source: 'builtin', svg: BUILTIN_DEFAULT_SVG, contentType: 'image/svg+xml', path: null, conforming: true };
}

/**
 * Seed `<projectDir>/assets/logo.{svg,png}` from whatever the resolver finds.
 * Idempotent: no-op when a project logo already exists in either format.
 * Returns { copied, source, filename } — copied=true when a new file landed.
 */
function bootstrapProjectLogo({ projectDir, skillsDir, activeBrand }) {
  if (!projectDir) return { copied: false, source: null, filename: null };
  const existing = firstExisting(projectDir, LOGO_FILENAMES, 'assets');
  if (existing) return { copied: false, source: 'project', filename: path.basename(existing) };

  const result = resolveLogo({ projectDir, skillsDir, activeBrand });
  // Never bootstrap the built-in default — only real brand-sourced marks
  // get copied into the project. Otherwise every project would end up
  // with a stale "codi" logo.svg even when the brand ships nothing.
  if (result.source === 'builtin') return { copied: false, source: null, filename: null };

  const ext = result.contentType === 'image/png' ? '.png' : '.svg';
  const filename = 'logo' + ext;
  const dest = path.join(projectDir, 'assets', filename);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (result.binary) fs.writeFileSync(dest, result.binary);
  else fs.writeFileSync(dest, result.svg, 'utf-8');
  return { copied: true, source: result.source, filename };
}

/**
 * Report on a brand skill's conformance with the logo standard.
 * Agents call this at project creation / brand activation to decide
 * whether to auto-fix, ask the user, or proceed.
 */
function checkBrandConformance({ skillsDir, brandName }) {
  const brand = discoverBrands(skillsDir).find((b) => b.name === brandName);
  if (!brand) {
    return {
      brandName,
      found: false,
      conforming: false,
      standardPath: 'assets/logo.svg',
      discovered: [],
      advice: `Brand "${brandName}" was not discovered in ${skillsDir}. Confirm the skill name ends in "-brand" and the directory is reachable.`,
    };
  }
  const conforming = !!brand.logoPath;
  const discovered = conforming ? [] : discoverLogoCandidates(brand.dir, { brandName });
  let advice;
  if (conforming) {
    advice = `Brand "${brandName}" conforms. Standard logo at ${path.relative(brand.dir, brand.logoPath)}.`;
  } else if (discovered.length === 0) {
    advice = `Brand "${brandName}" ships no logo. Ask the user to add one at assets/logo.svg (or .png).`;
  } else if (discovered[0].score >= 100) {
    advice = `Brand "${brandName}" has a strong candidate at ${discovered[0].relpath} (score ${discovered[0].score}). Copy or rename it to assets/logo.svg to conform.`;
  } else {
    advice = `Brand "${brandName}" has ${discovered.length} possible candidate(s). Top: ${discovered[0].relpath} (score ${discovered[0].score}). Confirm with the user which should become assets/logo.svg.`;
  }
  return {
    brandName,
    found: true,
    conforming,
    standardPath: 'assets/logo.svg',
    discovered: discovered.slice(0, 5).map(({ relpath, score, reasons, ext }) => ({ relpath, score, reasons, ext })),
    advice,
  };
}

module.exports = {
  resolveLogo,
  bootstrapProjectLogo,
  checkBrandConformance,
  discoverLogoCandidates,
  BUILTIN_DEFAULT_SVG,
  LOGO_FILENAMES,
};
