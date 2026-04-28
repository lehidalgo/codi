import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectDir } from "../utils/paths.js";
import { registerAllAdapters } from "../adapters/index.js";
import { detectAdapters, getAllAdapters } from "../core/generator/adapter-registry.js";
import { getPresetNames } from "../core/flags/flag-presets.js";
import {
  DEFAULT_PRESET,
  MANIFEST_FILENAME,
  PROJECT_CLI,
  PROJECT_DIR,
  resolveArtifactName,
} from "../constants.js";
import { getBuiltinPresetDefinition, getBuiltinPresetNames } from "../templates/presets/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { applyConfiguration } from "../core/generator/apply.js";
import { createRule } from "../core/scaffolder/rule-scaffolder.js";
import { createSkill } from "../core/scaffolder/skill-scaffolder.js";
import { createAgent } from "../core/scaffolder/agent-scaffolder.js";
import { createMcpServer } from "../core/scaffolder/mcp-scaffolder.js";
// Preset artifact lookup moved to init-wizard.ts
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { runInitWizard } from "./init-wizard.js";
import type { ExistingSelections } from "./init-wizard.js";
import type { ExistingInstallContext } from "./init-wizard.js";
import { initFromOptions, handleOutput } from "./shared.js";
import {
  inferHookType,
  createProjectStructure,
  ensureProjectDirs,
  persistFlags,
  persistManifest,
  recordPresetArtifactStates,
  resolveFlagsForPreset,
  syncManifestOnInit,
  recordPresetLock,
  applyToolingPicks,
} from "./init-helpers.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { installHooks } from "../core/hooks/hook-installer.js";
import { checkHookDependencies, filterMissing } from "../core/hooks/hook-dependency-checker.js";
import { installMissingDeps } from "../core/hooks/hook-dep-installer.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { promptToolingDefaults, type ToolingPromptResult } from "./wizard-summary.js";
import type { GlobalOptions } from "./shared.js";
import { VERSION } from "../index.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import { buildInstalledArtifactInventory } from "./installed-artifact-inventory.js";
import { runArtifactSelectionFromSource } from "./init-wizard-modify-add.js";
import {
  connectGithubRepo,
  connectLocalDirectory,
  connectZipFile,
} from "../core/external-source/connectors.js";
// HookInstallResult used indirectly via hookResult.data.files

interface InitOptions extends GlobalOptions {
  force?: boolean;
  agents?: string[];
  preset?: string;
  onConflict?: "keep-current" | "keep-incoming";
  /**
   * Skip the wizard's "Modify vs Fresh" prompt and go straight to the modify
   * submenu. Only meaningful when .codi/ already exists. Set by the hub's
   * "Customize codi setup" entry. Has no effect on a fresh install.
   */
  customize?: boolean;
}

interface InitData {
  configDir: string;
  agents: string[];
  stack: string[];
  generated: boolean;
  preset?: string;
  rules: string[];
}

function isInteractive(options: InitOptions): boolean {
  return !options.json && !options.quiet && !options.agents;
}

/**
 * Connects to the user's import source and routes through the artifact
 * selection UI. Used as a fallback when the regular preset-style installer
 * fails because the source carries no preset.yaml. Always cleans up the
 * temp source on exit so callers do not have to.
 */
