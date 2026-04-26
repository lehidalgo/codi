'use strict';
const fs = require('fs');
const path = require('path');

// Tokens files are optional and may live in one of two historically-used
// locations. A brand skill is discoverable as soon as it ends in `-brand`
// — tokens are read when available but never required.
const TOKEN_CANDIDATES = [
  path.join('brand', 'tokens.json'),
  path.join('scripts', 'brand_tokens.json'),
];

// Canonical logo filenames. `logo.svg` / `logo.png` are the preferred
// names. The resolver additionally accepts any file in `assets/` whose
// basename contains "logo" — this covers brands that ship themed
// variants (`logo-light.svg`, `logo-dark.svg`, `logo-black.svg`) or
// descriptive names (`bbva-logo.svg`, `brand-logo-primary.svg`). All
// such files count as conforming. See logo-convention.md for the full
// ranking.
const LOGO_EXACT = ['logo.svg', 'logo.png'];

// Extensions the logo scanner accepts.
const LOGO_EXTENSIONS = new Set(['.svg', '.png']);

function readTokens(skillDir) {
  for (const rel of TOKEN_CANDIDATES) {
    const p = path.join(skillDir, rel);
    if (!fs.existsSync(p)) continue;
    try {
      const tokens = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return { tokens, tokensPath: p };
    } catch { /* malformed — fall through */ }
  }
  return { tokens: {}, tokensPath: null };
}

/**
 * Find the most preferred logo file in `<skillDir>/assets/`.
 *
 * Ranking:
 *   1. Exact `assets/logo.svg`                   (canonical, SVG)
 *   2. Exact `assets/logo.png`                   (canonical, PNG)
 *   3. Any SVG in assets/ matching `logo[-_]*`   (e.g. logo-light.svg, logo_horizontal.svg)
 *   4. Any PNG in assets/ matching `logo[-_]*`
 *   5. Any SVG in assets/ whose basename contains "logo" (e.g. bbva-logo.svg)
 *   6. Any PNG in assets/ whose basename contains "logo"
 *
 * Within each tier, files are ordered alphabetically for deterministic
 * selection. Returns the absolute path of the first match, or null.
 */
function findStandardLogo(skillDir) {
  // Tier 1-2 — exact canonical names.
  for (const name of LOGO_EXACT) {
    const p = path.join(skillDir, 'assets', name);
    if (fs.existsSync(p)) return p;
  }

  // Tiers 3-6 — pattern matches in assets/ (non-recursive).
  const assetsDir = path.join(skillDir, 'assets');
  let entries;
  try { entries = fs.readdirSync(assetsDir, { withFileTypes: true }); }
  catch { return null; }

  const matches = [];
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const ext = path.extname(ent.name).toLowerCase();
    if (!LOGO_EXTENSIONS.has(ext)) continue;
    const base = path.basename(ent.name, ext);
    if (!/logo/i.test(base)) continue;
    matches.push(ent.name);
  }
  if (matches.length === 0) return null;

  // Sort by tier: SVG > PNG, `logo[-_]*` prefix > `*logo*`, then A-Z.
  matches.sort((a, b) => {
    const aSvg = a.toLowerCase().endsWith('.svg') ? 0 : 1;
    const bSvg = b.toLowerCase().endsWith('.svg') ? 0 : 1;
    if (aSvg !== bSvg) return aSvg - bSvg;
    const aPrefix = /^logo[-_]/i.test(a) ? 0 : 1;
    const bPrefix = /^logo[-_]/i.test(b) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return a.localeCompare(b);
  });

  return path.join(assetsDir, matches[0]);
}

/**
 * Discover installed brand skills under `skillsDir`. A skill qualifies
 * when its directory name ends in `-brand`. Tokens are optional.
 *
 * Each returned record carries:
 *   - name, dir, display_name, version
 *   - tokens (parsed tokens.json or empty object)
 *   - logoPath: absolute path to an acceptable logo file (see
 *     findStandardLogo), or null when no logo is present in assets/.
 */
function discoverBrands(skillsDir) {
  const brands = [];
  if (!fs.existsSync(skillsDir)) return brands;
  for (const entry of fs.readdirSync(skillsDir)) {
    if (!entry.endsWith('-brand')) continue;
    const skillDir = path.join(skillsDir, entry);
    let st;
    try { st = fs.statSync(skillDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    const { tokens } = readTokens(skillDir);
    const logoPath = findStandardLogo(skillDir);
    brands.push({
      name: entry,
      dir: skillDir,
      display_name: tokens.display_name || entry,
      version: tokens.version || 1,
      tokens,
      logoPath,
    });
  }
  return brands;
}

module.exports = {
  discoverBrands,
  findStandardLogo,
  LOGO_EXACT,
  LOGO_EXTENSIONS,
  // Legacy alias — kept to avoid breaking consumers that imported
  // LOGO_STANDARD previously. Points at the exact canonical names.
  LOGO_STANDARD: LOGO_EXACT.map((n) => path.join('assets', n)),
};
