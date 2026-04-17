'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Discover installed brand skills by scanning the parent skills directory
 * for entries ending in `-brand` that contain a `brand/tokens.json` file.
 */
function discoverBrands(skillsDir) {
  const brands = [];
  if (!fs.existsSync(skillsDir)) return brands;
  for (const entry of fs.readdirSync(skillsDir)) {
    if (!entry.endsWith('-brand')) continue;
    const skillDir = path.join(skillsDir, entry);
    const tokensPath = path.join(skillDir, 'brand', 'tokens.json');
    if (!fs.existsSync(tokensPath)) continue;
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
      brands.push({
        name: entry,
        dir: skillDir,
        display_name: tokens.display_name || entry,
        version: tokens.version || 1,
        tokens,
      });
    } catch { /* skip malformed tokens.json */ }
  }
  return brands;
}

module.exports = { discoverBrands };
