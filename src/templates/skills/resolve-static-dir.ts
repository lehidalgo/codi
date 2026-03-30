import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the static asset directory for a skill template.
 *
 * When running from source (tsx/vitest), import.meta.url points to the
 * actual source file and dirname works directly. When running from a tsup
 * bundle, import.meta.url points to a chunk in dist/ — so we walk up to
 * find the package root and resolve from there.
 */
export function resolveStaticDir(
  skillDirName: string,
  importMetaUrl: string,
): string {
  // Dev mode: import.meta.url is the actual source file
  const thisDir = dirname(fileURLToPath(importMetaUrl));
  const devPath = join(thisDir, skillDirName);
  if (
    existsSync(join(devPath, "template.js")) ||
    existsSync(join(devPath, "template.ts"))
  ) {
    return devPath;
  }

  // Bundled mode: walk up from import.meta.url to find package root
  let dir = thisDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "package.json"))) {
      const srcPath = join(dir, "src", "templates", "skills", skillDirName);
      if (existsSync(srcPath)) return srcPath;
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: return the dirname-based path (may be wrong but won't crash)
  return devPath;
}
