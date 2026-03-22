import fs from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../../types/result.js';
import { ok, err } from '../../types/result.js';
import { createError } from '../output/errors.js';
import type { HookSetup } from './hook-detector.js';
import type { HookEntry } from './hook-registry.js';
import type { ResolvedFlags } from '../../types/flags.js';
import { RUNNER_TEMPLATE, SECRET_SCAN_TEMPLATE, FILE_SIZE_CHECK_TEMPLATE } from './hook-templates.js';

export interface InstallOptions {
  projectRoot: string;
  runner: HookSetup['runner'];
  hooks: HookEntry[];
  flags: ResolvedFlags;
}

function buildRunnerScript(hooks: HookEntry[]): string {
  const hooksJson = JSON.stringify(hooks, null, 2);
  return RUNNER_TEMPLATE.replace('{{HOOKS_JSON}}', hooksJson);
}

function buildSecretScanScript(): string {
  return SECRET_SCAN_TEMPLATE;
}

function buildFileSizeScript(maxLines: number): string {
  return FILE_SIZE_CHECK_TEMPLATE.replace('{{MAX_LINES}}', String(maxLines));
}

async function installStandalone(
  projectRoot: string,
  hooks: HookEntry[],
  _flags: ResolvedFlags,
): Promise<Result<void>> {
  const hookDir = path.join(projectRoot, '.git', 'hooks');
  try {
    await fs.mkdir(hookDir, { recursive: true });
  } catch {
    return err([createError('E_HOOK_FAILED', {
      hook: 'pre-commit',
      reason: `Cannot create .git/hooks directory at ${hookDir}`,
    })]);
  }

  const script = buildRunnerScript(hooks);
  const hookPath = path.join(hookDir, 'pre-commit');

  try {
    await fs.writeFile(hookPath, script, { encoding: 'utf-8', mode: 0o755 });
    return ok(undefined);
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'pre-commit',
      reason: `Failed to write hook: ${(cause as Error).message}`,
    })]);
  }
}

async function installHusky(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<void>> {
  const huskyFile = path.join(projectRoot, '.husky', 'pre-commit');

  const commands = hooks.map((h) => h.command).join('\n');
  const block = `\n# Codi hooks\n${commands}\n`;

  try {
    let existing = '';
    try {
      existing = await fs.readFile(huskyFile, 'utf-8');
    } catch {
      // file doesn't exist yet
    }
    await fs.writeFile(huskyFile, existing + block, { encoding: 'utf-8', mode: 0o755 });
    return ok(undefined);
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'husky',
      reason: `Failed to write husky hook: ${(cause as Error).message}`,
    })]);
  }
}

async function installPreCommitFramework(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<void>> {
  const configPath = path.join(projectRoot, '.pre-commit-config.yaml');

  const localHooks = hooks.map((h) => [
    `  - id: ${h.name}`,
    `    name: ${h.name}`,
    `    entry: ${h.command}`,
    `    language: system`,
    `    files: '${h.stagedFilter}'`,
  ].join('\n')).join('\n');

  const block = `\n# Codi hooks\n- repo: local\n  hooks:\n${localHooks}\n`;

  try {
    let existing = '';
    try {
      existing = await fs.readFile(configPath, 'utf-8');
    } catch {
      // file doesn't exist yet
    }
    await fs.writeFile(configPath, existing + block, 'utf-8');
    return ok(undefined);
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'pre-commit-config',
      reason: `Failed to write config: ${(cause as Error).message}`,
    })]);
  }
}

export async function installHooks(options: InstallOptions): Promise<Result<void>> {
  const { projectRoot, runner, hooks, flags } = options;

  if (hooks.length === 0) {
    return ok(undefined);
  }

  switch (runner) {
    case 'none':
      return installStandalone(projectRoot, hooks, flags);
    case 'husky':
      return installHusky(projectRoot, hooks);
    case 'pre-commit':
      return installPreCommitFramework(projectRoot, hooks);
    case 'lefthook':
      // Lefthook uses similar approach to standalone
      return installStandalone(projectRoot, hooks, flags);
    default:
      return err([createError('E_HOOK_FAILED', {
        hook: 'install',
        reason: `Unsupported runner: ${runner as string}`,
      })]);
  }
}

export { buildRunnerScript, buildSecretScanScript, buildFileSizeScript };
