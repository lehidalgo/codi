import type { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import * as p from "@clack/prompts";
import { PROJECT_CLI, BACKUPS_DIR, RETENTION_CANCELLED_ERROR } from "../constants.js";
import { resolveProjectDir } from "../utils/paths.js";
import { listBackups, openBackup, type BackupInfo } from "../core/backup/backup-manager.js";
import { readManifest } from "../core/backup/backup-manifest.js";
import { connectBackup } from "../core/backup/backup-source.js";
import { runArtifactSelectionFromSource } from "./init-wizard-modify-add.js";
import { createCommandResult } from "../core/output/formatter.js";
import { createError } from "../core/output/errors.js";
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
  dryRun?: boolean;
}

interface RevertData {
  action: "list" | "restore" | "dry-run";
  backups?: Array<{ timestamp: string; fileCount: number }>;
  restoredFiles?: string[];
  timestamp?: string;
  preRevertBackup?: string;
}

export async function revertHandler(
  projectRoot: string,
  options: RevertOptions,
): Promise<CommandResult<RevertData>> {
  const log = Logger.getInstance();
  const configDir = resolveProjectDir(projectRoot);

  const backups = await listBackups(configDir);
  if (options.list) return printBackupList(backups);

  if (backups.length === 0) {
    return createCommandResult({
      success: false,
      command: "revert",
      data: { action: "restore" },
      errors: [
        createError("E_NO_BACKUPS", {
          message:
            "No backups available. Backups are created automatically before destructive operations.",
        }),
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  let timestamp: string | undefined;
  if (options.backup) {
    timestamp = options.backup;
  } else if (options.last) {
    timestamp = backups[0]?.timestamp;
  } else if (process.stdout.isTTY) {
    const picked = await p.select({
      message: "Select a backup to restore:",
      options: backups.map((b) => ({
        value: b.timestamp,
        label: `${b.timestamp}  -  ${b.fileCount} files`,
      })),
    });
    if (p.isCancel(picked)) {
      return createCommandResult({
        success: true,
        command: "revert",
        data: { action: "restore" },
        exitCode: EXIT_CODES.SUCCESS,
      });
    }
    timestamp = picked as string;
  }

  if (!timestamp) {
    return createCommandResult({
      success: false,
      command: "revert",
      data: { action: "restore" },
      errors: [
        createError("E_GENERAL", {
          message: "Specify --list, --last, or --backup <timestamp>.",
          hint: `Use \`${PROJECT_CLI} revert --list\` to see available backups.`,
        }),
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  if (options.dryRun) return runDryRun(configDir, timestamp, log);

  // Pre-revert snapshot of CURRENT state.
  const preRevertR = await openBackup(projectRoot, configDir, {
    trigger: "pre-revert",
    includeSource: true,
    includeOutput: true,
    includePreExisting: true,
  });
  if (!preRevertR.ok && preRevertR.errors === "retention-cancelled") {
    log.error(RETENTION_CANCELLED_ERROR);
    return createCommandResult({
      success: false,
      command: "revert",
      data: { action: "restore" },
      errors: [
        createError("E_BACKUP_CANCELLED", {
          message: RETENTION_CANCELLED_ERROR,
        }),
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }
  const preRevertHandle = preRevertR.ok ? preRevertR.data : null;

  try {
    let restored: string[] = [];
    let usedSelectionFlow = false;
    try {
      const source = await connectBackup(configDir, timestamp);
      try {
        await runArtifactSelectionFromSource(configDir, source);
        usedSelectionFlow = true;
      } finally {
        await source.cleanup();
      }
    } catch (cause) {
      // Backup has no .codi/ source — fall back to direct file restore.
      log.debug(
        `connectBackup failed (${cause instanceof Error ? cause.message : String(cause)}); falling back to direct restore.`,
      );
      const { restoreBackup } = await import("../core/backup/backup-manager.js");
      restored = await restoreBackup(projectRoot, configDir, timestamp);
      log.info(`Restored ${restored.length} files from backup ${timestamp}`);
    }

    if (usedSelectionFlow) {
      restored = await maybeRestorePreExisting(configDir, projectRoot, timestamp);
      await regenerateConfigs(projectRoot);
    }

    if (preRevertHandle) await preRevertHandle.finalise();

    try {
      const ledger = new OperationsLedgerManager(configDir);
      await ledger.logOperation({
        type: "revert",
        timestamp: new Date().toISOString(),
        details: {
          backupTimestamp: timestamp,
          restoredFiles: restored.length,
          preRevertBackup: preRevertHandle?.timestamp ?? null,
        },
      });
    } catch (cause) {
      log.debug("Ledger write failed during revert", cause);
    }

    return createCommandResult({
      success: true,
      command: "revert",
      data: {
        action: "restore",
        restoredFiles: restored,
        timestamp,
        ...(preRevertHandle ? { preRevertBackup: preRevertHandle.timestamp } : {}),
      },
      exitCode: EXIT_CODES.SUCCESS,
    });
  } catch (cause) {
    if (preRevertHandle) await preRevertHandle.abort();
    throw cause;
  }
}

function printBackupList(backups: BackupInfo[]): CommandResult<RevertData> {
  const log = Logger.getInstance();
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

async function runDryRun(
  configDir: string,
  timestamp: string,
  log: ReturnType<typeof Logger.getInstance>,
): Promise<CommandResult<RevertData>> {
  const targetBackupDir = path.join(configDir, BACKUPS_DIR, timestamp);
  const m = await readManifest(targetBackupDir);
  if (!m.ok) {
    return createCommandResult({
      success: false,
      command: "revert",
      data: { action: "dry-run", timestamp },
      errors: [
        createError("E_GENERAL", {
          message: `Backup ${timestamp} has no readable manifest.`,
          hint: "Use --list to see available backups.",
        }),
      ],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }
  const files = m.data.files;
  const sourceCount = files.filter((f) => f.scope === "source").length;
  const outputCount = files.filter((f) => f.scope === "output").length;
  const preExistingCount = files.filter((f) => f.preExisting).length;
  const deletedCount = files.filter((f) => f.deleted).length;

  log.info(`Dry-run for backup ${timestamp}:`);
  log.info(`  Would create pre-revert snapshot of current state`);
  log.info(`  Would offer ${sourceCount} source artifacts via artifact-selection wizard`);
  log.info(`  Would auto-regenerate ${outputCount} output files via \`${PROJECT_CLI} generate\``);
  if (preExistingCount > 0) {
    log.info(`  Would prompt to also restore ${preExistingCount} pre-existing files`);
  }
  if (deletedCount > 0) {
    log.info(
      `  Note: ${deletedCount} files in this backup were tagged 'deleted'; ` +
        `they'll be restored only if user re-selects their parent artifacts in the wizard`,
    );
  }
  return createCommandResult({
    success: true,
    command: "revert",
    data: { action: "dry-run", timestamp },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

async function maybeRestorePreExisting(
  configDir: string,
  projectRoot: string,
  timestamp: string,
): Promise<string[]> {
  const targetBackupDir = path.join(configDir, BACKUPS_DIR, timestamp);
  const m = await readManifest(targetBackupDir);
  if (!m.ok) return [];
  const preExisting = m.data.files.filter((f) => f.preExisting);
  if (preExisting.length === 0 || !process.stdout.isTTY) return [];

  const answer = await p.confirm({
    message:
      `This backup also captured ${preExisting.length} pre-existing files ` +
      `from before codi was first installed. Restore them too?`,
    initialValue: false,
  });
  if (p.isCancel(answer) || !answer) return [];

  const restored: string[] = [];
  for (const entry of preExisting) {
    const src = path.join(targetBackupDir, entry.path);
    const dest = path.resolve(projectRoot, entry.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.copyFile(src, dest);
      restored.push(entry.path);
    } catch {
      // skip missing files
    }
  }
  return restored;
}

export function registerRevertCommand(program: Command): void {
  program
    .command("revert [timestamp]")
    .description("Restore generated files from a previous backup")
    .option("--list", "Show available backups")
    .option("--last", "Restore most recent backup")
    .option("--backup <timestamp>", "Restore a specific backup by timestamp")
    .option("--dry-run", "Show what would happen without writing")
    .action(async (positionalTs: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: RevertOptions = { ...globalOptions, ...cmdOptions };
      if (positionalTs && !options.backup) options.backup = positionalTs;
      initFromOptions(options);
      const result = await revertHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
