import fs from "node:fs/promises";
import path from "node:path";
import { safeRm } from "../utils/fs.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import * as p from "@clack/prompts";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import {
  PRESET_MANIFEST_FILENAME,
  PROJECT_CLI,
  PROJECT_DIR,
} from "../constants.js";
import { StateManager } from "../core/config/state.js";
import {
  readLockFile,
  writeLockFile,
  getPresetVersionFromDir,
  copyDir,
} from "../core/preset/preset-registry.js";
import { parsePresetIdentifier } from "../core/preset/preset-resolver.js";
import {
  extractPresetZip,
  createPresetZip,
} from "../core/preset/preset-zip.js";
import { validatePreset } from "../core/preset/preset-validator.js";
import { installFromGithub } from "./preset-github.js";
import {
  getBuiltinPresetNames,
  BUILTIN_PRESETS,
} from "../templates/presets/index.js";
import { presetInstallHandler } from "./preset.js";
import type { PresetData } from "./preset.js";
import { printBanner } from "./shared.js";
import { scanDirectory } from "../core/security/content-scanner.js";
import { promptSecurityFindings } from "../core/security/scan-prompt.js";
import { AVAILABLE_TEMPLATES } from "../core/scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../core/scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../core/scaffolder/agent-template-loader.js";
import { AVAILABLE_COMMAND_TEMPLATES } from "../core/scaffolder/command-template-loader.js";
import { regenerateConfigs } from "./shared.js";
import { loadPreset } from "../core/preset/preset-loader.js";
import type { LoadedPreset } from "../core/preset/preset-loader.js";
import { applyPresetArtifacts } from "../core/preset/preset-applier.js";
import { FLAGS_FILENAME } from "../constants.js";

/**
 * Merges a loaded preset's flags into the project's flags.yaml.
 * Existing flags not in the preset are preserved. Locked existing flags are not overwritten.
 */
