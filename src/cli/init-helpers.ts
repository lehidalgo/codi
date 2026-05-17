import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { FlagDefinition, ResolvedFlags } from "../types/flags.js";
import type { ArtifactType } from "../core/artifact-types.js";
import { ARTIFACT_LAYOUT, artifactRelativePath } from "../core/artifact-types.js";
import type { ToolingPromptResult } from "./wizard-summary.js";
import {
  DEFAULT_PRESET,
  FLAGS_FILENAME,
  MANAGED_BY_FRAMEWORK,
  MANIFEST_FILENAME,
  type ManagedBy,
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

  // Map selection-key (camelCase, ArtifactSelections shape) → ArtifactType
  // (kebab-case taxonomy). The canonical layout (file vs directory, ext,
  // index filename) flows from `ARTIFACT_LAYOUT`. Note: the previous inline
  // implementation hardcoded `.md` for `mcpServers`, which was wrong —
  // mcp-server files are `.yaml`. Using `artifactRelativePath` fixes the
  // stale extension implicitly.
  const checks: Array<{ selKey: keyof ArtifactSelections; type: ArtifactType }> = [
    { selKey: "rules", type: "rule" },
    { selKey: "agents", type: "agent" },
    { selKey: "mcpServers", type: "mcp-server" },
    { selKey: "skills", type: "skill" },
  ];

  for (const { selKey, type } of checks) {
    const layout = ARTIFACT_LAYOUT[type];
    const newSet = new Set(next[selKey]);
    for (const name of previous[selKey]) {
      if (newSet.has(name)) continue;

      const filePath = path.join(configDir, artifactRelativePath(type, name));

      try {
        const content = await fs.readFile(filePath, "utf8");
        const { data } = parseFrontmatter<Record<string, unknown>>(content);
        if (data["managed_by"] === "user") continue;

        if (layout.kind === "directory") {
          await fs.rm(path.join(configDir, layout.dirName, name), {
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
    type: ArtifactType;
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
    type: ArtifactType;
    content: string;
    managedBy: ManagedBy;
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
          managedBy: MANAGED_BY_FRAMEWORK,
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

import { openBackup } from "../core/backup/backup-manager.js";
import type { BackupHandle, BackupTrigger } from "../core/backup/types.js";
import { Logger } from "../core/output/logger.js";
import { RETENTION_CANCELLED_ERROR } from "../constants.js";
import {
  connectGithubRepo,
  connectLocalDirectory,
  connectZipFile,
} from "../core/external-source/connectors.js";
import { runArtifactSelectionFromSource } from "./init-wizard-modify-add.js";

/**
 * Connects to the user's import source and routes through the artifact
 * selection UI. Used as a fallback when the regular preset-style installer
 * fails because the source carries no preset.yaml. Always cleans up the
 * temp source on exit so callers do not have to.
 */
export async function runArtifactSelectionFallback(
  configDir: string,
  kind: "zip" | "github" | "local",
  importSource: string,
): Promise<void> {
  const log = Logger.getInstance();
  try {
    let source;
    if (kind === "zip") {
      source = await connectZipFile(importSource);
    } else if (kind === "github") {
      source = await connectGithubRepo(importSource);
    } else {
      source = await connectLocalDirectory(importSource);
    }
    try {
      await runArtifactSelectionFromSource(configDir, source);
    } finally {
      await source.cleanup();
    }
  } catch (cause) {
    log.warn(
      `Artifact-selection fallback failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

export interface SetupBackupResult {
  handle: BackupHandle | null;
  /** True when the user cancelled retention eviction - caller MUST abort. */
  cancelled: boolean;
}

export async function setupBackupForInit(
  projectRoot: string,
  configDir: string,
  trigger: BackupTrigger,
  isFirstTime: boolean,
): Promise<SetupBackupResult> {
  const log = Logger.getInstance();
  const r = await openBackup(projectRoot, configDir, {
    trigger,
    includeSource: !isFirstTime,
    includeOutput: true,
    includePreExisting: isFirstTime,
  });
  if (r.ok) {
    return { handle: r.data, cancelled: false };
  }
  if (r.errors === "retention-cancelled") {
    log.error(RETENTION_CANCELLED_ERROR);
    return { handle: null, cancelled: true };
  }
  return { handle: null, cancelled: false };
}

import { applyConfiguration } from "../core/generator/apply.js";
import type { NormalizedConfig } from "../types/config.js";
import { PROJECT_CLI } from "../constants.js";
import { parseFrontmatter } from "../utils/frontmatter.js";
export interface ApplyWithBackupOutcome {
  generated: boolean;
  cancelled: boolean;
  backupTimestamp?: string;
}

/**
 * Wraps applyConfiguration with the openBackup -> finalise/abort lifecycle.
 * Returns `cancelled: true` when retention TUI was cancelled - caller MUST
 * abort the destructive operation and surface E_BACKUP_CANCELLED to the user.
 */
export async function applyConfigurationWithBackup(
  projectRoot: string,
  configDir: string,
  config: NormalizedConfig,
  applyOptions: Parameters<typeof applyConfiguration>[2],
  isUpdate: boolean,
): Promise<ApplyWithBackupOutcome> {
  const log = Logger.getInstance();
  const trigger: BackupTrigger = isUpdate ? "init-customize" : "init-first-time";
  const { handle, cancelled } = await setupBackupForInit(
    projectRoot,
    configDir,
    trigger,
    !isUpdate,
  );
  if (cancelled) return { generated: false, cancelled: true };
  try {
    const r = await applyConfiguration(config, projectRoot, applyOptions, handle ?? undefined);
    if (r.ok) {
      const { reconciliation } = r.data;
      if (reconciliation.pruned.length > 0) {
        log.info(
          `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
        );
      }
      if (handle) {
        await handle.finalise();
        return { generated: true, cancelled: false, backupTimestamp: handle.timestamp };
      }
      return { generated: true, cancelled: false };
    }
    if (handle) await handle.abort();
    log.warn(`Generation after init failed; you can run \`${PROJECT_CLI} generate\` later.`);
    return { generated: false, cancelled: false };
  } catch (cause) {
    if (handle) await handle.abort();
    throw cause;
  }
}

/**
 * Final post-init smoke test: verify better-sqlite3 native binding loads.
 * If it does not, every brain operation (capture, hooks, brain-ui) will
 * fail at runtime with a node-gyp stack trace. Init succeeded structurally
 * but the install is not "completely functional" without working bindings,
 * so warn loudly with the actionable fix command.
 *
 * Non-throwing: probe failures never propagate; logged as advisory only.
 */
export async function postInitBindingsProbe(log: Logger): Promise<void> {
  try {
    const { checkNativeBindings } = await import("./doctor.js");
    const bindings = await checkNativeBindings();
    if (bindings.passed) return;
    log.warn("");
    log.warn("⚠ Init completed but native bindings probe failed:");
    for (const line of bindings.message.split("\n")) {
      log.warn(`   ${line}`);
    }
    log.warn("");
    log.warn(`Run \`${PROJECT_CLI} doctor\` to re-check after fixing.`);
  } catch (cause) {
    log.debug("Native bindings probe skipped (non-critical)", cause);
  }
}

// ─── CORE-020 — init phase helpers ───────────────────────────────────────────
//
// `initHandler` orchestrates 12 sequential phases. Before CORE-020 the body
// was a 665-LOC blob mutating 14+ shared variables. The split here threads
// state through small typed phase functions; the orchestrator (in init.ts)
// is now ~120 LOC of explicit phase calls with early-exit checks.
//
// Cross-file note: imports for the heavy phases (P4 wizard, P8 config
// apply, P10 hooks install) are co-located here next to their helper to
// keep init.ts focused on orchestration. The types InitContext / InitState
// / PhaseResult are also defined here so init.ts can import them.

import { resolveProjectDir } from "../utils/paths.js";
import { registerAllAdapters } from "../adapters/index.js";
import { detectAdapters, getAllAdapters } from "../core/generator/adapter-registry.js";
import { getPresetNames } from "../core/flags/flag-presets.js";
import {
  DEFAULT_PRESET as PHASES_DEFAULT_PRESET,
  PROJECT_DIR,
  resolveArtifactName,
} from "../constants.js";
import { getBuiltinPresetNames } from "../templates/presets/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { createRule } from "../core/scaffolder/rule-scaffolder.js";
import { createSkill } from "../core/scaffolder/skill-scaffolder.js";
import { createAgent } from "../core/scaffolder/agent-scaffolder.js";
import { createMcpServer } from "../core/scaffolder/mcp-scaffolder.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { CommandResult } from "../core/output/types.js";
import { runInitWizard } from "./init-wizard.js";
import type { ExistingInstallContext } from "./init-wizard.js";
import { createError } from "../core/output/errors.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { resolveAutoFlags } from "../core/hooks/auto-detection.js";
import { installHooks } from "../core/hooks/hook-installer.js";
import { checkHookDependencies, filterMissing } from "../core/hooks/hook-dependency-checker.js";
import { installMissingDeps } from "../core/hooks/hook-dep-installer.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { promptToolingDefaults } from "./wizard-summary.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import { buildInstalledArtifactInventory } from "./installed-artifact-inventory.js";
import type { GlobalOptions } from "./shared.js";

/**
 * `codi init` CLI options. Mirrors the flags accepted by
 * `registerInitCommand`. Lives here so phase helpers can be typed
 * without circular imports back to init.ts.
 */
export interface InitOptions extends GlobalOptions {
  force?: boolean;
  agents?: string[];
  preset?: string;
  onConflict?: "keep-current" | "keep-incoming";
  /**
   * Skip the wizard's "Modify vs Fresh" prompt and go straight to the
   * modify submenu. Only meaningful when .codi/ already exists.
   */
  customize?: boolean;
}

/** Final command-output payload — what the JSON serializer emits. */
export interface InitData {
  configDir: string;
  agents: string[];
  stack: string[];
  generated: boolean;
  preset?: string;
  rules: string[];
  hooksInstalled?: boolean;
  /** Timestamp of the pre-init backup, when one was taken. */
  backup?: string;
  /**
   * Populated when `.codi/` was scaffolded but `resolveConfig` rejected the
   * resulting state. Each entry carries the validator's error code, message,
   * and remediation hint. When non-empty, `generated` is `false` and
   * `hooksInstalled` is `false`.
   */
  validationErrors?: Array<{ code: string; message: string; hint: string }>;
}

/** Immutable inputs available to every phase. */
export interface InitContext {
  readonly projectRoot: string;
  readonly configDir: string;
  readonly options: InitOptions;
  readonly log: Logger;
}

/**
 * Accumulator state threaded through phases. Mutated in place by each
 * phase function; the orchestrator never reads/writes a field outside
 * of `buildInitData`. Optional fields stay `undefined` until the phase
 * that produces them runs.
 */
export interface InitState {
  isUpdate: boolean;
  existingSelections?: ExistingSelections;
  existingInstall?: ExistingInstallContext;
  stack: string[];
  agentIds: string[];
  presetName: string;
  artifactPresetName?: string;
  displayPresetName?: string;
  ruleTemplates: string[];
  skillTemplates: string[];
  agentTemplates: string[];
  mcpServerTemplates: string[];
  tooling: ToolingPromptResult | null;
  importRegenerated: boolean;
  generated: boolean;
  validationErrors?: InitData["validationErrors"];
  backupTimestamp?: string;
  hooksInstalled: boolean;
  hookFiles: string[];
}

/**
 * Discriminated union for phases that can short-circuit init with a
 * concrete CommandResult (wizard cancelled, unknown preset, backup
 * cancelled). `ok: true` carries no value — phases mutate `InitState`
 * directly to keep the orchestrator readable.
 */
export type PhaseResult =
  | { ok: true }
  | { ok: false; earlyExit: CommandResult<InitData> };

export function isInteractiveInit(options: InitOptions): boolean {
  return !options.json && !options.quiet && !options.agents;
}

export function hasArtifactSelections(selections: ExistingSelections): boolean {
  return (
    selections.rules.length > 0 ||
    selections.skills.length > 0 ||
    selections.agents.length > 0 ||
    selections.mcpServers.length > 0
  );
}

/**
 * Build the `CommandResult<InitData>` for the success path. Centralises
 * the field plumbing so the orchestrator's final return is a one-liner.
 */
export function buildInitSuccess(state: InitState): CommandResult<InitData> {
  const data: InitData = {
    configDir: "", // overwritten below
    agents: state.agentIds,
    stack: state.stack,
    generated: state.generated,
    preset: state.displayPresetName,
    rules: state.ruleTemplates,
    hooksInstalled: state.hooksInstalled,
    ...(state.backupTimestamp ? { backup: state.backupTimestamp } : {}),
    ...(state.validationErrors && state.validationErrors.length > 0
      ? { validationErrors: state.validationErrors }
      : {}),
  };
  return createCommandResult({
    success: true,
    command: "init",
    data,
    exitCode: EXIT_CODES.SUCCESS,
  });
}

/**
 * Build the `CommandResult<InitData>` for an early-exit failure path.
 * Pre-CORE-020 this shape was duplicated three times across `initHandler`
 * with hand-written `agents/stack/preset/rules/configDir` boilerplate.
 */
export function buildInitFailure(
  ctx: InitContext,
  state: Partial<InitState>,
  errors: CommandResult<InitData>["errors"],
): CommandResult<InitData> {
  return createCommandResult({
    success: false,
    command: "init",
    data: {
      configDir: ctx.configDir,
      agents: state.agentIds ?? [],
      stack: state.stack ?? [],
      generated: false,
      preset: state.displayPresetName ?? state.presetName,
      rules: state.ruleTemplates ?? [],
      ...(state.hooksInstalled !== undefined ? { hooksInstalled: state.hooksInstalled } : {}),
    },
    errors,
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}

// ─── P1: detect existing install ─────────────────────────────────────────────
export async function detectExistingInstall(
  ctx: InitContext,
  state: InitState,
): Promise<void> {
  try {
    await fs.access(ctx.configDir);
    if (ctx.options.force) return;
    state.isUpdate = true;
    const inventory = await buildInstalledArtifactInventory(ctx.configDir);
    state.existingSelections = inventory.selections;
    if (!hasArtifactSelections(state.existingSelections)) {
      const ledger = new OperationsLedgerManager(ctx.configDir);
      const ledgerResult = await ledger.read();
      const activePreset = ledgerResult.ok ? ledgerResult.data.activePreset : null;
      if (activePreset?.artifactSelection) {
        state.existingSelections = {
          preset: activePreset.name,
          rules: activePreset.artifactSelection.rules,
          skills: activePreset.artifactSelection.skills,
          agents: activePreset.artifactSelection.agents,
          mcpServers: activePreset.artifactSelection.mcpServers ?? [],
        };
      }
    }
    state.existingInstall = {
      selections: state.existingSelections,
      inventory: inventory.entries,
    };
  } catch {
    // Directory does not exist — fresh install. isUpdate stays false.
  }
}

// ─── P2: detect stack + register adapters ────────────────────────────────────
export async function detectStackAndAdapters(
  ctx: InitContext,
  state: InitState,
): Promise<void> {
  state.stack = await detectStack(ctx.projectRoot);
  if (!isInteractiveInit(ctx.options)) {
    ctx.log.info(`Detected stack: ${state.stack.length > 0 ? state.stack.join(", ") : "none"}`);
  }
  registerAllAdapters();
}

// ─── P3: initial preset defaults ─────────────────────────────────────────────
export function initialPresetState(state: InitState, options: InitOptions): void {
  const rawPreset = options.preset as string | undefined;
  const resolved =
    (rawPreset
      ? (resolveArtifactName(rawPreset, getPresetNames() as string[]) ?? rawPreset)
      : undefined) ?? PHASES_DEFAULT_PRESET;
  state.presetName = resolved;
  state.displayPresetName = resolved;
}

// ─── P4: interactive intake (wizard branch) ──────────────────────────────────
export async function runInteractiveIntake(
  ctx: InitContext,
  state: InitState,
): Promise<PhaseResult> {
  const detectedAdapters = await detectAdapters(ctx.projectRoot);
  const detectedAgentIds = detectedAdapters.map((a) => a.id);
  const allAgentIds = getAllAdapters().map((a) => a.id);

  const wizardResult = await runInitWizard(
    state.stack,
    detectedAgentIds,
    allAgentIds,
    state.existingInstall,
    { forceModify: ctx.options.customize === true && state.existingInstall !== undefined },
  );
  if (!wizardResult) {
    return {
      ok: false,
      earlyExit: buildInitFailure(ctx, state, [
        {
          code: "E_CONFIG_INVALID",
          message: "Setup cancelled.",
          hint: "",
          severity: "error",
          context: {},
        },
      ]),
    };
  }

  state.agentIds = wizardResult.agents;
  // Artifact preset: only set when a named preset was selected (not custom).
  state.artifactPresetName = wizardResult.preset;
  // Flag preset: used for flags.yaml configuration.
  state.presetName =
    wizardResult.selectedPresetName ??
    wizardResult.flagPreset ??
    wizardResult.preset ??
    state.presetName;
  state.displayPresetName =
    wizardResult.saveAsPreset ??
    wizardResult.selectedPresetName ??
    state.artifactPresetName ??
    (wizardResult.configMode === "custom" ? "custom" : undefined);
  // Use wizard language selection for hooks (overrides auto-detection).
  state.stack = wizardResult.languages;

  // Tooling defaults summary — single shot after language selection.
  try {
    state.tooling = await promptToolingDefaults(ctx.projectRoot);
  } catch {
    // Non-interactive environment or prompt cancelled — fall back to auto.
    state.tooling = null;
  }

  const isImportMode =
    wizardResult.configMode === "zip" ||
    wizardResult.configMode === "github" ||
    wizardResult.configMode === "local";
  if (!isImportMode) {
    // Preset or custom: wizard always returns the full artifact selections.
    state.ruleTemplates = wizardResult.rules;
    state.skillTemplates = wizardResult.skills;
    state.agentTemplates = wizardResult.agentTemplates;
    state.mcpServerTemplates = wizardResult.mcpServers;
  }

  if (state.isUpdate) {
    await ensureProjectDirs(ctx.configDir);
    await persistManifest(ctx.configDir, {
      agents: state.agentIds,
      versionPin: wizardResult.versionPin,
    });
    await persistFlags(ctx.configDir, resolveFlagsForPreset(state.presetName, wizardResult.flags));
  } else {
    await createProjectStructure(
      ctx.configDir,
      state.agentIds,
      state.presetName,
      wizardResult.versionPin,
      wizardResult.flags,
    );
  }

  if (wizardResult.gitHooks || wizardResult.runtimeHooks) {
    const { StateManager: SM } = await import("../core/config/state.js");
    const stateManager = new SM(ctx.configDir, ctx.projectRoot);
    const selection: { git?: string[]; runtime?: string[] } = {};
    if (wizardResult.gitHooks) selection.git = wizardResult.gitHooks;
    if (wizardResult.runtimeHooks) selection.runtime = wizardResult.runtimeHooks;
    await stateManager.updateSelectedHooks(selection);
  }

  // Handle import sources (ZIP / GitHub / local). presetInstallUnifiedHandler
  // calls regenerateConfigs internally, so we track success to skip the
  // duplicate generate() call later via importRegenerated.
  if (wizardResult.importSource) {
    if (wizardResult.configMode === "local") {
      ctx.log.info("Importing artifacts from local directory...");
      await runArtifactSelectionFallback(ctx.configDir, "local", wizardResult.importSource);
      state.importRegenerated = true;
    } else {
      const { presetInstallUnifiedHandler } = await import("./preset-handlers.js");
      const installResult = await presetInstallUnifiedHandler(
        ctx.projectRoot,
        wizardResult.importSource,
      );
      if (!installResult.success) {
        ctx.log.warn(
          `Preset import failed: ${installResult.errors[0]?.message ?? "unknown error"}`,
        );
        if (wizardResult.configMode === "zip" || wizardResult.configMode === "github") {
          ctx.log.info("Trying artifact-selection fallback (source has no preset.yaml)...");
          await runArtifactSelectionFallback(
            ctx.configDir,
            wizardResult.configMode,
            wizardResult.importSource,
          );
          state.importRegenerated = true;
        }
      } else {
        state.importRegenerated = true;
        if (installResult.data?.name) {
          state.presetName = installResult.data.name;
          state.displayPresetName = installResult.data.name;
        }
      }
    }
  }

  // Save custom selection as preset if requested.
  if (wizardResult.saveAsPreset) {
    const presetDir = path.join(ctx.configDir, "presets", wizardResult.saveAsPreset);
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, "preset.yaml"),
      stringifyYaml({
        name: wizardResult.saveAsPreset,
        version: "1.0.0",
        artifacts: {
          rules: wizardResult.rules,
          skills: wizardResult.skills,
          agents: wizardResult.agentTemplates,
          mcpServers: wizardResult.mcpServers,
        },
      }),
      "utf8",
    );
    ctx.log.info(`Saved custom selection as preset "${wizardResult.saveAsPreset}"`);
  }

  return { ok: true };
}

// ─── P5: non-interactive intake ──────────────────────────────────────────────
export async function runNonInteractiveIntake(
  ctx: InitContext,
  state: InitState,
): Promise<PhaseResult> {
  const knownPresets = getBuiltinPresetNames();
  if (!knownPresets.includes(state.presetName)) {
    return {
      ok: false,
      earlyExit: buildInitFailure(ctx, state, [
        {
          code: "E_CONFIG_INVALID",
          message: `Unknown preset: "${state.presetName}". Known: ${knownPresets.join(", ")}`,
          hint: `Available presets: ${knownPresets.join(", ")}`,
          severity: "error",
          context: { unknownPreset: state.presetName },
        },
      ]),
    };
  }

  if (ctx.options.agents && ctx.options.agents.length > 0) {
    const knownIds = new Set(getAllAdapters().map((a) => a.id));
    // Accept both `--agents a b c` (variadic) and `--agents a,b,c`
    // (comma-separated). Adapter IDs are kebab-case so a comma is
    // unambiguous as a delimiter; users coming from CLIs that take
    // comma-separated lists get the friendly behaviour. See ISSUE-003.
    const hadCommaInput = ctx.options.agents.some((a) => a.includes(","));
    const normalized = ctx.options.agents
      .flatMap((a) => a.split(","))
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    const unknownAgents = normalized.filter((id) => !knownIds.has(id));
    if (unknownAgents.length > 0) {
      const quotedUnknown = unknownAgents.map((a) => `"${a}"`).join(", ");
      const syntaxHint = hadCommaInput
        ? " (Both space-separated `--agents a b c` and comma-separated `--agents a,b,c` are accepted.)"
        : "";
      return {
        ok: false,
        earlyExit: buildInitFailure(ctx, state, [
          {
            code: "E_CONFIG_INVALID",
            message: `Unknown agent(s): ${quotedUnknown}. Known: ${[...knownIds].join(", ")}.`,
            hint: `Available agents: ${[...knownIds].join(", ")}.${syntaxHint}`,
            severity: "error",
            context: { unknownAgents },
          },
        ]),
      };
    }
    state.agentIds = normalized;
  } else {
    const detectedAdapters = await detectAdapters(ctx.projectRoot);
    state.agentIds = detectedAdapters.map((a) => a.id);
  }

  ctx.log.info(`Using agents: ${state.agentIds.join(", ")}`);
  // Non-interactive always uses a named artifact preset.
  state.artifactPresetName = state.presetName;
  if (state.isUpdate) {
    await ensureProjectDirs(ctx.configDir);
    await persistManifest(ctx.configDir, { agents: state.agentIds });
    await persistFlags(ctx.configDir, resolveFlagsForPreset(state.presetName));
  } else {
    await createProjectStructure(ctx.configDir, state.agentIds, state.presetName, false);
  }

  const presetDef = getBuiltinPresetDefinition(state.presetName);
  if (presetDef) {
    state.ruleTemplates = [...presetDef.rules];
    state.skillTemplates = [...presetDef.skills];
    state.agentTemplates = [...presetDef.agents];
  }
  return { ok: true };
}

// ─── P6: scaffold artifacts (additive over existing selections) ──────────────
export async function scaffoldArtifacts(
  ctx: InitContext,
  state: InitState,
): Promise<void> {
  const forceArtifacts = ctx.options.force || ctx.options.onConflict === "keep-incoming";
  const subtract = (next: string[], prev: string[] | undefined): string[] =>
    prev && prev.length > 0 ? next.filter((n) => !prev.includes(n)) : next;
  const additiveRules = forceArtifacts
    ? state.ruleTemplates
    : subtract(state.ruleTemplates, state.existingSelections?.rules);
  const additiveSkills = forceArtifacts
    ? state.skillTemplates
    : subtract(state.skillTemplates, state.existingSelections?.skills);
  const additiveAgents = forceArtifacts
    ? state.agentTemplates
    : subtract(state.agentTemplates, state.existingSelections?.agents);
  const additiveMcps = forceArtifacts
    ? state.mcpServerTemplates
    : subtract(state.mcpServerTemplates, state.existingSelections?.mcpServers);

  for (const template of additiveRules) {
    const r = await createRule({ name: template, configDir: ctx.configDir, template, force: forceArtifacts });
    if (!r.ok) {
      ctx.log.warn(`Failed to create rule "${template}": ${r.errors[0]?.message ?? "unknown error"}`);
    }
  }
  const projectName = path.basename(ctx.projectRoot);
  for (const template of additiveSkills) {
    const r = await createSkill({
      name: template,
      configDir: ctx.configDir,
      template,
      copyrightHolder: projectName,
      force: forceArtifacts,
    });
    if (!r.ok) {
      ctx.log.warn(`Failed to create skill "${template}": ${r.errors[0]?.message ?? "unknown error"}`);
    }
  }
  for (const template of additiveAgents) {
    const r = await createAgent({ name: template, configDir: ctx.configDir, template, force: forceArtifacts });
    if (!r.ok) {
      ctx.log.warn(`Failed to create agent "${template}": ${r.errors[0]?.message ?? "unknown error"}`);
    }
  }
  for (const template of additiveMcps) {
    const r = await createMcpServer({ name: template, configDir: ctx.configDir, template, force: forceArtifacts });
    if (!r.ok) {
      ctx.log.warn(`Failed to create MCP server "${template}": ${r.errors[0]?.message ?? "unknown error"}`);
    }
  }
}

// ─── P7: record preset state + sync manifest + lock file ─────────────────────
export async function syncPresetAndManifest(
  ctx: InitContext,
  state: InitState,
): Promise<void> {
  if (state.artifactPresetName) {
    try {
      await recordPresetArtifactStates(
        ctx.configDir,
        ctx.projectRoot,
        state.artifactPresetName,
        state.ruleTemplates,
        state.skillTemplates,
        state.agentTemplates,
      );
    } catch {
      ctx.log.warn("Preset artifact state tracking failed; this is non-critical.");
    }
  }

  await syncManifestOnInit(
    ctx.configDir,
    state.ruleTemplates,
    state.skillTemplates,
    state.agentTemplates,
    state.mcpServerTemplates,
    state.isUpdate ? state.existingSelections : undefined,
  ).catch(() => ctx.log.warn("Artifact manifest sync failed; this is non-critical."));

  if (state.artifactPresetName) {
    await recordPresetLock(
      ctx.configDir,
      state.artifactPresetName,
      state.displayPresetName ?? state.artifactPresetName,
    ).catch(() => ctx.log.warn("Failed to write preset lock file; this is non-critical."));
  }
}

// ─── P8: validate + apply configuration with optional backup ─────────────────
export interface ConfigApplyOutput {
  configResult: Awaited<ReturnType<typeof resolveConfig>>;
}

export async function applyConfigAndBackup(
  ctx: InitContext,
  state: InitState,
): Promise<{ phase: PhaseResult; output: ConfigApplyOutput }> {
  state.generated = state.importRegenerated;
  const configResult = await resolveConfig(ctx.projectRoot);
  if (!configResult.ok) {
    state.validationErrors = configResult.errors.map((e) => ({
      code: e.code,
      message: e.message,
      hint: e.hint,
    }));
    ctx.log.error(
      `Configuration validation failed; ${PROJECT_CLI} cannot generate agent files until the listed errors are fixed.`,
    );
    for (const e of configResult.errors) {
      ctx.log.error(`  ${e.code}: ${e.message}`);
      if (e.hint && e.hint !== e.message) ctx.log.info(`    -> ${e.hint}`);
    }
    ctx.log.info(
      `Fix the listed errors, then run \`${PROJECT_CLI} generate\` to finish initialization.`,
    );
    return { phase: { ok: true }, output: { configResult } };
  }
  if (state.importRegenerated) {
    return { phase: { ok: true }, output: { configResult } };
  }
  const outcome = await applyConfigurationWithBackup(
    ctx.projectRoot,
    ctx.configDir,
    configResult.data,
    {
      force: ctx.options.force || ctx.options.onConflict === "keep-incoming",
      keepCurrent: ctx.options.onConflict === "keep-current",
      forceDeleteDriftedOrphans: ctx.options.force || ctx.options.onConflict === "keep-incoming",
    },
    state.isUpdate,
  );
  if (outcome.cancelled) {
    return {
      phase: {
        ok: false,
        earlyExit: buildInitFailure(ctx, state, [
          createError("E_BACKUP_CANCELLED", { message: RETENTION_CANCELLED_ERROR }),
        ]),
      },
      output: { configResult },
    };
  }
  state.generated = outcome.generated;
  state.backupTimestamp = outcome.backupTimestamp;
  return { phase: { ok: true }, output: { configResult } };
}

// ─── P9: docs stamp when require_documentation is enabled ────────────────────
export async function ensureDocsStampIfEnabled(
  ctx: InitContext,
  configResult: ConfigApplyOutput["configResult"],
): Promise<void> {
  if (!configResult.ok) return;
  const requireDoc = configResult.data.flags["require_documentation"];
  const docCheckEnabled = requireDoc?.mode !== "disabled" && requireDoc?.value === true;
  if (!docCheckEnabled) return;
  try {
    const { ensureDocProjectDir, writeStamp } = await import("../core/docs/doc-stamp.js");
    await ensureDocProjectDir(ctx.projectRoot);
    const stampPath = `docs/project/.doc-stamp`;
    const stampExists = await fs
      .access(`${ctx.projectRoot}/${stampPath}`)
      .then(() => true)
      .catch(() => false);
    if (!stampExists) {
      await writeStamp(ctx.projectRoot, "human");
      ctx.log.info(`Documentation checkpoint initialised: ${stampPath}`);
    }
  } catch {
    ctx.log.warn("Documentation directory setup skipped (not a git repository?).");
  }
}

// ─── P10: install pre-commit hooks ───────────────────────────────────────────
export async function installPreCommitHooks(
  ctx: InitContext,
  state: InitState,
  configResult: ConfigApplyOutput["configResult"],
): Promise<void> {
  if (!configResult.ok) return;
  try {
    const hookSetup = await detectHookSetup(ctx.projectRoot);
    const resolvedFlags = configResult.data.flags;
    if (state.tooling) applyToolingPicks(resolvedFlags, state.tooling);
    if (state.tooling?.skipped) {
      ctx.log.info("Skipped pre-commit hook installation per user request");
    }
    const flagsForHooks = await resolveAutoFlags(ctx.projectRoot, resolvedFlags);
    const hooksConfig = generateHooksConfig(flagsForHooks, state.stack);
    if (state.tooling?.skipped) return;
    if (hooksConfig.hooks.length === 0 && !hooksConfig.docCheck) return;

    const hookResult = await installHooks({
      projectRoot: ctx.projectRoot,
      runner: hookSetup.runner,
      hooks: hooksConfig.hooks,
      flags: resolvedFlags,
      commitMsgValidation: hooksConfig.commitMsgValidation,
      secretScan: hooksConfig.secretScan,
      fileSizeCheck: hooksConfig.fileSizeCheck,
      versionCheck: hooksConfig.versionCheck,
      templateWiringCheck: hooksConfig.templateWiringCheck,
      docNamingCheck: hooksConfig.docNamingCheck,
      versionBump: hooksConfig.versionBump,
      versionVerify: hooksConfig.versionVerify,
      artifactValidation: hooksConfig.artifactValidation,
      importDepthCheck: hooksConfig.importDepthCheck,
      skillYamlValidation: hooksConfig.skillYamlValidation,
      skillResourceCheck: hooksConfig.skillResourceCheck,
      skillPathWrapCheck: hooksConfig.skillPathWrapCheck,
      stagedJunkCheck: hooksConfig.stagedJunkCheck,
      conflictMarkerCheck: hooksConfig.conflictMarkerCheck,
      brandSkillValidation: hooksConfig.brandSkillValidation,
      docCheck: hooksConfig.docCheck,
      docProtectedBranches: hooksConfig.docProtectedBranches,
    });
    state.hooksInstalled = hookResult.ok;
    if (hookResult.ok) {
      state.hookFiles = hookResult.data.files;
      ctx.log.info(
        `Pre-commit hooks installed (${hookSetup.runner === "none" ? "standalone" : hookSetup.runner})`,
      );
      const missingDeps = filterMissing(
        await checkHookDependencies(hooksConfig.hooks, ctx.projectRoot),
      );
      if (missingDeps.length > 0) {
        await installMissingDeps(missingDeps, ctx.projectRoot, ctx.log, isInteractiveInit(ctx.options));
      }
    } else {
      ctx.log.warn("Hook installation failed; you can set up hooks manually.");
    }
  } catch {
    ctx.log.warn("Hook detection failed; skipping hook installation.");
  }
}

// ─── P11: inject code-driven documentation sections ──────────────────────────
export async function injectDocsSections(ctx: InitContext): Promise<void> {
  try {
    const { injectSections } = await import("../core/docs/docs-generator.js");
    const result = await injectSections(ctx.projectRoot);
    if (result.ok && result.data.updated.length > 0) {
      ctx.log.info(`Documentation sections updated: ${result.data.updated.join(", ")}`);
    }
  } catch {
    ctx.log.warn("Documentation section generation skipped.");
  }
}

// ─── P12: write operations ledger ────────────────────────────────────────────
export async function writeOperationsLedger(
  ctx: InitContext,
  state: InitState,
): Promise<void> {
  try {
    const ledger = new OperationsLedgerManager(ctx.configDir);
    const now = new Date().toISOString();
    await ledger.setInitialization({
      timestamp: now,
      preset: state.displayPresetName ?? state.presetName,
      agents: state.agentIds,
      stack: state.stack,
      codiVersion: VERSION,
    });
    const hasAnyArtifact =
      state.ruleTemplates.length > 0 ||
      state.skillTemplates.length > 0 ||
      state.agentTemplates.length > 0 ||
      state.mcpServerTemplates.length > 0;
    if (hasAnyArtifact) {
      await ledger.setActivePreset({
        name: state.displayPresetName ?? state.presetName,
        installedAt: now,
        artifactSelection: {
          rules: state.ruleTemplates,
          skills: state.skillTemplates,
          agents: state.agentTemplates,
          mcpServers: state.mcpServerTemplates,
        },
      });
    }
    await ledger.addConfigFiles([
      { path: `${PROJECT_DIR}/${MANIFEST_FILENAME}`, type: "manifest", createdAt: now },
      { path: `${PROJECT_DIR}/flags.yaml`, type: "flags", createdAt: now },
      { path: `${PROJECT_DIR}/operations.json`, type: "ledger", createdAt: now },
    ]);
    if (state.hookFiles.length > 0) {
      const hookSetup = await detectHookSetup(ctx.projectRoot);
      await ledger.addHookFiles(
        state.hookFiles.map((f) => ({
          path: f,
          framework:
            hookSetup.runner === "none"
              ? ("standalone" as const)
              : (hookSetup.runner as "husky" | "pre-commit" | "lefthook"),
          type: inferHookType(f),
          createdAt: now,
        })),
      );
    }
  } catch {
    ctx.log.warn("Operations ledger write failed; this is non-critical.");
  }
}

/** Initial empty state — every field starts at its zero value. */
export function createInitState(): InitState {
  return {
    isUpdate: false,
    stack: [],
    agentIds: [],
    presetName: PHASES_DEFAULT_PRESET,
    ruleTemplates: [],
    skillTemplates: [],
    agentTemplates: [],
    mcpServerTemplates: [],
    tooling: null,
    importRegenerated: false,
    generated: false,
    hooksInstalled: false,
    hookFiles: [],
  };
}

/** Build the InitContext from raw inputs. */
export function createInitContext(projectRoot: string, options: InitOptions): InitContext {
  return {
    projectRoot,
    configDir: resolveProjectDir(projectRoot),
    options,
    log: Logger.getInstance(),
  };
}

/**
 * Helper used by the orchestrator to attach `configDir` to the success
 * payload. Kept here so init.ts has zero data-shaping logic.
 */
export function withConfigDir(
  result: CommandResult<InitData>,
  configDir: string,
): CommandResult<InitData> {
  return { ...result, data: { ...result.data, configDir } };
}
