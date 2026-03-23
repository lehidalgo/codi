import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCodiDir } from '../utils/paths.js';
import { StateManager } from '../core/config/state.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface CleanOptions extends GlobalOptions {
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface CleanData {
  filesDeleted: string[];
  dirsDeleted: string[];
  codiDirRemoved: boolean;
}

async function safeDelete(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeRmDir(dirPath: string): Promise<boolean> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function collectGeneratedFiles(stateAgents: Record<string, Array<{ path: string }>>): string[] {
  const files = new Set<string>();
  for (const agentFiles of Object.values(stateAgents)) {
    for (const file of agentFiles) {
      files.add(file.path);
    }
  }
  return [...files];
}

const AGENT_SUBDIRS = [
  '.claude/rules',
  '.claude/commands',
  '.claude/skills',
  '.cursor/rules',
  '.cursor/skills',
  '.cline/skills',
  '.windsurf/skills',
];
const AGENT_FILES = ['.claude/mcp.json'];
const AGENT_PARENT_DIRS = ['.claude', '.cursor', '.cline', '.windsurf'];

export async function cleanHandler(
  projectRoot: string,
  options: CleanOptions,
): Promise<CommandResult<CleanData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);

  const filesDeleted: string[] = [];
  const dirsDeleted: string[] = [];

  const stateManager = new StateManager(codiDir, projectRoot);
  const stateResult = await stateManager.read();

  const hasStateFiles = stateResult.ok && Object.keys(stateResult.data.agents).length > 0;

  if (hasStateFiles) {
    const generatedFiles = collectGeneratedFiles(stateResult.data.agents);
    for (const filePath of generatedFiles) {
      const absPath = path.resolve(projectRoot, filePath);
      if (options.dryRun) {
        log.info(`Would delete: ${filePath}`);
        filesDeleted.push(filePath);
      } else {
        const deleted = await safeDelete(absPath);
        if (deleted) {
          filesDeleted.push(filePath);
          log.info(`Deleted: ${filePath}`);
        }
      }
    }
  } else if (!hasStateFiles) {
    log.warn('No state file found. Cleaning known generated files.');
    const knownFiles = ['CLAUDE.md', 'AGENTS.md', '.cursorrules', '.windsurfrules', '.clinerules'];
    for (const file of knownFiles) {
      const absPath = path.join(projectRoot, file);
      if (options.dryRun) {
        try {
          await fs.access(absPath);
          log.info(`Would delete: ${file}`);
          filesDeleted.push(file);
        } catch { /* doesn't exist */ }
      } else {
        const deleted = await safeDelete(absPath);
        if (deleted) {
          filesDeleted.push(file);
          log.info(`Deleted: ${file}`);
        }
      }
    }
  }

  for (const file of AGENT_FILES) {
    const absPath = path.join(projectRoot, file);
    if (options.dryRun) {
      try {
        await fs.access(absPath);
        log.info(`Would delete: ${file}`);
        filesDeleted.push(file);
      } catch { /* doesn't exist */ }
    } else {
      const deleted = await safeDelete(absPath);
      if (deleted) {
        filesDeleted.push(file);
        log.info(`Deleted: ${file}`);
      }
    }
  }

  for (const dir of AGENT_SUBDIRS) {
    const absDir = path.join(projectRoot, dir);
    try {
      await fs.access(absDir);
      if (options.dryRun) {
        log.info(`Would remove: ${dir}/`);
        dirsDeleted.push(dir);
      } else {
        await safeRmDir(absDir);
        dirsDeleted.push(dir);
        log.info(`Removed: ${dir}/`);
      }
    } catch { /* doesn't exist */ }
  }

  for (const dir of AGENT_PARENT_DIRS) {
    const absDir = path.join(projectRoot, dir);
    try {
      const entries = await fs.readdir(absDir);
      if (entries.length === 0) {
        if (options.dryRun) {
          log.info(`Would remove empty: ${dir}/`);
          dirsDeleted.push(dir);
        } else {
          await safeRmDir(absDir);
          dirsDeleted.push(dir);
          log.info(`Removed empty: ${dir}/`);
        }
      }
    } catch { /* doesn't exist */ }
  }

  let codiDirRemoved = false;
  if (options.all) {
    try {
      await fs.access(codiDir);
      if (options.dryRun) {
        log.info('Would remove: .codi/');
        codiDirRemoved = true;
      } else {
        await safeRmDir(codiDir);
        codiDirRemoved = true;
        log.info('Removed: .codi/');
      }
    } catch { /* doesn't exist */ }
  }

  return createCommandResult({
    success: true,
    command: 'clean',
    data: { filesDeleted, dirsDeleted, codiDirRemoved },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove generated files and optionally the .codi/ directory')
    .option('--all', 'Remove everything including .codi/ (full uninstall)')
    .option('--dry-run', 'Show what would be deleted without deleting')
    .option('--force', 'Skip confirmation')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: CleanOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await cleanHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
