import path from "node:path";
import { resolveCodiDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import {
  validateEvolveReadiness,
  buildImproveOptions,
  generateImprovementPrompt,
} from "../core/skill/skill-improver.js";
import {
  saveVersion,
  listVersions,
  restoreVersion,
  diffVersions,
} from "../core/skill/version-manager.js";

interface EvolveData {
  action: "evolve";
  skillName: string;
  version?: number;
  prompt?: string;
}

export async function skillEvolveHandler(
  projectRoot: string,
  skillName: string,
  dryRun: boolean,
): Promise<CommandResult<EvolveData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);

  const readiness = await validateEvolveReadiness(codiDir, skillName);
  if (!readiness.ok) {
    return createCommandResult({
      success: false,
      command: "skill evolve",
      data: { action: "evolve", skillName },
      errors: readiness.errors.map((e) => ({
        code: e.code,
        message: e.message,
        hint: e.hint,
        severity: e.severity as "error",
        context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  if (!readiness.data.ready) {
    log.warn(readiness.data.reason ?? "Skill not ready for evolution.");
    return createCommandResult({
      success: false,
      command: "skill evolve",
      data: { action: "evolve", skillName },
      errors: [],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  let version: number | undefined;
  if (!dryRun) {
    const skillDir = path.join(codiDir, "skills", skillName);
    const versionResult = await saveVersion(skillDir);
    if (versionResult.ok) {
      version = versionResult.data.version;
      log.info(`Version v${version} saved.`);
    }
  }

  const optionsResult = await buildImproveOptions(codiDir, skillName);
  if (!optionsResult.ok) {
    return createCommandResult({
      success: false,
      command: "skill evolve",
      data: { action: "evolve", skillName, version },
      errors: optionsResult.errors.map((e) => ({
        code: e.code,
        message: e.message,
        hint: e.hint,
        severity: e.severity as "error",
        context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const promptResult = await generateImprovementPrompt(optionsResult.data);
  if (!promptResult.ok) {
    return createCommandResult({
      success: false,
      command: "skill evolve",
      data: { action: "evolve", skillName, version },
      errors: promptResult.errors.map((e) => ({
        code: e.code,
        message: e.message,
        hint: e.hint,
        severity: e.severity as "error",
        context: e.context,
      })),
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  log.info(promptResult.data);

  return createCommandResult({
    success: true,
    command: "skill evolve",
    data: { action: "evolve", skillName, version, prompt: promptResult.data },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface VersionsData {
  action: "versions";
  skillName: string;
  versions?: unknown[];
  diff?: string;
}

export async function skillVersionsHandler(
  projectRoot: string,
  skillName: string,
  options: { restore?: number; diff?: string },
): Promise<CommandResult<VersionsData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const skillDir = path.join(codiDir, "skills", skillName);

  // Restore mode
  if (options.restore !== undefined) {
    const result = await restoreVersion(skillDir, options.restore);
    if (!result.ok) {
      return createCommandResult({
        success: false,
        command: "skill versions",
        data: { action: "versions", skillName },
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
    log.info(`Restored skill "${skillName}" to version v${options.restore}.`);
    return createCommandResult({
      success: true,
      command: "skill versions",
      data: { action: "versions", skillName },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // Diff mode
  if (options.diff) {
    const parts = options.diff.split(",").map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      log.warn(
        "Diff requires two version numbers separated by comma (e.g., --diff 1,2)",
      );
      return createCommandResult({
        success: false,
        command: "skill versions",
        data: { action: "versions", skillName },
        errors: [],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
    const result = await diffVersions(skillDir, parts[0]!, parts[1]!);
    if (!result.ok) {
      return createCommandResult({
        success: false,
        command: "skill versions",
        data: { action: "versions", skillName },
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
    log.info(result.data);
    return createCommandResult({
      success: true,
      command: "skill versions",
      data: { action: "versions", skillName, diff: result.data },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  // List mode (default)
  const result = await listVersions(skillDir);
  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "skill versions",
      data: { action: "versions", skillName },
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

  if (result.data.length === 0) {
    log.info(`No versions found for skill "${skillName}".`);
  } else {
    const lines = [
      "| Version | Date | Size |",
      "|---------|------|------|",
      ...result.data.map((v) => {
        const date = new Date(v.timestamp)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        const size = `${(v.sizeBytes / 1024).toFixed(1)}KB`;
        return `| v${v.version} | ${date} | ${size} |`;
      }),
    ];
    log.info(lines.join("\n"));
  }

  return createCommandResult({
    success: true,
    command: "skill versions",
    data: { action: "versions", skillName, versions: result.data },
    exitCode: EXIT_CODES.SUCCESS,
  });
}
