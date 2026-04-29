import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { FlagDefinition, ResolvedFlags } from "../types/flags.js";
import type { ToolingPromptResult } from "./wizard-summary.js";
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
import { StateManager } from "../core/config/state.js";
import type { ArtifactFileState } from "../core/config/state.js";
import { hashContent } from "../utils/hash.js";
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

function deriveProjectName(configDir: string): string {
  return (
    path
      .basename(path.dirname(configDir))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "project"
  );
}

/**
 * Idempotent: creates the standard `.codi/` subdirectory layout. Safe to call
 * on both fresh installs and existing projects — `mkdir -p` semantics.
 */
export async function ensureProjectDirs(configDir: string): Promise<void> {
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
}

/**
 * Read-merge-write persister for `codi.yaml`. Preserves user-set fields
 * (`description`, `layers`, `presetRegistry`, `presets`) that are not part
 * of the wizard's output. On a fresh install (no file present), seeds
 * `name` from the project directory and `version: "1"`.
 *
 * - `agents === undefined` leaves the existing agents list untouched.
 * - `versionPin === true` writes `engine.requiredVersion = ">=<VERSION>"`.
 * - `versionPin === false` removes the `engine` field.
 * - `versionPin === undefined` leaves `engine` untouched.
 */
export async function persistManifest(
  configDir: string,
  updates: { agents?: string[]; versionPin?: boolean },
): Promise<void> {
  const manifestPath = path.join(configDir, MANIFEST_FILENAME);

  let next: Record<string, unknown>;
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    const parsed: unknown = parseYaml(raw);
    next = parsed && typeof parsed === "object" ? { ...(parsed as Record<string, unknown>) } : {};
  } catch {
    next = {};
  }

  if (typeof next["name"] !== "string" || next["name"].length === 0) {
    next["name"] = deriveProjectName(configDir);
  }
  if (next["version"] !== "1") {
    next["version"] = "1";
  }

  if (updates.agents !== undefined) {
    next["agents"] = updates.agents;
  }
  if (updates.versionPin === true) {
    next["engine"] = { requiredVersion: `>=${VERSION}` };
  } else if (updates.versionPin === false) {
    delete next["engine"];
  }

  await fs.writeFile(manifestPath, stringifyYaml(next), "utf-8");
}

/**
 * Writes `flags.yaml` from a fully-resolved flag definition map. Always
 * overwrites — flags are derived from a preset choice or explicit overrides
 * collected by the wizard, so the wizard's answer is authoritative.
 */
export async function persistFlags(
  configDir: string,
  flags: Record<string, FlagDefinition>,
): Promise<void> {
  const flagsObj: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(flags)) {
    const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
    if (def.locked) entry["locked"] = true;
    flagsObj[key] = entry;
  }
  await fs.writeFile(path.join(configDir, FLAGS_FILENAME), stringifyYaml(flagsObj), "utf-8");
}

/**
 * Resolves the flag map to write to `flags.yaml`. Explicit overrides win;
 * otherwise falls back to the named preset's flags, then the default preset.
 */
export function resolveFlagsForPreset(
  presetName: string,
  flagOverrides?: Record<string, FlagDefinition>,
): Record<string, FlagDefinition> {
  if (flagOverrides) return flagOverrides;
  const presetDef = getBuiltinPresetDefinition(presetName);
  return presetDef?.flags ?? getPreset(DEFAULT_PRESET as PresetName);
}

export async function createProjectStructure(
  configDir: string,
  agents: string[],
  presetName: string,
  versionPin: boolean,
  flagOverrides?: Record<string, FlagDefinition>,
): Promise<void> {
  await ensureProjectDirs(configDir);
  await persistManifest(configDir, { agents, versionPin });
  await persistFlags(configDir, resolveFlagsForPreset(presetName, flagOverrides));

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
 * Records the freshly-installed preset artifacts into state for drift detection.
 *
 * Reads each scaffolded file from disk, hashes it, and writes the per-artifact
 * record under the given preset name. Best-effort — missing files are skipped
 * silently because scaffolding may have failed for individual artifacts; the
 * caller has already logged those.
 */
export async function recordPresetArtifactStates(
  configDir: string,
  projectRoot: string,
  artifactPresetName: string,
  ruleTemplates: string[],
  skillTemplates: string[],
  agentTemplates: string[],
): Promise<void> {
  const stateManager = new StateManager(configDir, projectRoot);
  const now = new Date().toISOString();
  const artifactStates: ArtifactFileState[] = [];

  const sources: Array<{ names: string[]; toPath: (n: string) => string }> = [
    { names: ruleTemplates, toPath: (n) => path.join(configDir, "rules", `${n}.md`) },
    { names: skillTemplates, toPath: (n) => path.join(configDir, "skills", n, "SKILL.md") },
    { names: agentTemplates, toPath: (n) => path.join(configDir, "agents", `${n}.md`) },
  ];

  for (const { names, toPath } of sources) {
    for (const name of names) {
      const filePath = toPath(name);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        artifactStates.push({
          path: path.relative(projectRoot, filePath),
          hash: hashContent(content),
          preset: artifactPresetName,
          timestamp: now,
        });
      } catch {
        /* file may not exist if scaffolding failed */
      }
    }
  }

  if (artifactStates.length > 0) {
    await stateManager.updatePresetArtifacts(artifactStates);
  }
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

/**
 * Merge a `promptToolingDefaults` result into the resolved flags map so the
 * generator + renderer see the user's wizard picks. Mutates `flags` in place.
 * No-op when the user picked Skip (caller checks `tooling.skipped` separately).
 */
export function applyToolingPicks(flags: ResolvedFlags, tooling: ToolingPromptResult): void {
  if (tooling.skipped) return;
  const a = tooling.accepted;
  flags["python_type_checker"] = {
    ...flags["python_type_checker"]!,
    value: a.python_type_checker,
  };
  flags["js_format_lint"] = {
    ...flags["js_format_lint"]!,
    value: a.js_format_lint,
  };
  flags["commit_type_check"] = {
    ...flags["commit_type_check"]!,
    value: a.commit_type_check,
  };
  flags["commit_test_run"] = {
    ...flags["commit_test_run"]!,
    value: a.commit_test_run,
  };
}
