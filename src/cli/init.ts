import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { resolveProjectDir } from "../utils/paths.js";
import { registerAllAdapters } from "../adapters/index.js";
import {
  detectAdapters,
  getAllAdapters,
} from "../core/generator/adapter-registry.js";
import { getPreset, getPresetNames } from "../core/flags/flag-presets.js";
import type { PresetName } from "../core/flags/flag-presets.js";
import type { FlagDefinition } from "../types/flags.js";
import {
  DEFAULT_PRESET,
  MANIFEST_FILENAME,
  FLAGS_FILENAME,
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  resolveArtifactName,
} from "../constants.js";
import {
  getBuiltinPresetDefinition,
  getBuiltinPresetNames,
} from "../templates/presets/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { generate } from "../core/generator/generator.js";
import { createRule } from "../core/scaffolder/rule-scaffolder.js";
import { createSkill } from "../core/scaffolder/skill-scaffolder.js";
import { createAgent } from "../core/scaffolder/agent-scaffolder.js";
import { createCommand } from "../core/scaffolder/command-scaffolder.js";
import { createMcpServer } from "../core/scaffolder/mcp-scaffolder.js";
import { generateMitLicense } from "../core/scaffolder/license-generator.js";
// Preset artifact lookup moved to init-wizard.ts
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { runInitWizard } from "./init-wizard.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { detectHookSetup } from "../core/hooks/hook-detector.js";
import { generateHooksConfig } from "../core/hooks/hook-config-generator.js";
import { installHooks } from "../core/hooks/hook-installer.js";
import { checkHookDependencies } from "../core/hooks/hook-dependency-checker.js";
import { installMissingDeps } from "../core/hooks/hook-dep-installer.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { checkTemplateRegistry } from "../core/scaffolder/template-registry-check.js";
import type { GlobalOptions } from "./shared.js";
import { VERSION } from "../index.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import { StateManager } from "../core/config/state.js";
import type { ArtifactFileState } from "../core/config/state.js";
import { hashContent } from "../utils/hash.js";
// HookInstallResult used indirectly via hookResult.data.files

interface InitOptions extends GlobalOptions {
  force?: boolean;
  agents?: string[];
  preset?: string;
}

interface InitData {
  configDir: string;
  agents: string[];
  stack: string[];
  generated: boolean;
  preset: string;
  rules: string[];
}

function isInteractive(options: InitOptions): boolean {
  return !options.json && !options.quiet && !options.agents;
}

