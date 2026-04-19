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

function readSvgSafe(p) {
  try {
    const bytes = fs.readFileSync(p, 'utf-8');
    if (!bytes.includes('<svg')) return null;
    return bytes;
  } catch { return null; }
}

/**
 * Resolve the logo SVG for a render. Order:
 *   1. <projectDir>/assets/logo.svg
 *   2. <activeBrand>/brand/assets/logo.svg
 *   3. BUILTIN_DEFAULT_SVG
 *
 * Returns { source: 'project'|'brand'|'builtin', svg: string }.
 */
function resolveLogo({ projectDir, skillsDir, activeBrand }) {
  if (projectDir) {
    const candidate = path.join(projectDir, 'assets', 'logo.svg');
    const svg = readSvgSafe(candidate);
    if (svg) return { source: 'project', svg };
  }
  if (activeBrand && skillsDir) {
    const brand = discoverBrands(skillsDir).find((b) => b.name === activeBrand);
    if (brand && brand.logoPath) {
      const svg = readSvgSafe(brand.logoPath);
      if (svg) return { source: 'brand', svg };
    }
  }
  return { source: 'builtin', svg: BUILTIN_DEFAULT_SVG };
}

/**
 * Copy the active brand's logo to <projectDir>/assets/logo.svg.
 * Idempotent: no-op when the project logo already exists or when no brand
 * source is available. Returns true when a copy occurred.
 */
function bootstrapProjectLogo({ projectDir, skillsDir, activeBrand }) {
  if (!projectDir) return false;
  const dest = path.join(projectDir, 'assets', 'logo.svg');
  if (fs.existsSync(dest)) return false;
  if (!activeBrand || !skillsDir) return false;
  const brand = discoverBrands(skillsDir).find((b) => b.name === activeBrand);
  if (!brand || !brand.logoPath) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(brand.logoPath, dest);
  return true;
}

module.exports = { resolveLogo, bootstrapProjectLogo, BUILTIN_DEFAULT_SVG };
