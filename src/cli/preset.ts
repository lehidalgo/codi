import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { scanProjectDir } from "../core/config/parser.js";
import {
  MANIFEST_FILENAME,
  PRESET_MANIFEST_FILENAME,
  GIT_CLONE_DEPTH,
  PROJECT_DIR,
  PROJECT_NAME,
} from "../constants.js";
import {
  getRegistryConfig,
  readLockFile,
  writeLockFile,
  cloneRegistry,
  readRegistryIndex,
  filterEntries,
  getPresetVersionFromDir,
  copyDir,
} from "../core/preset/preset-registry.js";
import type { RegistryEntry } from "../core/preset/preset-registry.js";
import {
  presetInstallUnifiedHandler,
  presetExportHandler,
  presetValidateHandler,
  presetRemoveHandler,
  presetListEnhancedHandler,
  presetEditHandler,
} from "./preset-handlers.js";
import { runPresetWizard } from "./preset-wizard.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";
import { validatePreset } from "../core/preset/preset-validator.js";
import { loadPreset } from "../core/preset/preset-loader.js";
import { applyPresetArtifacts } from "../core/preset/preset-applier.js";
import { scanDirectory } from "../core/security/content-scanner.js";
import { promptSecurityFindings } from "../core/security/scan-prompt.js";
import { execFileAsync } from "../utils/exec.js";
import fg from "fast-glob";

export interface PresetData {
  action:
    | "create"
    | "list"
    | "install"
    | "search"
    | "update"
    | "export"
    | "validate"
    | "info"
    | "remove";
  name?: string;
  presets?: Array<{ name: string; description: string; sourceType?: string }>;
  results?: RegistryEntry[];
  updated?: string[];
}

