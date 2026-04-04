import { VERSION } from "#src/index.js";
import type { ProjectError, CommandResult } from "./types.js";

export function formatHuman(result: CommandResult<unknown>): string {
  const lines: string[] = [];

  if (result.success) {
    lines.push(`[OK] ${result.command}`);
  } else {
    lines.push(`[FAIL] ${result.command}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  [WARN] ${warning.message}`);
  }

  for (const error of result.errors) {
    lines.push(`  [ERR] ${error.message}`);
    if (error.hint && error.hint !== error.message) {
      lines.push(`  [HINT] ${error.hint}`);
    }
  }

  if (result.data !== null && result.data !== undefined) {
    const dataStr =
      typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
    if (dataStr) {
      lines.push(dataStr);
    }
  }

  return lines.join("\n");
}

export function formatJson(result: CommandResult<unknown>): string {
  return JSON.stringify(result, null, 2);
}

export function createCommandResult<T>(options: {
  success: boolean;
  command: string;
  data: T;
  errors?: ProjectError[];
  warnings?: ProjectError[];
  exitCode: number;
}): CommandResult<T> {
  return {
    success: options.success,
    command: options.command,
    data: options.data,
    errors: options.errors ?? [],
    warnings: options.warnings ?? [],
    exitCode: options.exitCode,
    timestamp: new Date().toISOString(),
    version: VERSION,
  };
}
