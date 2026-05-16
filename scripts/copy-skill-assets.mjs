/**
 * Post-build script: copies skill template static assets to dist/.
 *
 * Skill templates contain non-JS files (scripts/, references/, assets/,
 * agents/) that cannot be inlined into the JS bundle. This script copies
 * them into dist/templates/skills/{name}/ so they resolve correctly both
 * when running from the repo and when installed as an npm package.
 *
 * Also copies root-level .md files (e.g. README.md) from each skill directory
 * so they are available to copyStaticFiles() in skill-scaffolder.ts.
 *
 * Called via tsup's onSuccess hook after every successful build.
 */
import { cpSync, copyFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const SRC = "src/templates/skills";
const DEST = "dist/templates/skills";
const SUBDIRS = [
  "assets",
  "references",
  "scripts",
  "agents",
  "brand",
  "generators",
  "templates",
  "evals",
];

let copied = 0;

for (const skill of readdirSync(SRC)) {
  const skillSrc = join(SRC, skill);
  if (!statSync(skillSrc).isDirectory()) continue;

  // Copy root-level .md files (README.md, etc.)
  for (const file of readdirSync(skillSrc)) {
    if (!file.endsWith(".md")) continue;
    const srcPath = join(skillSrc, file);
    if (!statSync(srcPath).isFile()) continue;
    const destDir = join(DEST, skill);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcPath, join(destDir, file));
    copied++;
  }

  // Copy named subdirectories
  for (const sub of SUBDIRS) {
    const subSrc = join(skillSrc, sub);
    if (!existsSync(subSrc)) continue;

    const entries = readdirSync(subSrc).filter((f) => f !== ".gitkeep");
    if (entries.length === 0) continue;

    cpSync(subSrc, join(DEST, skill, sub), {
      recursive: true,
      filter: (src) => !src.includes(`${sep}node_modules`),
    });
    copied++;
  }
}

console.log(`Copied ${copied} skill asset directories/files to ${DEST}`);

// Copy consolidation prompt templates (Item 4 of v3 closure plan).
const CONSOLIDATION_SRC = "src/templates/consolidation";
const CONSOLIDATION_DEST = "dist/templates/consolidation";
if (existsSync(CONSOLIDATION_SRC)) {
  cpSync(CONSOLIDATION_SRC, CONSOLIDATION_DEST, { recursive: true });
  const tmplCount = readdirSync(CONSOLIDATION_SRC).filter((f) => f.endsWith(".md.tmpl")).length;
  console.log(`Copied ${tmplCount} consolidation prompt templates to ${CONSOLIDATION_DEST}`);
}

// Copy workflow definition YAMLs (F2 of v3 zero closure).
const WORKFLOWS_SRC = "src/templates/workflows";
const WORKFLOWS_DEST = "dist/templates/workflows";
if (existsSync(WORKFLOWS_SRC)) {
  cpSync(WORKFLOWS_SRC, WORKFLOWS_DEST, { recursive: true });
  const yamlCount = readdirSync(WORKFLOWS_SRC).filter((f) => f.endsWith(".yaml")).length;
  console.log(`Copied ${yamlCount} workflow definitions to ${WORKFLOWS_DEST}`);
}

// Copy JSON schemas (F9 of v3 zero closure). The runtime resolves schemas via
// `import.meta.url` so dist needs the same `schemas/` subtree alongside the
// bundled chunks; without this, `codi workflow run` ENOENTs on first event.
const SCHEMAS_SRC = "src/schemas";
const SCHEMAS_DEST = "dist/schemas";
if (existsSync(SCHEMAS_SRC)) {
  cpSync(SCHEMAS_SRC, SCHEMAS_DEST, { recursive: true });
  console.log(`Copied JSON schemas to ${SCHEMAS_DEST}`);
}
