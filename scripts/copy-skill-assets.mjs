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
const SUBDIRS = ["assets", "references", "scripts", "agents", "brand", "generators", "templates"];

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
