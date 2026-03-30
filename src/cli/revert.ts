import type { Command } from "commander";
import { PROJECT_CLI } from "../constants.js";
import { resolveProjectDir } from "../utils/paths.js";
import { listBackups, restoreBackup } from "../core/backup/backup-manager.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { Logger } from "../core/output/logger.js";
import type { CommandResult } from "../core/output/types.js";
import { initFromOptions, handleOutput, regenerateConfigs } from "./shared.js";
import type { GlobalOptions } from "./shared.js";
import { OperationsLedgerManager } from "../core/audit/operations-ledger.js";

interface RevertOptions extends GlobalOptions {
  list?: boolean;
  last?: boolean;
  backup?: string;
}

interface RevertData {
  action: "list" | "restore";
  backups?: Array<{ timestamp: string; fileCount: number }>;
  restoredFiles?: string[];
  timestamp?: string;
}

export async function revertHandler(
  projectRoot: string,
  options: RevertOptions,
): Promise<CommandResult<RevertData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);

  if (options.list) {
    const backups = await listBackups(configDir);
    if (backups.length === 0) {
      log.info("No backups found.");
    } else {
      for (const b of backups) {
        log.info(`  ${b.timestamp} (${b.fileCount} files)`);
      }
    }
    return createCommandResult({
      success: true,
      command: "revert",
      data: { action: "list", backups },
      exitCode: EXIT_CODES.SUCCESS,
    });
  }

  let timestamp: string | undefined;

  if (options.last) {
    const backups = await listBackups(configDir);
    if (backups.length === 0) {
      return createCommandResult({
        success: false,
        command: "revert",
        data: { action: "restore" },
        errors: [
          {
            code: "E_GENERAL",
            message: "No backups available to restore.",
            hint: `Run \`${PROJECT_CLI} generate\` first to create a backup.`,
            severity: "error",
            context: {},
          },
        ],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
    timestamp = backups[0]!.timestamp;
  } else if (options.backup) {
    timestamp = options.backup;
  }

  if (!timestamp) {
    return createCommandResult({
      success: false,
      command: "revert",
      data: { action: "restore" },
      errors: [
        {
          code: "E_GENERAL",
          message: "Specify --list, --last, or --backup <timestamp>.",
          hint: `Use \`${PROJECT_CLI} revert --list\` to see available backups.`,
          severity: "error",
          context: {},
        },
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const restoredFiles = await restoreBackup(projectRoot, configDir, timestamp);
  log.info(`Restored ${restoredFiles.length} files from backup ${timestamp}`);
  await regenerateConfigs(projectRoot);

  try {
    const ledger = new OperationsLedgerManager(configDir);
    await ledger.logOperation({
      type: "revert",
      timestamp: new Date().toISOString(),
      details: {
        backupTimestamp: timestamp,
        restoredFiles: restoredFiles.length,
      },
    });
  } catch {
    // Best-effort
  }

  return createCommandResult({
    success: true,
    command: "revert",
    data: { action: "restore", restoredFiles, timestamp },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerRevertCommand(program: Command): void {
  program
    .command("revert")
    .description("Restore generated files from a previous backup")
    .option("--list", "Show available backups")
    .option("--last", "Restore most recent backup")
    .option("--backup <timestamp>", "Restore a specific backup by timestamp")
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: RevertOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await revertHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
