import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveCodiDir } from '../utils/paths.js';
import { isPathSafe } from '../utils/path-guard.js';
import { StateManager } from '../core/config/state.js';
import { OperationsLedgerManager } from '../core/audit/operations-ledger.js';
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
  hooksDeleted: string[];
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

async function isDirEmpty(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.length === 0;
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
  '.agents/skills',
  '.claude/agents',
  '.codex/agents',
];
const AGENT_FILES = ['.claude/mcp.json', '.cursor/mcp.json', '.codex/mcp.toml', '.windsurf/mcp.json'];
const AGENT_PARENT_DIRS = ['.claude', '.cursor', '.cline', '.windsurf', '.agents', '.codex'];

const CODI_HOOK_MARKER = '# Codi hooks';

const KNOWN_HOOK_FILES = [
  '.git/hooks/codi-secret-scan.mjs',
  '.git/hooks/codi-file-size-check.mjs',
  '.git/hooks/codi-version-check.mjs',
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileContainsCodiMarker(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content.includes(CODI_HOOK_MARKER);
  } catch {
    return false;
  }
}

async function removeCodiSectionFromFile(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes(CODI_HOOK_MARKER)) return false;

    const lines = content.split('\n');
    const filtered: string[] = [];
    let inCodiSection = false;

    for (const line of lines) {
      if (line.trim() === CODI_HOOK_MARKER) {
        inCodiSection = true;
        continue;
      }
      if (inCodiSection && line.trim() === '') {
        inCodiSection = false;
        continue;
      }
      if (!inCodiSection) {
        filtered.push(line);
      }
    }

    const remaining = filtered.join('\n').trim();
    if (remaining.length === 0) {
      await fs.unlink(filePath);
      return true;
    }
    await fs.writeFile(filePath, remaining + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

async function cleanHookFiles(
  projectRoot: string,
  stateHooks: Array<{ path: string }>,
  options: CleanOptions,
  log: Logger,
): Promise<string[]> {
  const deleted: string[] = [];

  // 1) State-tracked hook files
  for (const hook of stateHooks) {
    if (!isPathSafe(projectRoot, hook.path)) continue;
    const absPath = path.resolve(projectRoot, hook.path);
    if (options.dryRun) {
      if (await fileExists(absPath)) {
        log.info(`Would delete hook: ${hook.path}`);
        deleted.push(hook.path);
      }
    } else {
      const ok = await safeDelete(absPath);
      if (ok) {
        deleted.push(hook.path);
        log.info(`Deleted hook: ${hook.path}`);
      }
    }
  }

  // 2) Known codi hook scripts (fallback if not in state)
  const alreadyDeleted = new Set(deleted);
  for (const hookFile of KNOWN_HOOK_FILES) {
    if (alreadyDeleted.has(hookFile)) continue;
    const absPath = path.join(projectRoot, hookFile);
    if (options.dryRun) {
      if (await fileExists(absPath)) {
        log.info(`Would delete hook: ${hookFile}`);
        deleted.push(hookFile);
      }
    } else {
      const ok = await safeDelete(absPath);
      if (ok) {
        deleted.push(hookFile);
        log.info(`Deleted hook: ${hookFile}`);
      }
    }
  }

  // 3) Husky files: remove codi sections or delete if codi-only
  const huskyFiles = ['.husky/pre-commit', '.husky/commit-msg'];
  for (const huskyFile of huskyFiles) {
    if (alreadyDeleted.has(huskyFile)) continue;
    const absPath = path.join(projectRoot, huskyFile);
    if (!await fileContainsCodiMarker(absPath)) continue;

    if (options.dryRun) {
      log.info(`Would clean codi section from: ${huskyFile}`);
      deleted.push(huskyFile);
    } else {
      const cleaned = await removeCodiSectionFromFile(absPath);
      if (cleaned) {
        deleted.push(huskyFile);
        log.info(`Cleaned codi section from: ${huskyFile}`);
      }
    }
  }

  // 4) Standalone .git/hooks/pre-commit and commit-msg (only if codi marker present)
  const standaloneHooks = ['.git/hooks/pre-commit', '.git/hooks/commit-msg'];
  for (const hookFile of standaloneHooks) {
    if (alreadyDeleted.has(hookFile)) continue;
    const absPath = path.join(projectRoot, hookFile);
    if (!await fileContainsCodiMarker(absPath)) continue;

    if (options.dryRun) {
      log.info(`Would delete hook: ${hookFile}`);
      deleted.push(hookFile);
    } else {
      const ok = await safeDelete(absPath);
      if (ok) {
        deleted.push(hookFile);
        log.info(`Deleted hook: ${hookFile}`);
      }
    }
  }

  // 5) Clean up empty .husky/ directory
  const huskyDir = path.join(projectRoot, '.husky');
  if (await isDirEmpty(huskyDir)) {
    if (options.dryRun) {
      log.info('Would remove empty: .husky/');
    } else {
      await safeRmDir(huskyDir);
      log.info('Removed empty: .husky/');
    }
  }

  return deleted;
}

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
      if (!isPathSafe(projectRoot, filePath)) {
        log.warn(`Skipping unsafe path: ${filePath}`);
        continue;
      }
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
      if (!isPathSafe(projectRoot, file)) {
        log.warn(`Skipping unsafe path: ${file}`);
        continue;
      }
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

  // Clean hook files (state-tracked + known patterns + husky sections)
  const stateHooks = (stateResult.ok && stateResult.data.hooks) ? stateResult.data.hooks : [];
  const hooksDeleted = await cleanHookFiles(projectRoot, stateHooks, options, log);

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
    if (await isDirEmpty(absDir)) {
      if (options.dryRun) {
        log.info(`Would remove empty: ${dir}/`);
        dirsDeleted.push(dir);
      } else {
        await safeRmDir(absDir);
        dirsDeleted.push(dir);
        log.info(`Removed empty: ${dir}/`);
      }
    }
  }

  // Log clean operation to ledger (before potentially removing .codi/)
  if (!options.dryRun) {
    try {
      const ledger = new OperationsLedgerManager(codiDir);
      await ledger.clearFiles();
      await ledger.logOperation({
        type: 'clean',
        timestamp: new Date().toISOString(),
        details: {
          filesDeleted,
          hooksDeleted,
          dirsDeleted,
          all: options.all ?? false,
        },
      });
    } catch {
      // Ledger write is best-effort; don't fail clean
    }
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
    data: { filesDeleted, dirsDeleted, hooksDeleted, codiDirRemoved },
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
