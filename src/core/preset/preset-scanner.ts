import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { PRESET_MANIFEST_FILENAME } from "../../constants.js";
import { Logger } from "../output/logger.js";

export interface DiscoveredPreset {
  name: string;
  dir: string;
  description: string;
  version: string;
}

/**
 * Scans a directory for preset subfolders.
 *
 * Rules:
 * - Each preset must be in its own subfolder containing preset.yaml
 * - Root-level preset.yaml (flat/mixed) is warned and ignored
 * - Scans 1 level deep only
 */
export async function scanForPresets(dir: string): Promise<DiscoveredPreset[]> {
  const log = Logger.getInstance();
  const results: DiscoveredPreset[] = [];

  // Warn if root has preset.yaml — presets must be in subfolders
  try {
    await fs.access(path.join(dir, PRESET_MANIFEST_FILENAME));
    log.warn(
      "Found preset.yaml at root level — presets must be in their own subfolder. Ignoring root.",
    );
  } catch {
    // No root preset — expected
  }

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return results;
  }

  for (const name of names) {
    if (name.startsWith(".")) continue;
    const entryPath = path.join(dir, name);
    const stat = await fs.stat(entryPath).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const manifestPath = path.join(dir, name, PRESET_MANIFEST_FILENAME);
    try {
      await fs.access(manifestPath);
      const raw = await fs.readFile(manifestPath, "utf-8");
      const manifest = parseYaml(raw) as Record<string, unknown>;
      results.push({
        name,
        dir: path.join(dir, name),
        description: String(manifest.description ?? ""),
        version: String(manifest.version ?? ""),
      });
    } catch {
      continue;
    }
  }

  return results;
}
