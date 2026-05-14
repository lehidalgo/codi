#!/usr/bin/env node
/**
 * ISSUE-056 — verify every artifact template declares `maintainers:` and that
 * every declared maintainer appears in the repo CODEOWNERS file.
 *
 * Exit codes:
 *   0  all good
 *   1  one or more violations detected (prints unified diff-style report)
 *
 * The check is intentionally local-only: it does NOT call the GitHub API to
 * verify @user / @org/team existence. The complementary
 * `mszostok/codeowners-validator` step in .github/workflows/codeowners.yml
 * handles that against a live token.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const TARGETS = [
  { dir: "src/templates/rules", recursive: false, kind: "rule" },
  { dir: "src/templates/skills", recursive: true, filename: "template.ts", kind: "skill" },
  { dir: "src/templates/agents", recursive: false, kind: "agent" },
];

function listTemplates() {
  const out = [];
  for (const t of TARGETS) {
    const abs = join(ROOT, t.dir);
    if (t.recursive && t.filename) {
      for (const e of readdirSync(abs, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const target = join(abs, e.name, t.filename);
        try {
          if (statSync(target).isFile()) out.push({ path: target, kind: t.kind });
        } catch {
          // skip dirs that lack the filename
        }
      }
    } else {
      for (const e of readdirSync(abs, { withFileTypes: true })) {
        if (!e.isFile() || !e.name.endsWith(".ts") || e.name === "index.ts") continue;
        out.push({ path: join(abs, e.name), kind: t.kind });
      }
    }
  }
  return out;
}

function extractMaintainers(file) {
  const raw = readFileSync(file, "utf-8");
  const match = raw.match(/maintainers:\s*\[([^\]]+)\]/);
  if (!match) return null;
  const items = match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return items;
}

function loadCodeOwners() {
  const candidates = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"];
  for (const rel of candidates) {
    const abs = join(ROOT, rel);
    if (existsSync(abs)) {
      return { path: rel, content: readFileSync(abs, "utf-8") };
    }
  }
  return null;
}

function ownersInCodeowners(content) {
  const owners = new Set();
  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const tokens = line.split(/\s+/).slice(1); // first token is the pattern
    for (const tok of tokens) owners.add(tok);
  }
  return owners;
}

const errors = [];
const templates = listTemplates();
const codeowners = loadCodeOwners();
if (!codeowners) {
  errors.push(
    "CODEOWNERS file not found at any of: .github/CODEOWNERS, CODEOWNERS, docs/CODEOWNERS",
  );
}
const declaredOwners = codeowners ? ownersInCodeowners(codeowners.content) : new Set();

for (const t of templates) {
  const maintainers = extractMaintainers(t.path);
  if (!maintainers) {
    errors.push(`${t.path} — missing or malformed \`maintainers:\` frontmatter`);
    continue;
  }
  for (const m of maintainers) {
    if (!declaredOwners.has(m)) {
      errors.push(
        `${t.path} declares maintainer ${m} but ${codeowners.path} has no row mentioning it`,
      );
    }
  }
}

if (errors.length === 0) {
  console.log(`OK: ${templates.length} templates verified against ${codeowners.path}`);
  process.exit(0);
}

console.error(`FAIL: ${errors.length} violation(s)`);
for (const e of errors) console.error(`  • ${e}`);
console.error(
  `\nFix:\n  1. Add the maintainer(s) to ${codeowners?.path ?? ".github/CODEOWNERS"}.\n` +
    `  2. Run \`npm run build && npm test\`.\n` +
    `  3. Re-run \`node scripts/check-maintainers.mjs\`.`,
);
process.exit(1);
