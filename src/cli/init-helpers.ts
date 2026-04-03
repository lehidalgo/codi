import fs from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import type { FlagDefinition } from "../types/flags.js";
import {
  DEFAULT_PRESET,
  MANIFEST_FILENAME,
  FLAGS_FILENAME,
} from "../constants.js";
import { getBuiltinPresetDefinition } from "../templates/presets/index.js";
import { getPreset } from "../core/flags/flag-presets.js";
import type { PresetName } from "../core/flags/flag-presets.js";
import { generateMitLicense } from "../core/scaffolder/license-generator.js";
import { VERSION } from "../index.js";

export function inferHookType(
  filePath: string,
):
  | "pre-commit"
  | "commit-msg"
  | "secret-scan"
  | "file-size-check"
  | "version-check" {
  if (filePath.includes("secret-scan")) return "secret-scan";
  if (filePath.includes("file-size-check")) return "file-size-check";
  if (filePath.includes("version-check")) return "version-check";
  if (filePath.includes("commit-msg")) return "commit-msg";
  return "pre-commit";
}

export async function createProjectStructure(
  configDir: string,
  agents: string[],
  presetName: string,
  versionPin: boolean,
  flagOverrides?: Record<string, FlagDefinition>,
): Promise<void> {
  const dirs = [
    configDir,
    path.join(configDir, "rules"),
    path.join(configDir, "skills"),
    path.join(configDir, "mcp-servers"),
    path.join(configDir, "frameworks"),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const manifest: Record<string, unknown> = {
    name:
      path
        .basename(path.dirname(configDir))
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-") || "project",
    version: "1",
    agents,
  };
  if (versionPin) {
    manifest["engine"] = { requiredVersion: `>=${VERSION}` };
  }
  await fs.writeFile(
    path.join(configDir, MANIFEST_FILENAME),
    stringifyYaml(manifest),
    "utf-8",
  );

  const presetDef = getBuiltinPresetDefinition(presetName);
  const mergedFlags: Record<string, FlagDefinition> =
    flagOverrides ??
    presetDef?.flags ??
    getPreset(DEFAULT_PRESET as PresetName);

  const flagsObj: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(mergedFlags)) {
    const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
    if (def.locked) entry["locked"] = true;
    flagsObj[key] = entry;
  }
  await fs.writeFile(
    path.join(configDir, FLAGS_FILENAME),
    stringifyYaml(flagsObj),
    "utf-8",
  );

  const projectName = path.basename(path.dirname(configDir));
  await fs.writeFile(
    path.join(configDir, "LICENSE.txt"),
    generateMitLicense(projectName),
    "utf-8",
  );
}
