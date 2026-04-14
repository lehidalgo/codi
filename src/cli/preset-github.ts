import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import * as p from "@clack/prompts";
import { safeRm } from "../utils/fs.js";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import {
  PRESET_MANIFEST_FILENAME,
  GIT_CLONE_DEPTH,
  PROJECT_CLI,
  PROJECT_NAME,
} from "../constants.js";
import {
  readLockFile,
  writeLockFile,
  getPresetVersionFromDir,
  copyDir,
} from "../core/preset/preset-registry.js";
import { extractPresetName } from "../core/preset/preset-resolver.js";
import { validatePreset } from "../core/preset/preset-validator.js";
import { scanForPresets } from "../core/preset/preset-scanner.js";
import { scanDirectory } from "../core/security/content-scanner.js";
import { promptSecurityFindings } from "../core/security/scan-prompt.js";
import { execFileAsync } from "../utils/exec.js";
import { loadPreset } from "../core/preset/preset-loader.js";
import type { LoadedPreset } from "../core/preset/preset-loader.js";
import { applyPresetArtifacts } from "../core/preset/preset-applier.js";
import type { PresetInstallOptions } from "./preset-handlers.js";
import { regenerateConfigs } from "./shared.js";
import type { PresetData } from "./preset.js";
import type { parsePresetIdentifier } from "../core/preset/preset-resolver.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { FLAGS_FILENAME } from "../constants.js";

async function mergePresetFlagsFromGithub(
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
    // No existing flags
  }

  let merged = 0;
  for (const [key, def] of Object.entries(preset.flags)) {
    const existing = currentFlags[key] as Record<string, unknown> | undefined;
    if (existing?.["locked"]) {
      log.debug(`Flag "${key}" is locked locally — preset value skipped`);
      continue;
    }
    currentFlags[key] = { mode: def.mode, value: def.value };
    if (def.locked) {
      (currentFlags[key] as Record<string, unknown>)["locked"] = true;
    }
    merged++;
  }

  if (merged > 0) {
    await fs.writeFile(flagsFile, stringifyYaml(currentFlags), "utf-8");
  }
}

export async function installFromGithub(
  projectRoot: string,
  descriptor: ReturnType<typeof parsePresetIdentifier>,
  presetsDir: string,
  installOptions: PresetInstallOptions = {},
): Promise<CommandResult<PresetData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const repoUrl = `https://github.com/${descriptor.identifier}.git`;
  const ref = descriptor.ref ?? "main";
  log.info(`Cloning preset from ${repoUrl} (ref: ${ref})...`);

  const tmpDir = path.join(os.tmpdir(), `${PROJECT_NAME}-preset-gh-${Date.now()}`);
  try {
    const cloneArgs = ["clone", "--depth", GIT_CLONE_DEPTH];
    if (descriptor.ref) cloneArgs.push("--branch", descriptor.ref);
    cloneArgs.push(repoUrl, tmpDir);
    await execFileAsync("git", cloneArgs);

    let name = extractPresetName(descriptor);
    let sourceDir: string;

    if (descriptor.path) {
      const targetDir = path.join(tmpDir, descriptor.path);
      try {
        await fs.access(path.join(targetDir, PRESET_MANIFEST_FILENAME));
      } catch {
        return createCommandResult({
          success: false,
          command: "preset install",
          data: { action: "install", name },
          errors: [
            {
              code: "E_PRESET_NOT_FOUND",
              message: `No preset found at path "${descriptor.path}" in the repository.`,
              hint: `Run \`${PROJECT_CLI} preset install github:${descriptor.identifier}\` to list available presets.`,
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
      sourceDir = targetDir;
      name = path.basename(descriptor.path);
    } else {
      const discovered = await scanForPresets(tmpDir);

      if (discovered.length === 0) {
        return createCommandResult({
          success: false,
          command: "preset install",
          data: { action: "install", name },
          errors: [
            {
              code: "E_PRESET_NOT_FOUND",
              message: `No presets found in repository "${descriptor.identifier}".`,
              hint: "Presets must be in their own subfolder with a preset.yaml file.",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      } else if (discovered.length === 1) {
        sourceDir = discovered[0]!.dir;
        name = discovered[0]!.name;
      } else {
        if (installOptions.json || !process.stdout.isTTY) {
          const names = discovered.map((dp) => dp.name).join(", ");
          return createCommandResult({
            success: false,
            command: "preset install",
            data: { action: "install", name },
            errors: [
              {
                code: "E_MULTIPLE_PRESETS",
                message: `Multiple presets found: ${names}`,
                hint: `Specify one: \`${PROJECT_CLI} preset install github:${descriptor.identifier}/<name>\``,
                severity: "error",
                context: { presets: discovered.map((dp) => dp.name) },
              },
            ],
            exitCode: EXIT_CODES.GENERAL_ERROR,
          });
        }
        const selected = await p.select({
          message: `Found ${discovered.length} presets — which one to install?`,
          options: discovered.map((preset) => ({
            label: preset.name,
            value: preset.dir,
            hint: preset.description || `v${preset.version}`,
          })),
        });
        if (p.isCancel(selected)) {
          return createCommandResult({
            success: false,
            command: "preset install",
            data: { action: "install", name },
            errors: [
              {
                code: "E_CANCELLED",
                message: "Installation cancelled.",
                hint: "",
                severity: "error",
                context: {},
              },
            ],
            exitCode: EXIT_CODES.GENERAL_ERROR,
          });
        }
        sourceDir = selected as string;
        name = path.basename(sourceDir);
      }
    }

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
              message: `Security scan blocked installation of "${name}": ${scanReport.summary.critical} critical, ${scanReport.summary.high} high findings`,
              hint: "Review the findings above. Re-run and accept to override.",
              severity: "error",
              context: {},
            },
          ],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
      }
    }

    const destDir = path.join(presetsDir, name);
    await safeRm(destDir);
    await fs.mkdir(destDir, { recursive: true });
    await copyDir(sourceDir, destDir);

    let commit: string | undefined;
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd: tmpDir,
      });
      commit = stdout.trim();
    } catch {
      /* ignore */
    }

    const version = await getPresetVersionFromDir(destDir);
    const lock = await readLockFile(configDir);
    lock.presets[name] = {
      version,
      source: `github:${descriptor.identifier}${descriptor.ref ? `@${descriptor.ref}` : ""}`,
      sourceType: "github",
      commit,
      installedAt: new Date().toISOString(),
    };
    await writeLockFile(configDir, lock);
    log.info(`Installed preset "${name}" from GitHub.`);

    const loadResult = await loadPreset(name, presetsDir);
    if (loadResult.ok) {
      const applyResult = await applyPresetArtifacts(configDir, loadResult.data, {
        force: installOptions.force,
        keepCurrent: installOptions.keepCurrent,
      });
      log.info(
        `Applied: ${applyResult.added.length} added, ${applyResult.overwritten.length} updated, ${applyResult.skipped.length} skipped, ${applyResult.resourcesCopied} resources copied`,
      );
      await mergePresetFlagsFromGithub(configDir, loadResult.data, log);
      await regenerateConfigs(projectRoot);
    }

    return createCommandResult({
      success: true,
      command: "preset install",
      data: { action: "install", name },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
