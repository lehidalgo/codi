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
 *
 * Returns `null` when the skill has no static assets. Callers (the
 * scaffolder and template loader) already guard against a missing
 * staticDir, so this is safe. An earlier version fell back to
 * `thisDir` in this case, but in bundled mode that resolves to
 * `dist/`, which caused the scaffolder to copy the entire
 * `dist/templates/` tree (every other skill, every rule, every
 * mcp-server) into the current skill's install directory when
 * `STATIC_SUBDIRS` included "templates".
 */
export function resolveStaticDir(skillDirName: string, importMetaUrl: string): string | null {
  const thisDir = dirname(fileURLToPath(importMetaUrl));

  // Dev: import.meta.url points to the skill's own index.ts —
  // thisDir IS the skill directory (contains template.ts)
  if (existsSync(join(thisDir, "template.ts")) || existsSync(join(thisDir, "template.js"))) {
    return thisDir;
  }

  // Bundled: assets copied to dist/templates/skills/{name}/ by build
  const distPath = join(thisDir, "templates", "skills", skillDirName);
  if (existsSync(distPath)) {
    return distPath;
  }

  // Skill has no static assets. Caller must treat `null` as "skip
  // static-file copy" — guarded in skill-template-loader.ts and
  // skill-scaffolder.ts already.
  return null;
}
