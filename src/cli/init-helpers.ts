import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { stringify as stringifyYaml } from "yaml";
import type { FlagDefinition } from "../types/flags.js";
import {
  DEFAULT_PRESET,
  MANIFEST_FILENAME,
  FLAGS_FILENAME,
  SKILL_OUTPUT_FILENAME,
} from "../constants.js";
import { getBuiltinPresetDefinition } from "../templates/presets/index.js";
import { getPreset } from "../core/flags/flag-presets.js";
import type { PresetName } from "../core/flags/flag-presets.js";
import { generateMitLicense } from "../core/scaffolder/license-generator.js";
import { VERSION } from "../index.js";
import {
  ArtifactManifestManager,
  bootstrapManifestFromState,
  buildArtifactEntries,
} from "../core/version/artifact-manifest.js";
import {
  buildTemplateHashRegistry,
  getTemplateFingerprint,
} from "../core/version/template-hash-registry.js";
import { computeUpgradeStatus } from "../core/version/upgrade-detector.js";
import type { ArtifactUpgradeInfo } from "../core/version/upgrade-detector.js";
import type { ExistingSelections } from "./init-wizard.js";
import { readLockFile, writeLockFile } from "../core/preset/preset-registry.js";

export function inferHookType(
  filePath: string,
): "pre-commit" | "commit-msg" | "secret-scan" | "file-size-check" | "version-check" {
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
  await fs.writeFile(path.join(configDir, MANIFEST_FILENAME), stringifyYaml(manifest), "utf-8");

  const presetDef = getBuiltinPresetDefinition(presetName);
  const mergedFlags: Record<string, FlagDefinition> =
    flagOverrides ?? presetDef?.flags ?? getPreset(DEFAULT_PRESET as PresetName);

  const flagsObj: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(mergedFlags)) {
    const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
    if (def.locked) entry["locked"] = true;
    flagsObj[key] = entry;
  }
  await fs.writeFile(path.join(configDir, FLAGS_FILENAME), stringifyYaml(flagsObj), "utf-8");

  const projectName = path.basename(path.dirname(configDir));
  await fs.writeFile(path.join(configDir, "LICENSE.txt"), generateMitLicense(projectName), "utf-8");
}

export interface ArtifactSelections {
  rules: string[];
  skills: string[];
  agents: string[];
  mcpServers: string[];
}

/**
 * Removes artifacts that were deselected during an upgrade-mode init.
 * Only removes files with `managed_by: codi` — user-managed files are never deleted.
 * Returns the names of artifacts that were removed.
 */
export async function removeDeselectedArtifacts(
  configDir: string,
  previous: ArtifactSelections,
  next: ArtifactSelections,
): Promise<string[]> {
  const removed: string[] = [];

  const checks: Array<{
    type: keyof ArtifactSelections;
    dirName: string;
    isDir?: boolean;
  }> = [
    { type: "rules", dirName: "rules" },
    { type: "agents", dirName: "agents" },
    { type: "mcpServers", dirName: "mcp-servers" },
    { type: "skills", dirName: "skills", isDir: true },
  ];

  for (const { type, dirName, isDir } of checks) {
    const newSet = new Set(next[type]);
    for (const name of previous[type]) {
      if (newSet.has(name)) continue;

      const filePath = isDir
        ? path.join(configDir, dirName, name, SKILL_OUTPUT_FILENAME)
        : path.join(configDir, dirName, `${name}.md`);

      try {
        const content = await fs.readFile(filePath, "utf8");
        const { data } = matter(content);
        if (data["managed_by"] === "user") continue;

        if (isDir) {
          await fs.rm(path.join(configDir, dirName, name), {
            recursive: true,
            force: true,
          });
        } else {
          await fs.unlink(filePath);
        }
        removed.push(name);
      } catch {
        // File already gone or unreadable — skip silently
      }
    }
  }

  return removed;
}

/**
 * Resolves and caches upgrade info for an existing installation.
 * Bootstraps the manifest from state if no manifest exists yet.
 */
export async function computeUpgradeInfo(
  configDir: string,
  projectRoot: string,
  existingSelections: ExistingSelections,
): Promise<ArtifactUpgradeInfo[]> {
  const manifestMgr = new ArtifactManifestManager(configDir);
  const readResult = await manifestMgr.read();
  const manifest =
    readResult.ok && Object.keys(readResult.data.artifacts).length > 0
      ? readResult.data
      : await bootstrapManifestFromState(configDir, projectRoot, existingSelections);
  return computeUpgradeStatus(manifest, buildTemplateHashRegistry());
}

/**
 * Removes deselected artifacts and records newly installed ones in the manifest.
 * Pass prevSelections only in update mode.
 */
export async function syncManifestOnInit(
  configDir: string,
  ruleTemplates: string[],
  skillTemplates: string[],
  agentTemplates: string[],
  mcpServerTemplates: string[],
  prevSelections?: ArtifactSelections,
): Promise<void> {
  const manifestMgr = new ArtifactManifestManager(configDir);

  if (prevSelections) {
    const nextSelections: ArtifactSelections = {
      rules: ruleTemplates,
      skills: skillTemplates,
      agents: agentTemplates,
      mcpServers: mcpServerTemplates,
    };
    const removed = await removeDeselectedArtifacts(configDir, prevSelections, nextSelections);
    if (removed.length > 0) {
      await manifestMgr.removeArtifacts(removed);
    }
  }

  const reads: Array<{
    names: string[];
    type: "rule" | "skill" | "agent" | "mcp-server";
    fileFn: (name: string) => string;
  }> = [
    { names: ruleTemplates, type: "rule", fileFn: (n) => path.join(configDir, "rules", `${n}.md`) },
    {
      names: skillTemplates,
      type: "skill",
      fileFn: (n) => path.join(configDir, "skills", n, "SKILL.md"),
    },
    {
      names: agentTemplates,
      type: "agent",
      fileFn: (n) => path.join(configDir, "agents", `${n}.md`),
    },
    {
      names: mcpServerTemplates,
      type: "mcp-server",
      fileFn: (n) => path.join(configDir, "mcp-servers", `${n}.yaml`),
    },
  ];

  const artifactData: Array<{
    name: string;
    type: "rule" | "skill" | "agent" | "mcp-server";
    content: string;
    managedBy: "codi" | "user";
    artifactVersion: number | "unknown";
  }> = [];

  for (const { names, type, fileFn } of reads) {
    for (const name of names) {
      try {
        const content = await fs.readFile(fileFn(name), "utf-8");
        artifactData.push({
          name,
          type,
          content,
          managedBy: "codi",
          artifactVersion: getTemplateFingerprint(name)?.artifactVersion ?? "unknown",
        });
      } catch {
        /* skip if file missing */
      }
    }
  }

  if (artifactData.length > 0) {
    const entries = buildArtifactEntries(artifactData);
    await manifestMgr.recordInstall(entries);
  }
}

/** Records the installed preset in the lock file. */
export async function recordPresetLock(
  configDir: string,
  presetName: string,
  displayPresetName: string,
): Promise<void> {
  const lock = await readLockFile(configDir);
  lock.presets[presetName] = {
    version: "builtin",
    source: presetName,
    sourceType: "builtin",
    installedAt: new Date().toISOString(),
  };
  if (displayPresetName !== presetName) {
    lock.presets[displayPresetName] = {
      version: "1.0.0",
      source: `local:${displayPresetName}`,
      sourceType: "local",
      installedAt: new Date().toISOString(),
    };
  }
  await writeLockFile(configDir, lock);
}
