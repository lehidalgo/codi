import fs from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../../types/result.js';
import { ok, err } from '../../types/result.js';
import { createError } from '../output/errors.js';
import type { HookSetup } from './hook-detector.js';
import type { HookEntry } from './hook-registry.js';
import type { ResolvedFlags } from '../../types/flags.js';
import { RUNNER_TEMPLATE, SECRET_SCAN_TEMPLATE, FILE_SIZE_CHECK_TEMPLATE, COMMIT_MSG_TEMPLATE, VERSION_CHECK_TEMPLATE } from './hook-templates.js';
import { PRE_COMMIT_MAX_FILE_LINES } from '../../constants.js';

export interface HookInstallResult {
  files: string[];
}

export interface InstallOptions {
  projectRoot: string;
  runner: HookSetup['runner'];
  hooks: HookEntry[];
  flags: ResolvedFlags;
  commitMsgValidation?: boolean;
  secretScan?: boolean;
  fileSizeCheck?: boolean;
  versionCheck?: boolean;
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

async function writeAuxiliaryScripts(hookDir: string, options: InstallOptions): Promise<string[]> {
  const files: string[] = [];
  if (options.secretScan) {
    const secretPath = path.join(hookDir, 'codi-secret-scan.mjs');
    const secretScript = buildSecretScanScript();
    await fs.writeFile(secretPath, secretScript, { encoding: 'utf-8', mode: 0o755 });
    files.push(path.relative(options.projectRoot, secretPath));
  }
  if (options.fileSizeCheck) {
    const sizePath = path.join(hookDir, 'codi-file-size-check.mjs');
    const sizeScript = buildFileSizeScript(PRE_COMMIT_MAX_FILE_LINES);
    await fs.writeFile(sizePath, sizeScript, { encoding: 'utf-8', mode: 0o755 });
    files.push(path.relative(options.projectRoot, sizePath));
  }
  if (options.versionCheck) {
    const versionPath = path.join(hookDir, 'codi-version-check.mjs');
    await fs.writeFile(versionPath, VERSION_CHECK_TEMPLATE, { encoding: 'utf-8', mode: 0o755 });
    files.push(path.relative(options.projectRoot, versionPath));
  }
  return files;
}

async function installStandalone(
  projectRoot: string,
  hooks: HookEntry[],
  _flags: ResolvedFlags,
  options: InstallOptions,
): Promise<Result<HookInstallResult>> {
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
    const files: string[] = [path.relative(projectRoot, hookPath)];
    const auxFiles = await writeAuxiliaryScripts(hookDir, options);
    files.push(...auxFiles);
    return ok({ files });
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'pre-commit',
      reason: `Failed to write hook: ${(cause as Error).message}`,
    })]);
  }
}

function stripCodiSection(content: string): string {
  const lines = content.split('\n');
  const filtered: string[] = [];
  let inCodiSection = false;

  for (const line of lines) {
    if (line.trim() === '# Codi hooks') {
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

  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}

async function installHusky(
  projectRoot: string,
  hooks: HookEntry[],
): Promise<Result<HookInstallResult>> {
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

    // Remove any existing codi section before appending to prevent duplicates
    const cleaned = stripCodiSection(existing);
    await fs.writeFile(huskyFile, cleaned + block, { encoding: 'utf-8', mode: 0o755 });
    return ok({ files: [path.relative(projectRoot, huskyFile)] });
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
): Promise<Result<HookInstallResult>> {
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
    return ok({ files: [path.relative(projectRoot, configPath)] });
  } catch (cause) {
    return err([createError('E_HOOK_FAILED', {
      hook: 'pre-commit-config',
      reason: `Failed to write config: ${(cause as Error).message}`,
    })]);
  }
}

async function installCommitMsgHook(projectRoot: string, runner: string): Promise<Result<HookInstallResult>> {
  if (runner === 'none' || runner === 'lefthook') {
    const hookDir = path.join(projectRoot, '.git', 'hooks');
    try {
      await fs.mkdir(hookDir, { recursive: true });
      const hookPath = path.join(hookDir, 'commit-msg');
      await fs.writeFile(hookPath, COMMIT_MSG_TEMPLATE, { encoding: 'utf-8', mode: 0o755 });
      return ok({ files: [path.relative(projectRoot, hookPath)] });
    } catch (cause) {
      return err([createError('E_HOOK_FAILED', {
        hook: 'commit-msg',
        reason: `Failed to write commit-msg hook: ${(cause as Error).message}`,
      })]);
    }
  }
  if (runner === 'husky') {
    const huskyFile = path.join(projectRoot, '.husky', 'commit-msg');
    try {
      await fs.writeFile(huskyFile, `# Codi hooks\n${COMMIT_MSG_TEMPLATE}`, { encoding: 'utf-8', mode: 0o755 });
      return ok({ files: [path.relative(projectRoot, huskyFile)] });
    } catch (cause) {
      return err([createError('E_HOOK_FAILED', {
        hook: 'commit-msg',
        reason: `Failed to write husky commit-msg: ${(cause as Error).message}`,
      })]);
    }
  }
  return ok({ files: [] });
}

export async function installHooks(options: InstallOptions): Promise<Result<HookInstallResult>> {
  const { projectRoot, runner, hooks, flags } = options;

  if (hooks.length === 0) {
    return ok({ files: [] });
  }

  const allFiles: string[] = [];

  if (options.commitMsgValidation) {
    const msgResult = await installCommitMsgHook(projectRoot, runner);
    if (!msgResult.ok) return msgResult;
    allFiles.push(...msgResult.data.files);
  }

  let runnerResult: Result<HookInstallResult>;
  switch (runner) {
    case 'none':
      runnerResult = await installStandalone(projectRoot, hooks, flags, options);
      break;
    case 'husky':
      runnerResult = await installHusky(projectRoot, hooks);
      break;
    case 'pre-commit':
      runnerResult = await installPreCommitFramework(projectRoot, hooks);
      break;
    case 'lefthook':
      runnerResult = await installStandalone(projectRoot, hooks, flags, options);
      break;
    default:
      return err([createError('E_HOOK_FAILED', {
        hook: 'install',
        reason: `Unsupported runner: ${runner as string}`,
      })]);
  }

  if (!runnerResult.ok) return runnerResult;
  allFiles.push(...runnerResult.data.files);

  return ok({ files: allFiles });
}

export { buildRunnerScript, buildSecretScanScript, buildFileSizeScript, stripCodiSection };