export async function initHandler(
  projectRoot: string,
  options: InitOptions,
): Promise<CommandResult<InitData>> {
  const log = Logger.getInstance();

  const registryErrors = checkTemplateRegistry();
  if (registryErrors.length > 0) {
    console.error(`\n[codi] Template registry integrity check failed:`);
    for (const e of registryErrors) console.error(`  • ${e}`);
    console.error(
      `\nThe CLI cannot run with broken templates. This is a bug — please report it.\n`,
    );
    process.exit(1);
  }

  const configDir = resolveProjectDir(projectRoot);

  try {
    await fs.access(configDir);
    if (!options.force) {
      return createCommandResult({
        success: false,
        command: "init",
        data: {
          configDir,
          agents: [],
          stack: [],
          generated: false,
          preset: DEFAULT_PRESET,
          rules: [],
        },
        errors: [
          {
            code: "E_CONFIG_INVALID",
            message: `${PROJECT_DIR}/ directory already exists. Use --force to reinitialize.`,
            hint: "Use --force to reinitialize.",
            severity: "error",
            context: { configDir },
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
  } catch {
    // Directory does not exist, proceed
  }

  let stack = await detectStack(projectRoot);
  if (!isInteractive(options)) {
    log.info(`Detected stack: ${stack.length > 0 ? stack.join(", ") : "none"}`);
  }

  registerAllAdapters();

  let agentIds: string[];
  const rawPreset = options.preset as string | undefined;
  let presetName: string =
    (rawPreset
      ? (resolveArtifactName(rawPreset, getPresetNames() as string[]) ??
        rawPreset)
      : undefined) ?? DEFAULT_PRESET;
  let displayPresetName: string = presetName;
  let ruleTemplates: string[] = [];
  let skillTemplates: string[] = [];
  let agentTemplates: string[] = [];
  let commandTemplates: string[] = [];
  let mcpServerTemplates: string[] = [];

  if (isInteractive(options)) {
    const detectedAdapters = await detectAdapters(projectRoot);
    const detectedAgentIds = detectedAdapters.map((a) => a.id);
    const allAgentIds = getAllAdapters().map((a) => a.id);

    const wizardResult = await runInitWizard(
      stack,
      detectedAgentIds,
      allAgentIds,
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
    presetName = wizardResult.preset;
    displayPresetName =
      wizardResult.saveAsPreset ??
      wizardResult.selectedPresetName ??
      presetName;
    // Use wizard language selection for hooks (overrides auto-detection)
    stack = wizardResult.languages;

    if (
      wizardResult.configMode === "zip" ||
      wizardResult.configMode === "github"
    ) {
      // Import: will be handled after createProjectStructure via preset install
    } else {
      // Preset or custom: wizard always returns the full artifact selections
      ruleTemplates = wizardResult.rules;
      skillTemplates = wizardResult.skills;
      agentTemplates = wizardResult.agentTemplates;
      commandTemplates = wizardResult.commandTemplates;
      mcpServerTemplates = wizardResult.mcpServers;
    }

    await createProjectStructure(
      configDir,
      agentIds,
      wizardResult.selectedPresetName ?? presetName,
      wizardResult.versionPin,
      wizardResult.flags,
    );

    // Handle import sources (ZIP/GitHub)
    if (wizardResult.importSource) {
      const { presetInstallUnifiedHandler } =
        await import("./preset-handlers.js");
      const installResult = await presetInstallUnifiedHandler(
        projectRoot,
        wizardResult.importSource,
      );
      if (!installResult.success) {
        log.warn(
          `Preset import failed: ${installResult.errors[0]?.message ?? "unknown error"}`,
        );
      }
    }

    // Save custom selection as preset if requested
    if (wizardResult.saveAsPreset) {
      const presetDir = path.join(
        configDir,
        "presets",
        wizardResult.saveAsPreset,
      );
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
            commands: wizardResult.commandTemplates,
            mcpServers: wizardResult.mcpServers,
          },
        }),
        "utf8",
      );
      log.info(
        `Saved custom selection as preset "${wizardResult.saveAsPreset}"`,
      );
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
    await createProjectStructure(configDir, agentIds, presetName, false);
  }

  for (const template of ruleTemplates) {
    const result = await createRule({ name: template, configDir, template });
    if (!result.ok) {
      log.warn(
        `Failed to create rule "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  const projectName = path.basename(projectRoot);
  for (const template of skillTemplates) {
    const result = await createSkill({
      name: template,
      configDir,
      template,
      copyrightHolder: projectName,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create skill "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  for (const template of agentTemplates) {
    const result = await createAgent({ name: template, configDir, template });
    if (!result.ok) {
      log.warn(
        `Failed to create agent "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  for (const template of commandTemplates) {
    const result = await createCommand({ name: template, configDir, template });
    if (!result.ok) {
      log.warn(
        `Failed to create command "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  for (const template of mcpServerTemplates) {
    const result = await createMcpServer({
      name: template,
      configDir,
      template,
    });
    if (!result.ok) {
      log.warn(
        `Failed to create MCP server "${template}": ${result.errors[0]?.message ?? "unknown error"}`,
      );
    }
  }

  // Record preset artifacts in state for drift detection
  if (presetName) {
    try {
      const stateManager = new StateManager(configDir, projectRoot);
      const now = new Date().toISOString();
      const artifactStates: ArtifactFileState[] = [];

      for (const name of ruleTemplates) {
        const filePath = path.join(configDir, "rules", `${name}.md`);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          artifactStates.push({
            path: path.relative(projectRoot, filePath),
            hash: hashContent(content),
            preset: presetName,
            timestamp: now,
          });
        } catch {
          /* file may not exist if scaffolding failed */
        }
      }
      for (const name of skillTemplates) {
        const filePath = path.join(configDir, "skills", name, "SKILL.md");
        try {
          const content = await fs.readFile(filePath, "utf-8");
          artifactStates.push({
            path: path.relative(projectRoot, filePath),
            hash: hashContent(content),
            preset: presetName,
            timestamp: now,
          });
        } catch {
          /* file may not exist if scaffolding failed */
        }
      }
      for (const name of agentTemplates) {
        const filePath = path.join(configDir, "agents", `${name}.md`);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          artifactStates.push({
            path: path.relative(projectRoot, filePath),
            hash: hashContent(content),
            preset: presetName,
            timestamp: now,
          });
        } catch {
          /* file may not exist if scaffolding failed */
        }
      }
      for (const name of commandTemplates) {
        const filePath = path.join(configDir, "commands", `${name}.md`);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          artifactStates.push({
            path: path.relative(projectRoot, filePath),
            hash: hashContent(content),
            preset: presetName,
            timestamp: now,
          });
        } catch {
          /* file may not exist if scaffolding failed */
        }
      }

      if (artifactStates.length > 0) {
        await stateManager.updatePresetArtifacts(artifactStates);
      }
    } catch {
      log.warn("Preset artifact state tracking failed; this is non-critical.");
    }
  }

  let generated = false;
  const configResult = await resolveConfig(projectRoot);
  if (configResult.ok) {
    const genResult = await generate(configResult.data, projectRoot);
    generated = genResult.ok;
    if (!genResult.ok) {
      log.warn(
        `Generation after init failed; you can run \`${PROJECT_CLI} generate\` later.`,
      );
    }
  }

  // Install pre-commit hooks
  let hooksInstalled = false;
  let hookFiles: string[] = [];
  if (configResult.ok) {
    try {
      const hookSetup = await detectHookSetup(projectRoot);
      const resolvedFlags = configResult.data.flags;
      const hooksConfig = generateHooksConfig(resolvedFlags, stack);
      if (hooksConfig.hooks.length > 0) {
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
        });
        hooksInstalled = hookResult.ok;
        if (hookResult.ok) {
          hookFiles = hookResult.data.files;
          log.info(
            `Pre-commit hooks installed (${hookSetup.runner === "none" ? "standalone" : hookSetup.runner})`,
          );
          const missingDeps = await checkHookDependencies(
            hooksConfig.hooks,
            projectRoot,
          );
          if (missingDeps.length > 0) {
            await installMissingDeps(
              missingDeps,
              projectRoot,
              log,
              isInteractive(options),
            );
          }
        } else {
          log.warn("Hook installation failed; you can set up hooks manually.");
        }
      }
    } catch {
      log.warn("Hook detection failed; skipping hook installation.");
    }
  }

  // Generate HTML documentation site (non-critical)
  try {
    const { buildSkillDocsFile } =
      await import("../core/docs/skill-docs-generator.js");
    const docsPath = await buildSkillDocsFile(projectRoot);
    log.info(`Documentation site generated: ${docsPath}`);
  } catch {
    log.warn("HTML docs generation skipped.");
  }

  // Update code-driven documentation sections (non-critical)
  try {
    const { injectSections } = await import("../core/docs/docs-generator.js");
    const result = await injectSections(projectRoot);
    if (result.ok && result.data.updated.length > 0) {
      log.info(
        `Documentation sections updated: ${result.data.updated.join(", ")}`,
      );
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
      preset: displayPresetName,
      agents: agentIds,
      stack,
      codiVersion: VERSION,
    });
    if (
      ruleTemplates.length > 0 ||
      skillTemplates.length > 0 ||
      agentTemplates.length > 0 ||
      commandTemplates.length > 0 ||
      mcpServerTemplates.length > 0
    ) {
      await ledger.setActivePreset({
        name: displayPresetName,
        installedAt: now,
        artifactSelection: {
          rules: ruleTemplates,
          skills: skillTemplates,
          agents: agentTemplates,
          commands: commandTemplates,
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

function inferHookType(
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

async function createProjectStructure(
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
    name: path.basename(path.dirname(configDir)),
    version: "1",
    agents,
  };
  if (versionPin) {
    manifest[PROJECT_NAME] = { requiredVersion: `>=${VERSION}` };
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
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: InitOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await initHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
