import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { registerAllAdapters } from '../adapters/index.js';
import { detectAdapters, getAllAdapters } from '../core/generator/adapter-registry.js';
import { getDefaultFlags } from '../core/flags/flag-catalog.js';
import { resolveConfig } from '../core/config/resolver.js';
import { generate } from '../core/generator/generator.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface InitOptions extends GlobalOptions {
  force?: boolean;
  agents?: string[];
}

interface InitData {
  codiDir: string;
  agents: string[];
  stack: string[];
  generated: boolean;
}

const STACK_INDICATORS: Record<string, string> = {
  'package.json': 'node',
  'pyproject.toml': 'python',
  'go.mod': 'go',
  'Cargo.toml': 'rust',
};

async function detectStack(projectRoot: string): Promise<string[]> {
  const detected: string[] = [];
  for (const [file, stack] of Object.entries(STACK_INDICATORS)) {
    try {
      await fs.access(path.join(projectRoot, file));
      detected.push(stack);
    } catch {
      // File not found, skip
    }
  }
  return detected;
}

export async function initHandler(
  projectRoot: string,
  options: InitOptions,
): Promise<CommandResult<InitData>> {
  const log = Logger.getInstance();
  const codiDir = resolveCodiDir(projectRoot);

  try {
    await fs.access(codiDir);
    if (!options.force) {
      return createCommandResult({
        success: false,
        command: 'init',
        data: { codiDir, agents: [], stack: [], generated: false },
        errors: [{
          code: 'E_CONFIG_INVALID',
          message: `.codi/ directory already exists. Use --force to reinitialize.`,
          hint: 'Use --force to reinitialize.',
          severity: 'error',
          context: { codiDir },
        }],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
  } catch {
    // Directory does not exist, proceed
  }

  const stack = await detectStack(projectRoot);
  log.info(`Detected stack: ${stack.length > 0 ? stack.join(', ') : 'none'}`);

  registerAllAdapters();

  let agentIds: string[];
  if (options.agents && options.agents.length > 0) {
    const knownIds = new Set(getAllAdapters().map((a) => a.id));
    const unknownAgents = options.agents.filter((id) => !knownIds.has(id));
    if (unknownAgents.length > 0) {
      return createCommandResult({
        success: false,
        command: 'init',
        data: { codiDir, agents: [], stack, generated: false },
        errors: [{
          code: 'E_CONFIG_INVALID',
          message: `Unknown agent(s): ${unknownAgents.join(', ')}. Known: ${[...knownIds].join(', ')}`,
          hint: `Available agents: ${[...knownIds].join(', ')}`,
          severity: 'error',
          context: { unknownAgents },
        }],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }
    agentIds = options.agents;
    log.info(`Using specified agents: ${agentIds.join(', ')}`);
  } else {
    const detectedAdapters = await detectAdapters(projectRoot);
    agentIds = detectedAdapters.map((a) => a.id);
    log.info(`Detected agents: ${agentIds.length > 0 ? agentIds.join(', ') : 'none'}`);
  }

  await createCodiStructure(codiDir, agentIds);

  let generated = false;
  const configResult = await resolveConfig(projectRoot);
  if (configResult.ok) {
    const genResult = await generate(configResult.data, projectRoot);
    generated = genResult.ok;
    if (!genResult.ok) {
      log.warn('Generation after init failed; you can run `codi generate` later.');
    }
  }

  return createCommandResult({
    success: true,
    command: 'init',
    data: { codiDir, agents: agentIds, stack, generated },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

async function createCodiStructure(codiDir: string, agents: string[]): Promise<void> {
  const dirs = [
    codiDir,
    path.join(codiDir, 'rules', 'generated', 'common'),
    path.join(codiDir, 'rules', 'custom'),
    path.join(codiDir, 'skills'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const manifest = {
    name: path.basename(path.dirname(codiDir)),
    version: '1' as const,
    agents,
  };
  await fs.writeFile(
    path.join(codiDir, 'codi.yaml'),
    stringifyYaml(manifest),
    'utf-8',
  );

  const defaultFlags = getDefaultFlags();
  const flagsObj: Record<string, unknown> = {};
  for (const [key, flag] of Object.entries(defaultFlags)) {
    flagsObj[key] = { mode: flag.mode, value: flag.value };
  }
  await fs.writeFile(
    path.join(codiDir, 'flags.yaml'),
    stringifyYaml(flagsObj),
    'utf-8',
  );
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new .codi/ configuration directory')
    .option('--force', 'Reinitialize even if .codi/ exists')
    .option('--agents <agents...>', 'Specify agent IDs instead of auto-detecting (claude-code, cursor, codex, windsurf, cline)')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: InitOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await initHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