async function runArtifactSelectionFallback(
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

function hasSelections(selections: ExistingSelections): boolean {
  return (
    selections.rules.length > 0 ||
    selections.skills.length > 0 ||
    selections.agents.length > 0 ||
    selections.mcpServers.length > 0
  );
}

export async function initHandler(
  projectRoot: string,
  options: InitOptions,
): Promise<CommandResult<InitData>> {
  const log = Logger.getInstance();

  const configDir = resolveProjectDir(projectRoot);

  let isUpdate = false;
  let existingSelections: ExistingSelections | undefined;
  let existingInstall: ExistingInstallContext | undefined;
  try {
    await fs.access(configDir);
    if (!options.force) {
      isUpdate = true;
      const inventory = await buildInstalledArtifactInventory(configDir);
      existingSelections = inventory.selections;
      if (!hasSelections(existingSelections)) {
        const ledger = new OperationsLedgerManager(configDir);
        const ledgerResult = await ledger.read();
        const activePreset = ledgerResult.ok ? ledgerResult.data.activePreset : null;
        if (activePreset?.artifactSelection) {
          existingSelections = {
            preset: activePreset.name,
            rules: activePreset.artifactSelection.rules,
            skills: activePreset.artifactSelection.skills,
            agents: activePreset.artifactSelection.agents,
            mcpServers: activePreset.artifactSelection.mcpServers ?? [],
          };
        }
      }
      existingInstall = {
        selections: existingSelections,
        inventory: inventory.entries,
      };
    }
  } catch {
    // Directory does not exist, proceed as fresh install
  }

  let stack = await detectStack(projectRoot);
  if (!isInteractive(options)) {
    log.info(`Detected stack: ${stack.length > 0 ? stack.join(", ") : "none"}`);
  }

  registerAllAdapters();

  let agentIds: string[];
  let importRegenerated = false;
  const rawPreset = options.preset as string | undefined;
  let presetName: string =
    (rawPreset
      ? (resolveArtifactName(rawPreset, getPresetNames() as string[]) ?? rawPreset)
      : undefined) ?? DEFAULT_PRESET;
  /** Set only when a named artifact preset was used (undefined for custom selection). */
  let artifactPresetName: string | undefined;
  let displayPresetName: string | undefined = presetName;
  let ruleTemplates: string[] = [];
  let skillTemplates: string[] = [];
  let agentTemplates: string[] = [];
  let mcpServerTemplates: string[] = [];
  let tooling: ToolingPromptResult | null = null;

  if (isInteractive(options)) {
    const detectedAdapters = await detectAdapters(projectRoot);
    const detectedAgentIds = detectedAdapters.map((a) => a.id);
    const allAgentIds = getAllAdapters().map((a) => a.id);

    const wizardResult = await runInitWizard(
      stack,
      detectedAgentIds,
      allAgentIds,
      existingInstall,
      { forceModify: options.customize === true && existingInstall !== undefined },
    );
    if (!wizardResult) {
      return createCommandResult({
        success: false,
        command: "init",
        data: {
          configDir,
          agents: [],
          stack,
          generated: false,
          preset: DEFAULT_PRESET,
          rules: [],
        },
        errors: [
          {
            code: "E_CONFIG_INVALID",
            message: "Setup cancelled.",
            hint: "",
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    agentIds = wizardResult.agents;
    // Artifact preset: only set when a named preset was selected (not custom)
    artifactPresetName = wizardResult.preset;
    // Flag preset: used for flags.yaml configuration
    presetName =
      wizardResult.selectedPresetName ??
      wizardResult.flagPreset ??
      wizardResult.preset ??
      presetName;
    displayPresetName =
      wizardResult.saveAsPreset ??
      wizardResult.selectedPresetName ??
      artifactPresetName ??
      (wizardResult.configMode === "custom" ? "custom" : undefined);
    // Use wizard language selection for hooks (overrides auto-detection)
    stack = wizardResult.languages;

    // Tooling defaults summary screen — runs once, after language selection.
    // The user sees the auto-resolved python/js/typecheck/test picks and can
    // press Enter (accept), c (customize each), or s (skip hooks entirely).
    // The accepted picks are merged into resolvedFlags below before
    // generateHooksConfig is called, so they reach the renderer.
    try {
      tooling = await promptToolingDefaults(projectRoot);
    } catch {
      // Non-interactive environment or prompt cancelled — fall back to auto.
      tooling = null;
    }

    if (
      wizardResult.configMode === "zip" ||
      wizardResult.configMode === "github" ||
      wizardResult.configMode === "local"
    ) {
      // Import: will be handled after createProjectStructure via preset
      // install (zip / github) or directly via artifact-selection (local).
    } else {
      // Preset or custom: wizard always returns the full artifact selections
      ruleTemplates = wizardResult.rules;
      skillTemplates = wizardResult.skills;
      agentTemplates = wizardResult.agentTemplates;
      mcpServerTemplates = wizardResult.mcpServers;
    }

    if (isUpdate) {
      // Update flow: persist the wizard's collected agents, version-pin, and
      // flag selections so generate() sees them. Skips LICENSE.txt — that's a
      // one-shot bootstrap concern owned by createProjectStructure.
      await ensureProjectDirs(configDir);
      await persistManifest(configDir, {
        agents: agentIds,
        versionPin: wizardResult.versionPin,
      });
      await persistFlags(configDir, resolveFlagsForPreset(presetName, wizardResult.flags));
    } else {
      await createProjectStructure(
        configDir,
        agentIds,
        presetName,
        wizardResult.versionPin,
        wizardResult.flags,
      );
    }

    // Handle import sources (ZIP/GitHub)
    // presetInstallUnifiedHandler calls regenerateConfigs internally,
    // so we track success to skip the duplicate generate() call later.
    if (wizardResult.importSource) {
      // Local directory imports always go through artifact-selection — they
      // are user-pointed paths, not packaged presets, so the preset-style
      // installer would just fail and the fallback would run anyway. Skip
      // the round trip and call the selection workflow directly.
      if (wizardResult.configMode === "local") {
        log.info("Importing artifacts from local directory...");
        await runArtifactSelectionFallback(configDir, "local", wizardResult.importSource);
        importRegenerated = true;
      } else {
        const { presetInstallUnifiedHandler } = await import("./preset-handlers.js");
        const installResult = await presetInstallUnifiedHandler(
          projectRoot,
          wizardResult.importSource,
        );
        if (!installResult.success) {
          log.warn(`Preset import failed: ${installResult.errors[0]?.message ?? "unknown error"}`);
          // Fallback: many community sources (a GitHub repo, a ZIP of bare
          // artifact dirs) carry no preset.yaml. Re-attempt the import via the
          // artifact-selection workflow — discover candidate roots in the
          // source and let the user pick which artifacts to install.
          if (wizardResult.configMode === "zip" || wizardResult.configMode === "github") {
            log.info("Trying artifact-selection fallback (source has no preset.yaml)...");
            await runArtifactSelectionFallback(
              configDir,
              wizardResult.configMode,
              wizardResult.importSource,
            );
            importRegenerated = true;
          }
        } else {
          importRegenerated = true;
          if (installResult.data?.name) {
            presetName = installResult.data.name;
            displayPresetName = installResult.data.name;
          }
        }
      }
    }

    // Save custom selection as preset if requested
    if (wizardResult.saveAsPreset) {
      const presetDir = path.join(configDir, "presets", wizardResult.saveAsPreset);
      await fs.mkdir(presetDir, { recursive: true });
      const { stringify } = await import("yaml");
      await fs.writeFile(
        path.join(presetDir, "preset.yaml"),
        stringify({
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
      log.info(`Saved custom selection as preset "${wizardResult.saveAsPreset}"`);
    }
  } else {
    const knownPresets = getBuiltinPresetNames();
    if (!knownPresets.includes(presetName)) {
      return createCommandResult({
        success: false,
        command: "init",
        data: {
          configDir,
          agents: [],
          stack,
          generated: false,
          preset: presetName,
          rules: [],
        },
        errors: [
          {
            code: "E_CONFIG_INVALID",
            message: `Unknown preset: "${presetName}". Known: ${knownPresets.join(", ")}`,
            hint: `Available presets: ${knownPresets.join(", ")}`,
            severity: "error",
            context: { unknownPreset: presetName },
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    if (options.agents && options.agents.length > 0) {
      const knownIds = new Set(getAllAdapters().map((a) => a.id));
      const unknownAgents = options.agents.filter((id) => !knownIds.has(id));
      if (unknownAgents.length > 0) {
        return createCommandResult({
          success: false,
          command: "init",
          data: {
            configDir,
            agents: [],
            stack,
            generated: false,
            preset: presetName,
            rules: [],
          },
          errors: [
            {
              code: "E_CONFIG_INVALID",
              message: `Unknown agent(s): ${unknownAgents.join(", ")}. Known: ${[...knownIds].join(", ")}`,
              hint: `Available agents: ${[...knownIds].join(", ")}`,
              severity: "error",
              context: { unknownAgents },
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
      agentIds = options.agents;
    } else {
      const detectedAdapters = await detectAdapters(projectRoot);
      agentIds = detectedAdapters.map((a) => a.id);
    }

    log.info(`Using agents: ${agentIds.join(", ")}`);
    // Non-interactive always uses a named artifact preset
    artifactPresetName = presetName;
    if (isUpdate) {
      // Update flow (non-interactive): persist agents/preset choice so a
      // re-run with `--agents` actually changes the manifest. versionPin is
      // not exposed in non-interactive mode, so leave it untouched.
      await ensureProjectDirs(configDir);
      await persistManifest(configDir, { agents: agentIds });
      await persistFlags(configDir, resolveFlagsForPreset(presetName));
    } else {
      await createProjectStructure(configDir, agentIds, presetName, false);
    }

    const presetDef = getBuiltinPresetDefinition(presetName);
    if (presetDef) {
      ruleTemplates = [...presetDef.rules];
      skillTemplates = [...presetDef.skills];
      agentTemplates = [...presetDef.agents];
    }
  }

  const forceArtifacts = options.force || options.onConflict === "keep-incoming";

  // In update mode, only scaffold artifacts that are new in the selection.
  // Already-installed artifacts would otherwise raise noisy "already exists"
  // warnings from the scaffolders. Removals are handled by syncManifestOnInit
  // → removeDeselectedArtifacts further below.
  const subtract = (next: string[], prev: string[] | undefined): string[] =>
    prev && prev.length > 0 ? next.filter((n) => !prev.includes(n)) : next;
  const additiveRules = forceArtifacts
    ? ruleTemplates
    : subtract(ruleTemplates, existingSelections?.rules);
  const additiveSkills = forceArtifacts
    ? skillTemplates
    : subtract(skillTemplates, existingSelections?.skills);
  const additiveAgents = forceArtifacts
    ? agentTemplates
    : subtract(agentTemplates, existingSelections?.agents);
  const additiveMcps = forceArtifacts
    ? mcpServerTemplates
    : subtract(mcpServerTemplates, existingSelections?.mcpServers);

  for (const template of additiveRules) {
    const result = await createRule({
      name: template,
      configDir,
      template,
      force: forceArtifacts,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create rule "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  const projectName = path.basename(projectRoot);
  for (const template of additiveSkills) {
    const result = await createSkill({
      name: template,
      configDir,
      template,
      copyrightHolder: projectName,
      force: forceArtifacts,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create skill "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  for (const template of additiveAgents) {
    const result = await createAgent({
      name: template,
      configDir,
      template,
      force: forceArtifacts,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create agent "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  for (const template of additiveMcps) {
    const result = await createMcpServer({
      name: template,
      configDir,
      template,
      force: forceArtifacts,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create MCP server "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  // Record preset artifacts in state for drift detection (only for named artifact presets)
  if (artifactPresetName) {
    try {
      await recordPresetArtifactStates(
        configDir,
        projectRoot,
        artifactPresetName,
        ruleTemplates,
        skillTemplates,
        agentTemplates,
      );
    } catch {
      log.warn("Preset artifact state tracking failed; this is non-critical.");
    }
  }

  // Sync artifact manifest: remove deselected, record installed
  await syncManifestOnInit(
    configDir,
    ruleTemplates,
    skillTemplates,
    agentTemplates,
    mcpServerTemplates,
    isUpdate ? existingSelections : undefined,
  ).catch(() => log.warn("Artifact manifest sync failed; this is non-critical."));

  // Record installed preset in lock file (only for named artifact presets, not custom selection)
  if (artifactPresetName) {
    await recordPresetLock(
      configDir,
      artifactPresetName,
      displayPresetName ?? artifactPresetName,
    ).catch(() => log.warn("Failed to write preset lock file; this is non-critical."));
  }

  let generated = importRegenerated;
  const configResult = await resolveConfig(projectRoot);
  if (!importRegenerated && configResult.ok) {
    const applyResult = await applyConfiguration(configResult.data, projectRoot, {
      force: options.force || options.onConflict === "keep-incoming",
      keepCurrent: options.onConflict === "keep-current",
      forceDeleteDriftedOrphans: options.force || options.onConflict === "keep-incoming",
    });
    generated = applyResult.ok;
    if (applyResult.ok) {
      const { reconciliation } = applyResult.data;
      if (reconciliation.pruned.length > 0) {
        log.info(
          `Pruned ${reconciliation.pruned.length} orphaned file(s) removed from source templates`,
        );
      }
    }
    if (!applyResult.ok) {
      log.warn(`Generation after init failed; you can run \`${PROJECT_CLI} generate\` later.`);
    }
  }

  // Create docs/project/ directory and initial stamp when documentation check is enabled
  if (configResult.ok) {
    const requireDoc = configResult.data.flags["require_documentation"];
    const docCheckEnabled = requireDoc?.mode !== "disabled" && requireDoc?.value === true;
    if (docCheckEnabled) {
      try {
        const { ensureDocProjectDir, writeStamp } = await import("../core/docs/doc-stamp.js");
        await ensureDocProjectDir(projectRoot);
        const stampPath = `docs/project/.doc-stamp`;
        const fs = await import("node:fs/promises");
        const stampExists = await fs
          .access(`${projectRoot}/${stampPath}`)
          .then(() => true)
          .catch(() => false);
        if (!stampExists) {
          await writeStamp(projectRoot, "human");
          log.info(`Documentation checkpoint initialised: ${stampPath}`);
        }
      } catch {
        log.warn("Documentation directory setup skipped (not a git repository?).");
      }
    }
  }

  // Install pre-commit hooks
  let hooksInstalled = false;
  let hookFiles: string[] = [];
  if (configResult.ok) {
    try {
      const hookSetup = await detectHookSetup(projectRoot);
      const resolvedFlags = configResult.data.flags;
      // Merge the wizard's tooling-default picks into resolvedFlags so the
      // generator + renderer see the user's choices.
      if (tooling) applyToolingPicks(resolvedFlags, tooling);
      if (tooling?.skipped) {
        log.info("Skipped pre-commit hook installation per user request");
      }
      const hooksConfig = generateHooksConfig(resolvedFlags, stack);
      if (!tooling?.skipped && (hooksConfig.hooks.length > 0 || hooksConfig.docCheck)) {
        const hookResult = await installHooks({
          projectRoot,
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
          brandSkillValidation: hooksConfig.brandSkillValidation,
          docCheck: hooksConfig.docCheck,
          docProtectedBranches: hooksConfig.docProtectedBranches,
        });
        hooksInstalled = hookResult.ok;
        if (hookResult.ok) {
          hookFiles = hookResult.data.files;
          log.info(
            `Pre-commit hooks installed (${hookSetup.runner === "none" ? "standalone" : hookSetup.runner})`,
          );
          const missingDeps = filterMissing(
            await checkHookDependencies(hooksConfig.hooks, projectRoot),
          );
          if (missingDeps.length > 0) {
            await installMissingDeps(missingDeps, projectRoot, log, isInteractive(options));
          }
        } else {
          log.warn("Hook installation failed; you can set up hooks manually.");
        }
      }
    } catch {
      log.warn("Hook detection failed; skipping hook installation.");
    }
  }

  // Update code-driven documentation sections (non-critical)
  try {
    const { injectSections } = await import("../core/docs/docs-generator.js");
    const result = await injectSections(projectRoot);
    if (result.ok && result.data.updated.length > 0) {
      log.info(`Documentation sections updated: ${result.data.updated.join(", ")}`);
    }
  } catch {
    log.warn("Documentation section generation skipped.");
  }

  // Write operations ledger
  try {
    const ledger = new OperationsLedgerManager(configDir);
    const now = new Date().toISOString();
    await ledger.setInitialization({
      timestamp: now,
      preset: displayPresetName ?? presetName,
      agents: agentIds,
      stack,
      codiVersion: VERSION,
    });
    if (
      ruleTemplates.length > 0 ||
      skillTemplates.length > 0 ||
      agentTemplates.length > 0 ||
      mcpServerTemplates.length > 0
    ) {
      await ledger.setActivePreset({
        name: displayPresetName ?? presetName,
        installedAt: now,
        artifactSelection: {
          rules: ruleTemplates,
          skills: skillTemplates,
          agents: agentTemplates,
          mcpServers: mcpServerTemplates,
        },
      });
    }
    await ledger.addConfigFiles([
      {
        path: `${PROJECT_DIR}/${MANIFEST_FILENAME}`,
        type: "manifest",
        createdAt: now,
      },
      { path: `${PROJECT_DIR}/flags.yaml`, type: "flags", createdAt: now },
      {
        path: `${PROJECT_DIR}/operations.json`,
        type: "ledger",
        createdAt: now,
      },
    ]);
    if (hookFiles.length > 0) {
      const hookSetup = await detectHookSetup(projectRoot);
      await ledger.addHookFiles(
        hookFiles.map((f) => ({
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
    log.warn("Operations ledger write failed; this is non-critical.");
  }

  return createCommandResult({
    success: true,
    command: "init",
    data: {
      configDir,
      agents: agentIds,
      stack,
      generated,
      preset: displayPresetName,
      rules: ruleTemplates,
      hooksInstalled,
    },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(`Initialize a new ${PROJECT_DIR}/ configuration directory`)
    .option("--force", `Reinitialize even if ${PROJECT_DIR}/ exists`)
    .option("--agents <agents...>", "Specify agent IDs (skips wizard)")
    .option(
      "--preset <preset>",
      `Flag preset: ${getPresetNames().join(", ")} (default: ${DEFAULT_PRESET})`,
    )
    .option(
      "--on-conflict <strategy>",
      "Conflict strategy when generated files have local changes: keep-current (default) or keep-incoming",
    )
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: InitOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await initHandler(process.cwd(), options);
      handleOutput(result, options);
      if (result.success && !options.json && !options.quiet) {
        console.log(
          "\nNext step: run /codi-codebase-onboarding inside your coding agent\n" +
            "to add project-specific context to your configuration files.\n",
        );
      }
      process.exit(result.exitCode);
    });
}
