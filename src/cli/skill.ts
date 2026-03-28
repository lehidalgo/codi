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
}
