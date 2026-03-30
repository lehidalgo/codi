import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the static asset directory for a skill template.
 *
 * Dev mode: import.meta.url points to the source file in
 * src/templates/skills/{name}/index.ts — dirname resolves directly.
 *
 * Bundled mode: import.meta.url points to a chunk in dist/ — assets
 * are copied to dist/templates/skills/{name}/ by the build script
 * (scripts/copy-skill-assets.mjs), so we resolve relative to dist/.
 */
export function resolveStaticDir(
  skillDirName: string,
  importMetaUrl: string,
): string {
  const thisDir = dirname(fileURLToPath(importMetaUrl));

  // Dev: import.meta.url points to the skill's own index.ts —
  // thisDir IS the skill directory (contains template.ts)
  if (
    existsSync(join(thisDir, "template.ts")) ||
    existsSync(join(thisDir, "template.js"))
  ) {
    return thisDir;
  }

  // Bundled: assets copied to dist/templates/skills/{name}/ by build
  const distPath = join(thisDir, "templates", "skills", skillDirName);
  if (existsSync(distPath)) {
    return distPath;
  }

  // Fallback: return thisDir (won't crash, may have empty dirs)
  return thisDir;
}
