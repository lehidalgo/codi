import type { Command } from "commander";
import { resolveCodiDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import {
  exportSkill,
  EXPORT_FORMATS,
  type SkillExportFormat,
} from "../core/skill/skill-export.js";
import { runSkillExportWizard } from "./skill-export-wizard.js";
import {
  readAllFeedback,
  readFeedbackForSkill,
} from "../core/skill/feedback-collector.js";
import {
  aggregateAllStats,
  aggregateStats,
  formatStatsTable,
  formatDetailedStats,
} from "../core/skill/skill-stats.js";
import {
  skillEvolveHandler,
  skillVersionsHandler,
} from "./skill-evolve-handler.js";

export { skillEvolveHandler, skillVersionsHandler };

export interface SkillExportData {
  action: "export";
  name: string;
  format: string;
  outputPath?: string;
}

export async function skillExportHandler(
  projectRoot: string,
  name: string,
  format: string,
  output: string,
): Promise<CommandResult<SkillExportData>> {
  const log = Logger.getInstance();

  if (!EXPORT_FORMATS.includes(format as SkillExportFormat)) {
    return createCommandResult({
      success: false,
      command: "skill export",
      data: { action: "export", name, format },
      errors: [
        {
          code: "E_GENERAL",
          message: `Unsupported format: "${format}". Use one of: ${EXPORT_FORMATS.join(", ")}`,
          hint: `Available formats: ${EXPORT_FORMATS.join(", ")}`,
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const codiDir = resolveCodiDir(projectRoot);
  const result = await exportSkill({
    name,
    codiDir,
    outputDir: output,
    format: format as SkillExportFormat,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "skill export",
      data: { action: "export", name, format },
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

  const { outputPath, sizeBytes } = result.data;
  const sizeInfo = sizeBytes ? ` (${(sizeBytes / 1024).toFixed(1)}KB)` : "";
  log.info(`Exported skill "${name}" to ${outputPath}${sizeInfo}`);

  return createCommandResult({
    success: true,
    command: "skill export",
    data: { action: "export", name, format, outputPath },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface FeedbackData {
  action: "feedback";
  entries: unknown[];
  skillName?: string;
}

export async function skillFeedbackHandler(
  projectRoot: string,
  skillName?: string,
  limit?: number,
): Promise<CommandResult<FeedbackData>> {
  const codiDir = resolveCodiDir(projectRoot);
  const result = skillName
    ? await readFeedbackForSkill(codiDir, skillName)
    : await readAllFeedback(codiDir);

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "skill feedback",
      data: { action: "feedback", entries: [], skillName },
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

  const entries = limit ? result.data.slice(-limit) : result.data;

  return createCommandResult({
    success: true,
    command: "skill feedback",
    data: { action: "feedback", entries, skillName },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface StatsData {
  action: "stats";
  stats: unknown;
  skillName?: string;
}

export async function skillStatsHandler(
  projectRoot: string,
  skillName?: string,
): Promise<CommandResult<StatsData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);
  const result = await readAllFeedback(codiDir);

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: "skill stats",
      data: { action: "stats", stats: null, skillName },
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

  if (skillName) {
    const skillEntries = result.data.filter(
      (e) => e.skillName === skillName,
    );
    if (skillEntries.length === 0) {
      log.info(`No feedback found for skill "${skillName}".`);
    }
    const stats = aggregateStats(skillEntries);
    log.info(formatDetailedStats(stats));
    return createCommandResult({
      success: true,
      command: "skill stats",
      data: { action: "stats", stats, skillName },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  const allStats = aggregateAllStats(result.data);
  if (allStats.length === 0) {
    log.info("No feedback data found. Skills will report feedback after use.");
  } else {
    log.info(formatStatsTable(allStats));
  }

  return createCommandResult({
    success: true,
    command: "skill stats",
    data: { action: "stats", stats: allStats },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerSkillCommand(program: Command): void {
  const cmd = program.command("skill").description("Manage skills");

  cmd
    .command("export [name]")
    .description("Export a skill for marketplace distribution")
    .option(
      "--format <format>",
      `Export format (${EXPORT_FORMATS.join(", ")})`,
      "standard",
    )
    .option("--output <path>", "Output directory", ".")
    .option("--interactive", "Launch interactive wizard")
    .action(
      async (
        name: string | undefined,
        options: {
          format: string;
          output: string;
          interactive?: boolean;
        },
      ) => {
        const globalOptions = program.opts() as GlobalOptions;
        initFromOptions(globalOptions);

        // Launch wizard if no name provided or --interactive flag
        if (!name || options.interactive) {
          const wizardResult = await runSkillExportWizard(process.cwd());
          if (!wizardResult) {
            process.exit(1);
          }
          const result = await skillExportHandler(
            process.cwd(),
            wizardResult.name,
            wizardResult.format,
            wizardResult.outputDir,
          );
          handleOutput(result, globalOptions);
          process.exit(result.exitCode);
          return;
        }

        const result = await skillExportHandler(
          process.cwd(),
          name,
          options.format,
          options.output,
        );
        handleOutput(result, globalOptions);
        process.exit(result.exitCode);
      },
    );

  cmd
    .command("feedback")
    .description("List skill usage feedback")
    .option("--skill <name>", "Filter by skill name")
    .option("--limit <n>", "Show last N entries", parseInt)
    .action(async (options: { skill?: string; limit?: number }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      const result = await skillFeedbackHandler(
        process.cwd(),
        options.skill,
        options.limit,
      );
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("stats [name]")
    .description("Show skill health dashboard")
    .action(async (name: string | undefined) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      const result = await skillStatsHandler(process.cwd(), name);
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("evolve <name>")
    .description("Generate improvement prompt from feedback")
    .option("--dry-run", "Print prompt without saving a version")
    .action(async (name: string, options: { dryRun?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);

      const result = await skillEvolveHandler(
        process.cwd(),
        name,
        options.dryRun ?? false,
      );
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });

  cmd
    .command("versions <name>")
    .description("Manage skill version history")
    .option("--restore <version>", "Restore SKILL.md from a version", parseInt)
    .option("--diff <v1,v2>", "Show diff between two versions")
    .action(
      async (name: string, options: { restore?: number; diff?: string }) => {
        const globalOptions = program.opts() as GlobalOptions;
        initFromOptions(globalOptions);

        const result = await skillVersionsHandler(process.cwd(), name, options);
        handleOutput(result, globalOptions);
        process.exit(result.exitCode);
      },
    );
}
