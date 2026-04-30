import type { Command } from "commander";
import path from "node:path";
import { listBackups } from "../core/backup/backup-manager.js";
import { interactiveEvict, listSealedBackups } from "../core/backup/backup-retention.js";
import { resolveProjectDir } from "../utils/paths.js";
import { createCommandResult } from "../core/output/formatter.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";
import { initFromOptions, handleOutput } from "./shared.js";
import { Logger } from "../core/output/logger.js";
import { safeRm } from "../utils/fs.js";
import { BACKUPS_DIR } from "../constants.js";
import type { GlobalOptions } from "./shared.js";
import type { CommandResult } from "../core/output/types.js";

interface BackupListData {
  backups: Array<{ timestamp: string; fileCount: number }>;
}

export async function backupListHandler(
  projectRoot: string,
): Promise<CommandResult<BackupListData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
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
    command: "backup --list",
    data: { backups },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function backupDeleteHandler(
  projectRoot: string,
  timestamps: string[],
): Promise<CommandResult<{ deleted: string[] }>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);
  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  const deleted: string[] = [];
  for (const ts of timestamps) {
    const dir = path.join(backupsRoot, ts);
    const removedOk = await safeRm(dir);
    if (removedOk) {
      deleted.push(ts);
      log.info(`Deleted backup ${ts}`);
    } else {
      log.warn(`Backup ${ts} not found or could not be removed`);
    }
  }
  return createCommandResult({
    success: true,
    command: "backup --delete",
    data: { deleted },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export async function backupPruneHandler(
  projectRoot: string,
): Promise<CommandResult<{ deleted: number }>> {
  const configDir = resolveProjectDir(projectRoot);
  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  const before = (await listSealedBackups(backupsRoot)).length;
  await interactiveEvict(backupsRoot);
  const after = (await listSealedBackups(backupsRoot)).length;
  return createCommandResult({
    success: true,
    command: "backup --prune",
    data: { deleted: before - after },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerBackupCommand(program: Command): void {
  program
    .command("backup")
    .description("Manage codi backups (list, delete, prune)")
    .option("--list", "List existing backups")
    .option("--delete <ts...>", "Delete one or more backups by timestamp")
    .option("--prune", "Interactively select backups to delete")
    .action(async (cmdOptions: { list?: boolean; delete?: string[]; prune?: boolean }) => {
      const globalOptions = program.opts() as GlobalOptions;
      initFromOptions(globalOptions);
      let result;
      if (cmdOptions.delete && cmdOptions.delete.length > 0) {
        result = await backupDeleteHandler(process.cwd(), cmdOptions.delete);
      } else if (cmdOptions.prune) {
        result = await backupPruneHandler(process.cwd());
      } else {
        result = await backupListHandler(process.cwd());
      }
      handleOutput(result, globalOptions);
      process.exit(result.exitCode);
    });
}
