/**
 * Post-build script: copies skill template static assets to dist/.
 *
 * Skill templates contain non-JS files (scripts/, references/, assets/,
 * agents/) that cannot be inlined into the JS bundle. This script copies
 * them into dist/templates/skills/{name}/ so they resolve correctly both
 * when running from the repo and when installed as an npm package.
 *
 * Called via tsup's onSuccess hook after every successful build.
 */
import { cpSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src/templates/skills";
const DEST = "dist/templates/skills";
const SUBDIRS = ["assets", "references", "scripts", "agents", "brand", "generators"];

let copied = 0;

for (const skill of readdirSync(SRC)) {
  const skillSrc = join(SRC, skill);
  if (!statSync(skillSrc).isDirectory()) continue;

  for (const sub of SUBDIRS) {
    const subSrc = join(skillSrc, sub);
    if (!existsSync(subSrc)) continue;

    const entries = readdirSync(subSrc).filter((f) => f !== ".gitkeep");
    if (entries.length === 0) continue;

    cpSync(subSrc, join(DEST, skill, sub), { recursive: true });
    copied++;
  }
}

console.log(`Copied ${copied} skill asset directories to ${DEST}`);
