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

// Logo lives at the SKILL ROOT under `assets/`. SVG is preferred, PNG is
// accepted. Variants (logo-light / logo-dark) are read opportunistically
// for theme-aware callers but never substitute for `logo.svg|png`.
const LOGO_STANDARD = [
  path.join('assets', 'logo.svg'),
  path.join('assets', 'logo.png'),
];

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

function findStandardLogo(skillDir) {
  for (const rel of LOGO_STANDARD) {
    const p = path.join(skillDir, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Discover installed brand skills under `skillsDir`. A skill qualifies
 * when its directory name ends in `-brand`. Tokens are optional.
 *
 * Each returned record carries:
 *   - name, dir, display_name, version
 *   - tokens (parsed tokens.json or empty object)
 *   - logoPath: absolute path to the standard logo file, or null when
 *     the brand does not yet conform (callers can run auto-discovery).
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

module.exports = { discoverBrands, LOGO_STANDARD };
