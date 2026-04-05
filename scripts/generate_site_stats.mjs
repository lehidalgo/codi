/**
 * Derives all site stats from the codebase and writes site/stats.json.
 * Run before deploying so every number on the site reflects the actual source.
 * Usage: node scripts/generate_site_stats.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tpl = join(root, 'src', 'templates');

// ── Template counts ──────────────────────────────────────────────────────────

function countFiles(dir, ext = '.ts', exclude = ['index.ts', 'types.ts']) {
  return readdirSync(dir)
    .filter(f => f.endsWith(ext) && !exclude.includes(f))
    .length;
}

function countDirs(dir) {
  return readdirSync(dir)
    .filter(f => statSync(join(dir, f)).isDirectory())
    .length;
}

function countFilesRecursive(dir, ext = '.ts', exclude = ['index.ts', 'types.ts']) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      total += countFilesRecursive(full, ext, exclude);
    } else if (entry.endsWith(ext) && !exclude.includes(entry)) {
      total++;
    }
  }
  return total;
}

const rules = countFiles(join(tpl, 'rules'));
const skills = countDirs(join(tpl, 'skills'));
const agentTemplates = countFiles(join(tpl, 'agents'));
const mcp = countFilesRecursive(join(tpl, 'mcp-servers'));
const templates = rules + skills + agentTemplates + mcp;

// ── Version ──────────────────────────────────────────────────────────────────

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// ── Supported AI agents (count from VALID_PLATFORMS) ─────────────────────────

const hookPolicySrc = readFileSync(
  join(root, 'src', 'core', 'hooks', 'hook-policy-templates.ts'),
  'utf8',
);
const platformsMatch = hookPolicySrc.match(/VALID_PLATFORMS\s*=\s*\[([^\]]+)\]/);
const agents = platformsMatch
  ? (platformsMatch[1].match(/'[^']+'/g) || []).length
  : 0;

// ── Hook types (unique names in hook-registry) ────────────────────────────────

const hookRegistrySrc = readFileSync(
  join(root, 'src', 'core', 'hooks', 'hook-registry.ts'),
  'utf8',
);
const hookNames = [...hookRegistrySrc.matchAll(/name:\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
const hooks = new Set(hookNames).size;

// ── Write ─────────────────────────────────────────────────────────────────────

const stats = {
  version,
  agents,
  hooks,
  templates,
  rules,
  skills,
  agentTemplates,
  mcp,
  generatedAt: new Date().toISOString(),
};

const out = join(root, 'site', 'stats.json');
writeFileSync(out, JSON.stringify(stats, null, 2) + '\n');
console.log('site/stats.json written:', stats);
