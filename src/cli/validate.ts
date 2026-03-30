import type { Command } from "commander";
import { resolveConfig } from "../core/config/resolver.js";
import { validateConfig } from "../core/config/validator.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import type { ProjectError, CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { PROJECT_DIR } from "../constants.js";

interface ValidateData {
  valid: boolean;
  errorCount: number;
  errors: ProjectError[];
}

export async function validateHandler(
  projectRoot: string,
): Promise<CommandResult<ValidateData>> {
  const configResult = await resolveConfig(projectRoot);

  if (!configResult.ok) {
    return createCommandResult({
      success: false,
      command: "validate",
      data: {
        valid: false,
        errorCount: configResult.errors.length,
        errors: configResult.errors,
      },
      errors: configResult.errors,
      exitCode:
        configResult.errors[0]?.code === "E_CONFIG_NOT_FOUND"
          ? EXIT_CODES.CONFIG_NOT_FOUND
          : EXIT_CODES.CONFIG_INVALID,
    });
  }

  const validationErrors = validateConfig(configResult.data);
  if (validationErrors.length > 0) {
    return createCommandResult({
      success: false,
      command: "validate",
      data: {
        valid: false,
        errorCount: validationErrors.length,
        errors: validationErrors,
      },
      errors: validationErrors,
      exitCode: EXIT_CODES.CONFIG_INVALID,
    });
  }

  return createCommandResult({
    success: true,
    command: "validate",
    data: { valid: true, errorCount: 0, errors: [] },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description(`Validate the ${PROJECT_DIR}/ configuration`)
    .action(async () => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      const result = await validateHandler(process.cwd());
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