async function mergePresetFlags(
  configDir: string,
  preset: LoadedPreset,
  log: Logger,
): Promise<void> {
  if (Object.keys(preset.flags).length === 0) return;

  const flagsFile = path.join(configDir, FLAGS_FILENAME);
  let currentFlags: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(flagsFile, "utf8");
    currentFlags = (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch {
    // No existing flags file — will create
  }

  let merged = 0;
  for (const [key, def] of Object.entries(preset.flags)) {
    const existing = currentFlags[key] as Record<string, unknown> | undefined;
    if (existing?.["locked"]) {
      log.debug(`Flag "${key}" is locked locally — preset value skipped`);
      continue;
    }
    const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
    if (def.locked) entry["locked"] = true;
    currentFlags[key] = entry;
    merged++;
  }

  await fs.writeFile(flagsFile, stringifyYaml(currentFlags), "utf-8");
  if (merged > 0) {
    log.info(
      `Merged ${merged} flag(s) from preset "${preset.name}" into flags.yaml`,
    );
  }
}

/**
 * Unified install handler: auto-detects source type from the argument.
 */
export interface PresetInstallOptions {
  force?: boolean;
  json?: boolean;
}

export async function presetInstallUnifiedHandler(
  projectRoot: string,
  source: string,
  installOptions: PresetInstallOptions = {},
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetsDir = path.join(configDir, "presets");
  const descriptor = parsePresetIdentifier(source);

  try {
    if (descriptor.type === "zip") {
      log.info(`Installing preset from ZIP: ${source}...`);

      // Extract + validate (extractPresetZip calls validatePreset internally)
      const extractResult = await extractPresetZip(source);
      if (!extractResult.ok) {
        return createCommandResult({
          success: false,
          command: "preset install",
          data: { action: "install" },
          errors: extractResult.errors.map((e) => ({
            code: e.code,
            message: e.message,
            hint: e.hint,
            severity: e.severity as "error",
            context: e.context,
          })),
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }

      const { extractedDir, presetName } = extractResult.data;

      // Security scan on extracted content before copying
      const scanReport = await scanDirectory(extractedDir);
      if (scanReport.verdict !== "pass") {
        const proceed = await promptSecurityFindings(scanReport);
        if (!proceed) {
          const tmpParent = path.dirname(extractedDir);
          await fs
            .rm(tmpParent, { recursive: true, force: true })
            .catch(() => {});
          return createCommandResult({
            success: false,
            command: "preset install",
            data: { action: "install", name: presetName },
            errors: [
              {
                code: "E_SECURITY_SCAN_BLOCKED",
                message: `Security scan blocked installation of "${presetName}"`,
                hint: "Review the findings above. Re-run and accept to override.",
                severity: "error",
                context: {},
              },
            ],
            exitCode: EXIT_CODES.GENERAL_ERROR,
          });
        }
      }

      // Copy to final destination
      const destDir = path.join(presetsDir, presetName);
      try {
        await safeRm(destDir);
        await fs.mkdir(destDir, { recursive: true });
        await copyDir(extractedDir, destDir);
      } finally {
        const tmpParent = path.dirname(extractedDir);
        await fs
          .rm(tmpParent, { recursive: true, force: true })
          .catch(() => {});
      }

      const version = await getPresetVersionFromDir(destDir);
      const lock = await readLockFile(configDir);
      lock.presets[presetName] = {
        version,
        source: `zip:${path.resolve(source)}`,
        sourceType: "zip",
        installedAt: new Date().toISOString(),
      };
      await writeLockFile(configDir, lock);
      log.info(`Installed preset "${presetName}" from ZIP.`);

      // Apply preset artifacts and flags to project with conflict resolution
      const loadResult = await loadPreset(presetName, presetsDir);
      if (loadResult.ok) {
        const applyResult = await applyPresetArtifacts(
          configDir,
          loadResult.data,
          { force: installOptions.force, json: installOptions.json },
        );
        log.info(
          `Applied: ${applyResult.added.length} added, ${applyResult.overwritten.length} updated, ${applyResult.skipped.length} skipped, ${applyResult.resourcesCopied} resources copied`,
        );
        await mergePresetFlags(configDir, loadResult.data, log);
        await regenerateConfigs(projectRoot);
      }

      return createCommandResult({
        success: true,
        command: "preset install",
        data: { action: "install", name: presetName },
        exitCode: EXIT_CODES.SUCCESS,
      });
    }

    if (descriptor.type === "github") {
      return installFromGithub(
        projectRoot,
        descriptor,
        presetsDir,
        installOptions,
      );
    }

    if (descriptor.type === "builtin") {
      return createCommandResult({
        success: false,
        command: "preset install",
        data: { action: "install", name: descriptor.identifier },
        errors: [
          {
            code: "E_BUILTIN_NOT_INSTALLABLE",
            message: `"${descriptor.identifier}" is a built-in preset.`,
            hint: `Use \`${PROJECT_CLI} init --preset ${descriptor.identifier}\` to install built-in presets.`,
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    // Fallback: treat as registry --from style
    return presetInstallHandler(projectRoot, descriptor.identifier, source);
  } catch (error) {
    return createCommandResult({
      success: false,
      command: "preset install",
      data: { action: "install" },
      errors: [
        {
          code: "E_GENERAL",
          message: `Failed to install: ${error instanceof Error ? error.message : String(error)}`,
          hint: "Check the source and try again.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }
}

export async function presetExportHandler(
  projectRoot: string,
  name: string,
  format: string,
  output: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);

  if (format !== "zip") {
    return createCommandResult({
      success: false,
      command: "preset export",
      data: { action: "export", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Unsupported export format: ${format}. Use "zip".`,
          hint: "Only ZIP format is currently supported.",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const presetDir = path.join(configDir, "presets", name);
  try {
    await fs.access(path.join(presetDir, PRESET_MANIFEST_FILENAME));
  } catch (cause) {
    log.warn(`Preset manifest not accessible for "${name}"`, cause);
    return createCommandResult({
      success: false,
      command: "preset export",
      data: { action: "export", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Preset "${name}" not found.`,
          hint: `Run \`${PROJECT_CLI} preset list\` to see available presets.`,
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createPresetZip(presetDir, output);
  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "preset export",
      data: { action: "export", name },
      errors: result.errors.map((e) => ({
        code: e.code,
        message: e.message,
        hint: e.hint,
        severity: e.severity as "error",
        context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  log.info(
    `Exported preset "${name}" to ${result.data.outputPath} (${(result.data.sizeBytes / 1024).toFixed(1)}KB)`,
  );
  return createCommandResult({
    success: true,
    command: "preset export",
    data: { action: "export", name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetValidateHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetDir = path.join(configDir, "presets", name);

  const result = await validatePreset(presetDir);
  if (!result.ok) {
    for (const e of result.errors) log.info(`  Error: ${e.message}`);
    return createCommandResult({
      success: false,
      command: "preset validate",
      data: { action: "validate", name },
      errors: result.errors.map((e) => ({
        code: e.code,
        message: e.message,
        hint: e.hint,
        severity: e.severity as "error",
        context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const { manifest, artifactCounts, warnings } = result.data;
  log.info(`Preset "${manifest.name}" is valid.`);
  log.info(`  Version: ${manifest.version ?? "unset"}`);
  log.info(
    `  Rules: ${artifactCounts.rules}, Skills: ${artifactCounts.skills}, Agents: ${artifactCounts.agents}, Commands: ${artifactCounts.commands}`,
  );
  for (const w of warnings) log.info(`  Warning: ${w.message}`);

  return createCommandResult({
    success: true,
    command: "preset validate",
    data: { action: "validate", name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetRemoveHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetDir = path.join(configDir, "presets", name);

  try {
    await fs.access(presetDir);
    await safeRm(presetDir);
  } catch (cause) {
    log.warn(`Failed to remove preset "${name}"`, cause);
    return createCommandResult({
      success: false,
      command: "preset remove",
      data: { action: "remove", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Preset "${name}" not found.`,
          hint: `Run \`${PROJECT_CLI} preset list\` to see installed presets.`,
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const lock = await readLockFile(configDir);
  delete lock.presets[name];
  await writeLockFile(configDir, lock);

  // Clean up state entries for the removed preset and inform about orphaned artifacts
  const stateManager = new StateManager(configDir, projectRoot);
  const stateResult = await stateManager.read();
  if (stateResult.ok && stateResult.data.presetArtifacts) {
    const orphaned = stateResult.data.presetArtifacts.filter(
      (a) => a.preset === name,
    );
    if (orphaned.length > 0) {
      log.info(
        `${orphaned.length} artifact(s) from "${name}" remain in ${PROJECT_DIR}/:`,
      );
      for (const a of orphaned) {
        log.info(`  ${a.path}`);
      }
      log.info(
        "These files are not deleted — remove them manually if no longer needed.",
      );
    }
    // Remove stale state entries for this preset
    stateResult.data.presetArtifacts = stateResult.data.presetArtifacts.filter(
      (a) => a.preset !== name,
    );
    await stateManager.write(stateResult.data);
  }

  log.info(`Removed preset "${name}".`);
  return createCommandResult({
    success: true,
    command: "preset remove",
    data: { action: "remove", name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetListEnhancedHandler(
  projectRoot: string,
  showBuiltin: boolean,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const presetsDir = path.join(configDir, "presets");
  const lock = await readLockFile(configDir);

  const presets: Array<{
    name: string;
    description: string;
    sourceType?: string;
    category?: string;
  }> = [];

  if (showBuiltin) {
    for (const name of getBuiltinPresetNames()) {
      const def = BUILTIN_PRESETS[name];
      presets.push({
        name,
        description: def?.description ?? "",
        sourceType: "builtin",
      });
    }
  }

  try {
    const entries = await fs.readdir(presetsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(
        presetsDir,
        entry.name,
        PRESET_MANIFEST_FILENAME,
      );
      const lockEntry = lock.presets[entry.name];
      const sourceType = lockEntry?.sourceType ?? "local";
      try {
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = parseYaml(raw) as Record<string, unknown>;
        presets.push({
          name: entry.name,
          description: (parsed["description"] as string) ?? "",
          sourceType,
          category: (parsed["category"] as string) ?? undefined,
        });
      } catch (cause) {
        log.debug(`Failed to parse manifest for preset "${entry.name}"`, cause);
        presets.push({
          name: entry.name,
          description: "(no manifest)",
          sourceType,
        });
      }
    }
  } catch {
    /* presetsDir doesn't exist */
  }

  if (presets.length === 0) {
    log.info("No presets found. Use --builtin to see built-in presets.");
  } else {
    for (const pr of presets) {
      const tag = pr.sourceType ? `[${pr.sourceType}]` : "";
      const cat = pr.category ? `(${pr.category})` : "";
      log.info(
        `  ${pr.name} ${tag} ${cat} — ${pr.description || "(no description)"}`.replace(
          /  +/g,
          " ",
        ),
      );
    }
  }

  return createCommandResult({
    success: true,
    command: "preset list",
    data: { action: "list", presets },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function presetEditHandler(
  projectRoot: string,
  name: string,
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  printBanner("Preset Editor");
  p.intro(`${PROJECT_CLI} — Preset Editor`);
  const manifestPath = path.join(configDir, "presets", name, "preset.yaml");

  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(manifestPath, "utf8");
  } catch {
    return createCommandResult({
      success: false,
      command: "preset edit",
      data: { action: "validate", name },
      errors: [
        {
          code: "E_GENERAL",
          message: `Preset "${name}" not found.`,
          hint: "",
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const manifest = parseYaml(manifestRaw) as Record<string, unknown>;
  const current = (manifest["artifacts"] ?? {}) as Record<string, string[]>;

  const currentRules = new Set(current["rules"] ?? []);
  const currentSkills = new Set(current["skills"] ?? []);
  const currentAgents = new Set(current["agents"] ?? []);
  const currentCommands = new Set(current["commands"] ?? []);

  const rules = await p.multiselect({
    message: "Rules",
    options: AVAILABLE_TEMPLATES.map((t) => ({ label: t, value: t })),
    initialValues: AVAILABLE_TEMPLATES.filter((t) => currentRules.has(t)),
    required: false,
  });
  if (p.isCancel(rules)) {
    p.cancel("Operation cancelled.");
    return createCancelledResult("preset edit", name);
  }

  const skills = await p.multiselect({
    message: "Skills",
    options: AVAILABLE_SKILL_TEMPLATES.map((t) => ({ label: t, value: t })),
    initialValues: AVAILABLE_SKILL_TEMPLATES.filter((t) =>
      currentSkills.has(t),
    ),
    required: false,
  });
  if (p.isCancel(skills)) {
    p.cancel("Operation cancelled.");
    return createCancelledResult("preset edit", name);
  }

  const agents = await p.multiselect({
    message: "Agents",
    options: AVAILABLE_AGENT_TEMPLATES.map((t) => ({ label: t, value: t })),
    initialValues: AVAILABLE_AGENT_TEMPLATES.filter((t) =>
      currentAgents.has(t),
    ),
    required: false,
  });
  if (p.isCancel(agents)) {
    p.cancel("Operation cancelled.");
    return createCancelledResult("preset edit", name);
  }

  const commands = await p.multiselect({
    message: "Commands",
    options: AVAILABLE_COMMAND_TEMPLATES.map((t) => ({ label: t, value: t })),
    initialValues: AVAILABLE_COMMAND_TEMPLATES.filter((t) =>
      currentCommands.has(t),
    ),
    required: false,
  });
  if (p.isCancel(commands)) {
    p.cancel("Operation cancelled.");
    return createCancelledResult("preset edit", name);
  }

  manifest["artifacts"] = {
    rules,
    skills,
    agents,
    commands,
  };

  await fs.writeFile(manifestPath, stringifyYaml(manifest), "utf8");
  await regenerateConfigs(projectRoot);

  log.info(`Updated preset "${name}".`);
  p.outro("Preset updated.");
  return createCommandResult({
    success: true,
    command: "preset edit",
    data: { action: "validate", name },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

function createCancelledResult(
  command: string,
  name: string,
): CommandResult<PresetData> {
  return createCommandResult({
    success: false,
    command,
    data: { action: "validate", name },
    errors: [
      {
        code: "E_GENERAL",
        message: "Operation cancelled.",
        hint: "",
        severity: "error",
        context: {},
      },
    ],
    exitCode: EXIT_CODES.GENERAL_ERROR,
  });
}
