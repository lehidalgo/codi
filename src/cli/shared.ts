import type { Command } from "commander";
import { PROJECT_CLI } from "../constants.js";
import { Logger } from "../core/output/logger.js";
import { formatHuman, formatJson } from "../core/output/formatter.js";
import type { CommandResult } from "../core/output/types.js";
import { registerAllAdapters } from "../adapters/index.js";
import { resolveConfig } from "../core/config/resolver.js";
import { generate } from "../core/generator/generator.js";
import { printCompactBanner } from "./banner.js";

export interface GlobalOptions {
  json?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}

export function addGlobalOptions(cmd: Command): Command {
  return cmd
    .option("-j, --json", "Output as JSON")
    .option("-v, --verbose", "Verbose output")
    .option("-q, --quiet", "Suppress non-essential output")
    .option("--no-color", "Disable colored output");
}

export function initFromOptions(options: GlobalOptions): void {
  if (options.verbose && options.quiet) {
    process.stderr.write(
      "[ERR] --verbose and --quiet are mutually exclusive\n",
    );
    process.exit(1);
  }

  const level = options.verbose ? "debug" : options.quiet ? "error" : "info";
  const mode = options.json ? "json" : "human";
  const noColor = options.noColor ?? false;

  Logger.init({ level, mode, noColor });
}

/**
 * Resolves config and regenerates all agent files.
 * Call after any command that modifies the project configuration.
 * Returns true on success, false on failure (logs warning, never throws).
 */
export async function regenerateConfigs(projectRoot: string): Promise<boolean> {
  const log = Logger.getInstance();
  try {
    registerAllAdapters();
    const configResult = await resolveConfig(projectRoot);
    if (!configResult.ok) {
      log.warn("Auto-generate skipped: config resolution failed.");
      return false;
    }
    const genResult = await generate(configResult.data, projectRoot);
    return genResult.ok;
  } catch {
    log.warn(`Auto-generate failed. Run \`${PROJECT_CLI} generate\` manually.`);
    return false;
  }
}

/**
 * Prints the CLI banner with a wizard title.
 */
export function printBanner(title: string): void {
  printCompactBanner(title);
}

/**
 * Prints a section header before a prompt group.
 */
export function printSection(label: string): void {
  const log = Logger.getInstance();
  log.info("");
  log.info(`  \u25B8 ${label}`);
}

export function handleOutput(
  result: CommandResult<unknown>,
  options: { json?: boolean },
): void {
  if (options.json) {
    process.stdout.write(formatJson(result) + "\n");
  } else {
    process.stdout.write(formatHuman(result) + "\n");
  }
}