export async function presetCreateHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetDir = path.join(configDir, "presets", name);

  try {
    await fs.access(presetDir);
    return createCommandResult({
      success: false,
      command: "preset create",
      data: { action: "create", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Preset "${name}" already exists at ${presetDir}`,
          hint: "Choose a different name or remove the existing preset.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } catch {
    /* doesn't exist, proceed */
  }

  await fs.mkdir(presetDir, { recursive: true });

  // Scan current .codi/ artifacts to snapshot into the preset
  const artifacts = await snapshotArtifacts(configDir, presetDir);

  // Copy flags.yaml if it exists
  const flagsPath = path.join(configDir, "flags.yaml");
  try {
    await fs.access(flagsPath);
    await fs.copyFile(flagsPath, path.join(presetDir, "flags.yaml"));
  } catch {
    // No flags.yaml — skip
  }

  const manifest = {
    name,
    description: "",
    version: "1.0.0",
    artifacts,
  };

  await fs.writeFile(
    path.join(presetDir, PRESET_MANIFEST_FILENAME),
    stringifyYaml(manifest),
    "utf8",
  );

  log.info(`Created preset "${name}" at ${PROJECT_DIR}/presets/${name}/`);

  return createCommandResult({
    success: true,
    command: "preset create",
    data: { action: "create", name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface ArtifactNames {
  rules: string[];
  skills: string[];
  agents: string[];
}

async function snapshotArtifacts(configDir: string, presetDir: string): Promise<ArtifactNames> {
  const artifacts: ArtifactNames = {
    rules: [],
    skills: [],
    agents: [],
  };

  // Scan rules
  const ruleFiles = await fg("rules/*.md", { cwd: configDir });
  for (const rel of ruleFiles) {
    const name = path.basename(rel, ".md");
    artifacts.rules.push(name);
    const dest = path.join(presetDir, "rules");
    await fs.mkdir(dest, { recursive: true });
    await fs.copyFile(path.join(configDir, rel), path.join(dest, `${name}.md`));
  }

  // Scan skills (directory-based)
  const skillFiles = await fg("skills/*/SKILL.md", { cwd: configDir });
  for (const rel of skillFiles) {
    const name = rel.split("/")[1]!;
    artifacts.skills.push(name);
    const destDir = path.join(presetDir, "skills", name);
    await fs.mkdir(destDir, { recursive: true });
    // Copy entire skill directory
    const srcDir = path.join(configDir, "skills", name);
    await copyDir(srcDir, destDir);
  }

  // Scan agents
  const agentFiles = await fg("agents/*.md", { cwd: configDir });
  for (const rel of agentFiles) {
    const name = path.basename(rel, ".md");
    artifacts.agents.push(name);
    const dest = path.join(presetDir, "agents");
    await fs.mkdir(dest, { recursive: true });
    await fs.copyFile(path.join(configDir, rel), path.join(dest, `${name}.md`));
  }

  return artifacts;
}

export async function presetInstallHandler(
  projectRoot: string,
  name: string,
  from: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const destDir = path.join(configDir, "presets", name);

  const tmpDir = path.join(os.tmpdir(), `${PROJECT_NAME}-preset-${Date.now()}`);
  try {
    log.info(`Cloning preset from ${from}...`);
    await execFileAsync("git", ["clone", "--depth", GIT_CLONE_DEPTH, from, tmpDir]);

    const presetSource = path.join(tmpDir, name);
    let sourceDir: string;

    try {
      await fs.access(path.join(presetSource, PRESET_MANIFEST_FILENAME));
      sourceDir = presetSource;
    } catch {
      sourceDir = tmpDir;
    }

    // Validate structure (was missing for legacy --from path)
    const validation = await validatePreset(sourceDir);
    if (!validation.ok) {
      return createCommandResult({
        success: false,
        command: "preset install",
        data: { action: "install", name },
        errors: validation.errors.map((e) => ({
          code: e.code,
          message: e.message,
          hint: e.hint,
          severity: e.severity as "error",
          context: e.context,
        })),
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    // Security scan
    const scanReport = await scanDirectory(sourceDir);
    if (scanReport.verdict !== "pass") {
      const proceed = await promptSecurityFindings(scanReport);
      if (!proceed) {
        return createCommandResult({
          success: false,
          command: "preset install",
          data: { action: "install", name },
          errors: [
            {
              code: "E_SECURITY_SCAN_BLOCKED",
              message: `Security scan blocked installation of "${name}"`,
              hint: "Review the findings above. Re-run and accept to override.",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
    }

    await fs.mkdir(destDir, { recursive: true });
    await copyDir(sourceDir, destDir);

    const version = await getPresetVersionFromDir(destDir);
    const lock = await readLockFile(configDir);
    lock.presets[name] = {
      version,
      source: from,
      sourceType: "registry",
      installedAt: new Date().toISOString(),
    };
    await writeLockFile(configDir, lock);

    log.info(`Installed preset "${name}" to ${PROJECT_DIR}/presets/${name}/`);

    return createCommandResult({
      success: true,
      command: "preset install",
      data: { action: "install", name },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: "preset install",
      data: { action: "install", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Failed to install preset "${name}": ${error instanceof Error ? error.message : String(error)}`,
          hint: "Check the repository URL and try again.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function presetSearchHandler(
  projectRoot: string,
  query: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();

  const scanResult = await scanProjectDir(projectRoot);
  const manifest = scanResult.ok ? scanResult.data.manifest : null;
  const registryConfig = getRegistryConfig(manifest);

  let tmpDir: string | undefined;
  try {
    tmpDir = await cloneRegistry(registryConfig);
    const allEntries = await readRegistryIndex(tmpDir);
    const results = filterEntries(allEntries, query);

    if (results.length === 0) {
      log.info(`No presets found matching "${query}"`);
    } else {
      log.info(`Found ${results.length} preset(s) matching "${query}":`);
      for (const entry of results) {
        const tags = entry.tags.length > 0 ? ` [${entry.tags.join(", ")}]` : "";
        log.info(`  ${entry.name}@${entry.version} — ${entry.description}${tags}`);
      }
    }

    return createCommandResult({
      success: true,
      command: "preset search",
      data: { action: "search", results },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: "preset search",
      data: { action: "search" },
      errors: [
        {
          code: "E_GENERAL",
          message: `Failed to search registry: ${error instanceof Error ? error.message : String(error)}`,
          hint: `Check registry configuration in ${MANIFEST_FILENAME} presetRegistry field.`,
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export async function presetUpdateHandler(
  projectRoot: string,
  dryRun: boolean,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);

  const scanResult = await scanProjectDir(projectRoot);
  const manifest = scanResult.ok ? scanResult.data.manifest : null;
  const registryConfig = getRegistryConfig(manifest);
  const lock = await readLockFile(configDir);

  const installedNames = Object.keys(lock.presets);
  if (installedNames.length === 0) {
    log.info("No presets tracked in lock file. Nothing to update.");
    return createCommandResult({
      success: true,
      command: "preset update",
      data: { action: "update", updated: [] },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  let tmpDir: string | undefined;
  try {
    tmpDir = await cloneRegistry(registryConfig);
    const allEntries = await readRegistryIndex(tmpDir);
    const entryMap = new Map(allEntries.map((e) => [e.name, e]));

    const updated: string[] = [];

    for (const name of installedNames) {
      const registryEntry = entryMap.get(name);
      if (!registryEntry) {
        log.info(`  ${name}: not found in registry, skipping`);
        continue;
      }

      const lockEntry = lock.presets[name];
      if (!lockEntry) {
        log.info(`  ${name}: missing lock entry, skipping`);
        continue;
      }

      const currentVersion = lockEntry.version;
      if (registryEntry.version === currentVersion) {
        log.info(`  ${name}: up to date (${currentVersion})`);
        continue;
      }

      log.info(`  ${name}: ${currentVersion} -> ${registryEntry.version}`);

      if (!dryRun) {
        const presetSourceDir = path.join(tmpDir, name);
        const destDir = path.join(configDir, "presets", name);

        try {
          await fs.access(path.join(presetSourceDir, PRESET_MANIFEST_FILENAME));

          const scanReport = await scanDirectory(presetSourceDir);
          if (scanReport.verdict !== "pass") {
            const proceed = await promptSecurityFindings(scanReport);
            if (!proceed) {
              log.info(`  ${name}: skipped due to security findings`);
              continue;
            }
          }

          await fs.rm(destDir, { recursive: true, force: true });
          await fs.mkdir(destDir, { recursive: true });
          await copyDir(presetSourceDir, destDir);

          // Apply artifacts with conflict resolution
          const presetsDir = path.join(configDir, "presets");
          const loadResult = await loadPreset(name, presetsDir);
          if (loadResult.ok) {
            await applyPresetArtifacts(configDir, loadResult.data);
          }

          lock.presets[name] = {
            version: registryEntry.version,
            source: lockEntry.source,
            sourceType: lockEntry.sourceType ?? "registry",
            installedAt: new Date().toISOString(),
          };
          updated.push(name);
        } catch (copyError) {
          log.info(
            `  ${name}: failed to update — ${copyError instanceof Error ? copyError.message : String(copyError)}`,
          );
        }
      } else {
        updated.push(name);
      }
    }

    if (!dryRun && updated.length > 0) {
      await writeLockFile(configDir, lock);
    }

    if (updated.length === 0) {
      log.info("All presets are up to date.");
    } else if (dryRun) {
      log.info(`Would update ${updated.length} preset(s). Run without --dry-run to apply.`);
    } else {
      log.info(`Updated ${updated.length} preset(s).`);
    }

    return createCommandResult({
      success: true,
      command: "preset update",
      data: { action: "update", updated },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (error) {
    return createCommandResult({
      success: false,
      command: "preset update",
      data: { action: "update" },
      errors: [
        {
          code: "E_GENERAL",
          message: `Failed to update presets: ${error instanceof Error ? error.message : String(error)}`,
          hint: "Check registry configuration and network connectivity.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export function registerPresetCommand(program: Command): void {
  const cmd = program.command("preset").description("Manage configuration presets");

  cmd
    .command("create [name]")
    .description("Create a new preset scaffold")
    .option("--interactive", "Launch interactive creation wizard")
    .action(async (name: string | undefined, options: { interactive?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      if (options.interactive || !name) {
        const wizardResult = await runPresetWizard(process.cwd());
        if (!wizardResult) {
          process.exit(1);
        }
        process.exit(0);
      }
      const result = await presetCreateHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("list")
    .description("List installed presets")
    .option("--builtin", "Include built-in presets")
    .action(async (options: { builtin?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetListEnhancedHandler(process.cwd(), options.builtin ?? false);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("install <source>")
    .description("Install a preset (ZIP file, GitHub repo, or registry name)")
    .option("--from <repo>", "Git repository to install from (legacy)")
    .option("-f, --force", "Overwrite conflicting files without prompting")
    .action(async (source: string, options: { from?: string; force?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      let result;
      if (options.from) {
        result = await presetInstallHandler(process.cwd(), source, options.from);
      } else {
        result = await presetInstallUnifiedHandler(process.cwd(), source, {
          force: options.force,
          json: globalOptions.json,
        });
      }
      if (result.success) {
        try {
          const ledger = new OperationsLedgerManager(resolveProjectDir(process.cwd()));
          await ledger.logOperation({
            type: "preset-install",
            timestamp: new Date().toISOString(),
            details: { source, from: options.from ?? null },
          });
        } catch {
          /* best-effort */
        }
      }
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("export <name>")
    .description("Export a preset as a ZIP file")
    .option("--format <format>", "Export format (zip)", "zip")
    .option("--output <path>", "Output path", ".")
    .action(async (name: string, options: { format: string; output: string }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetExportHandler(process.cwd(), name, options.format, options.output);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("validate <name>")
    .description("Validate a preset structure and schema")
    .action(async (name: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetValidateHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("remove <name>")
    .description("Remove an installed preset")
    .action(async (name: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetRemoveHandler(process.cwd(), name);
      if (result.success) {
        try {
          const ledger = new OperationsLedgerManager(resolveProjectDir(process.cwd()));
          await ledger.logOperation({
            type: "preset-remove",
            timestamp: new Date().toISOString(),
            details: { name },
          });
        } catch {
          /* best-effort */
        }
      }
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("edit <name>")
    .description("Interactively edit preset artifact selection")
    .action(async (name: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetEditHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("search <query>")
    .description("Search preset registry")
    .action(async (query: string) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetSearchHandler(process.cwd(), query);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("update")
    .description("Update installed presets to latest versions")
    .option("--dry-run", "Show what would change without writing")
    .action(async (options: { dryRun?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await presetUpdateHandler(process.cwd(), options.dryRun ?? false);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
