import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

/**
 * Pre-commit hook that validates *-brand skill directories against the brand standard.
 * Checks tokens.json schema, required files (tokens.css, SVG assets, references/, evals/,
 * LICENSE.txt), and templates/ convention. Blocks commits on violations with
 * agent-actionable error output.
 */
export const BRAND_SKILL_VALIDATE_TEMPLATE = `#!/usr/bin/env node
// ${PROJECT_NAME_DISPLAY} brand-skill-validate
// Validates every *-brand skill directory staged for commit against the brand standard.
// For each staged file, walks up the path to find a *-brand parent directory,
// then validates: tokens.json schema, required files, and templates/ convention.
// Dual circuit: works for both .codi/skills/*-brand/ and src/templates/skills/*-brand/
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

// Walk up from a file path to find a *-brand ancestor directory.
// Returns the brand skill root (absolute) or null if not inside a *-brand dir.
function findBrandRoot(filePath) {
  let dir = path.dirname(path.resolve(filePath));
  const stop = path.parse(dir).root;
  while (dir !== stop) {
    if (path.basename(dir).endsWith('-brand')) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Collect unique brand roots from all staged files
const brandRoots = new Set();
for (const f of files) {
  const root = findBrandRoot(f);
  if (root) brandRoots.add(root);
}

if (brandRoots.size === 0) process.exit(0);

const violations = [];

function addViolation(absPath, message) {
  violations.push({ skillPath: path.relative(ROOT, absPath), message });
}

for (const brandRoot of brandRoots) {
  // ── 1. tokens.json schema ──────────────────────────────────────────────────
  const tokensPath = path.join(brandRoot, 'brand', 'tokens.json');
  if (!fs.existsSync(tokensPath)) {
    addViolation(tokensPath, 'Missing required file: brand/tokens.json');
  } else {
    let tokens = null;
    try {
      tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
    } catch (e) {
      addViolation(tokensPath, \`brand/tokens.json is not valid JSON: \${e.message}\`);
    }
    if (tokens && typeof tokens === 'object') {
      // Required top-level fields
      for (const field of ['brand', 'display_name', 'version', 'themes', 'fonts', 'assets', 'voice']) {
        if (!(field in tokens)) addViolation(tokensPath, \`Missing required field: \${field}\`);
      }
      // themes.dark and themes.light
      const themeKeys = ['background', 'surface', 'text_primary', 'text_secondary', 'primary', 'accent', 'logo'];
      for (const theme of ['dark', 'light']) {
        if (!tokens.themes || typeof tokens.themes[theme] !== 'object') {
          addViolation(tokensPath, \`Missing required field: themes.\${theme}\`);
        } else {
          for (const key of themeKeys) {
            if (!(key in tokens.themes[theme])) {
              addViolation(tokensPath, \`Missing required field: themes.\${theme}.\${key}\`);
            }
          }
        }
      }
      // fonts
      if (tokens.fonts && typeof tokens.fonts === 'object') {
        for (const key of ['headlines', 'body', 'monospace']) {
          if (!(key in tokens.fonts)) addViolation(tokensPath, \`Missing required field: fonts.\${key}\`);
        }
        if (!('google_fonts_url' in tokens.fonts)) {
          addViolation(tokensPath, 'Missing required field: fonts.google_fonts_url');
        }
      }
      // assets
      if (tokens.assets && typeof tokens.assets === 'object') {
        for (const key of ['logo_dark_bg', 'logo_light_bg']) {
          if (!(key in tokens.assets)) addViolation(tokensPath, \`Missing required field: assets.\${key}\`);
        }
      }
      // voice
      if (tokens.voice && typeof tokens.voice === 'object') {
        if (typeof tokens.voice.tone !== 'string') {
          addViolation(tokensPath, 'Missing required field: voice.tone (must be a string)');
        }
        if (!Array.isArray(tokens.voice.phrases_use)) {
          addViolation(tokensPath, 'Missing required field: voice.phrases_use (must be an array)');
        }
        if (!Array.isArray(tokens.voice.phrases_avoid)) {
          addViolation(tokensPath, 'Missing required field: voice.phrases_avoid (must be an array)');
        }
      }
    }
  }

  // ── 2. Required files ──────────────────────────────────────────────────────
  const tokensCssPath = path.join(brandRoot, 'brand', 'tokens.css');
  if (!fs.existsSync(tokensCssPath)) {
    addViolation(tokensCssPath, 'Missing required file: brand/tokens.css');
  }

  // At least one .svg in assets/
  const assetsDir = path.join(brandRoot, 'assets');
  const hasSvg = fs.existsSync(assetsDir) &&
    fs.readdirSync(assetsDir).some(f => f.endsWith('.svg'));
  if (!hasSvg) {
    addViolation(assetsDir, 'Missing required asset: at least one .svg file in assets/ (logo-dark.svg or logo-light.svg)');
  }

  // references/ with at least one .html file
  const refsDir = path.join(brandRoot, 'references');
  const hasRefsHtml = fs.existsSync(refsDir) &&
    fs.readdirSync(refsDir).some(f => f.endsWith('.html'));
  if (!hasRefsHtml) {
    addViolation(refsDir, 'Missing required directory: references/ (no .html files found)');
  }

  // evals/evals.json
  const evalsPath = path.join(brandRoot, 'evals', 'evals.json');
  if (!fs.existsSync(evalsPath)) {
    addViolation(evalsPath, 'Missing required file: evals/evals.json');
  }

  // LICENSE.txt
  const licensePath = path.join(brandRoot, 'LICENSE.txt');
  if (!fs.existsSync(licensePath)) {
    addViolation(licensePath, 'Missing required file: LICENSE.txt');
  }

  // ── 3. templates/ convention (only when templates/ directory exists) ────────
  const templatesDir = path.join(brandRoot, 'templates');
  if (fs.existsSync(templatesDir) && fs.statSync(templatesDir).isDirectory()) {
    for (const f of fs.readdirSync(templatesDir)) {
      if (!f.endsWith('.html')) continue;
      const htmlPath = path.join(templatesDir, f);
      const content = fs.readFileSync(htmlPath, 'utf-8');
      if (!content.includes('<meta name="codi:template"')) {
        addViolation(htmlPath, \`templates/\${f} is missing <meta name="codi:template"> tag\`);
      }
    }
  }
}

if (violations.length === 0) process.exit(0);

console.error(\`\\n[codi] brand-skill-validate: \${violations.length} violation(s)\\n\`);
const byPath = {};
for (const { skillPath, message } of violations) {
  if (!byPath[skillPath]) byPath[skillPath] = [];
  byPath[skillPath].push(message);
}
for (const [p, msgs] of Object.entries(byPath)) {
  console.error(\`  \${p}\`);
  for (const msg of msgs) console.error(\`  \\u2717 \${msg}\`);
  console.error('');
}
console.error('  Action required (coding agent):');
console.error('    1. Fix each violation listed above.');
console.error('       Reference: src/templates/skills/brand-creator/references/brand-standard.md');
console.error('    2. Stage the fixed files and commit again.');
process.exit(1);
`;
