import type { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { resolveCodiDir } from '../utils/paths.js';
import { registerAllAdapters } from '../adapters/index.js';
import { detectAdapters, getAllAdapters } from '../core/generator/adapter-registry.js';
import { getPreset } from '../core/flags/flag-presets.js';
import type { PresetName } from '../core/flags/flag-presets.js';
import { DEFAULT_PRESET, MANIFEST_FILENAME, FLAGS_FILENAME } from '../constants.js';
import { resolveConfig } from '../core/config/resolver.js';
import { generate } from '../core/generator/generator.js';
import { createRule } from '../core/scaffolder/rule-scaffolder.js';
import { createSkill } from '../core/scaffolder/skill-scaffolder.js';
import { createAgent } from '../core/scaffolder/agent-scaffolder.js';
import { createCommand } from '../core/scaffolder/command-scaffolder.js';
import { getBuiltinPresetDefinition } from '../templates/presets/index.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import { Logger } from '../core/output/logger.js';
import type { CommandResult } from '../core/output/types.js';
import { runInitWizard } from './init-wizard.js';
import { initFromOptions, handleOutput } from './shared.js';
import { detectHookSetup } from '../core/hooks/hook-detector.js';
import { generateHooksConfig } from '../core/hooks/hook-config-generator.js';
import { installHooks } from '../core/hooks/hook-installer.js';
import { checkHookDependencies } from '../core/hooks/hook-dependency-checker.js';
import type { GlobalOptions } from './shared.js';
import { VERSION } from '../index.js';

interface InitOptions extends GlobalOptions {
  force?: boolean;
  agents?: string[];
  preset?: string;
}

interface InitData {
  codiDir: string;
  agents: string[];
  stack: string[];
  generated: boolean;
  preset: string;
  rules: string[];
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

function isInteractive(options: InitOptions): boolean {
  return !options.json && !options.quiet && !options.agents;
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
        data: { codiDir, agents: [], stack: [], generated: false, preset: DEFAULT_PRESET, rules: [] },
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
  let presetName: PresetName = (options.preset as PresetName) ?? DEFAULT_PRESET;
  let ruleTemplates: string[] = [];
  let skillTemplates: string[] = [];
  let agentTemplates: string[] = [];
  let commandTemplates: string[] = [];

  if (isInteractive(options)) {
    const detectedAdapters = await detectAdapters(projectRoot);
    const detectedAgentIds = detectedAdapters.map((a) => a.id);
    const allAgentIds = getAllAdapters().map((a) => a.id);

    const wizardResult = await runInitWizard(stack, detectedAgentIds, allAgentIds);
    if (!wizardResult) {
      return createCommandResult({
        success: false,
        command: 'init',
        data: { codiDir, agents: [], stack, generated: false, preset: DEFAULT_PRESET, rules: [] },
        errors: [{ code: 'E_CONFIG_INVALID', message: 'Setup cancelled.', hint: '', severity: 'error', context: {} }],
        exitCode: EXIT_CODES.GENERAL_ERROR,
      });
    }

    agentIds = wizardResult.agents;
    presetName = wizardResult.preset;

    if (wizardResult.configMode === 'preset' && wizardResult.presetName) {
      // Built-in preset: get artifacts from preset definition
      const presetDef = getBuiltinPresetDefinition(wizardResult.presetName);
      if (presetDef) {
        ruleTemplates = [...presetDef.rules];
        skillTemplates = [...presetDef.skills];
        agentTemplates = [...presetDef.agents];
        commandTemplates = [...presetDef.commands];
      }
    } else {
      // Custom: use wizard selections
      ruleTemplates = wizardResult.rules;
      skillTemplates = wizardResult.skills;
      agentTemplates = wizardResult.agentTemplates;
      commandTemplates = wizardResult.commandTemplates;
    }

    await createCodiStructure(codiDir, agentIds, presetName, wizardResult.versionPin);
  } else {
    if (options.agents && options.agents.length > 0) {
      const knownIds = new Set(getAllAdapters().map((a) => a.id));
      const unknownAgents = options.agents.filter((id) => !knownIds.has(id));
      if (unknownAgents.length > 0) {
        return createCommandResult({
          success: false,
          command: 'init',
          data: { codiDir, agents: [], stack, generated: false, preset: presetName, rules: [] },
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
    } else {
      const detectedAdapters = await detectAdapters(projectRoot);
      agentIds = detectedAdapters.map((a) => a.id);
    }

    log.info(`Using agents: ${agentIds.join(', ')}`);
    await createCodiStructure(codiDir, agentIds, presetName, false);
  }

  for (const template of ruleTemplates) {
    const result = await createRule({ name: template, codiDir, template });
    if (!result.ok) {
      log.warn(`Failed to create rule "${template}": ${result.errors[0]?.message ?? 'unknown error'}`);
    }
  }

  for (const template of skillTemplates) {
    const result = await createSkill({ name: template, codiDir, template });
    if (!result.ok) {
      log.warn(`Failed to create skill "${template}": ${result.errors[0]?.message ?? 'unknown error'}`);
    }
  }

  for (const template of agentTemplates) {
    const result = await createAgent({ name: template, codiDir, template });
    if (!result.ok) {
      log.warn(`Failed to create agent "${template}": ${result.errors[0]?.message ?? 'unknown error'}`);
    }
  }

  for (const template of commandTemplates) {
    const result = await createCommand({ name: template, codiDir, template });
    if (!result.ok) {
      log.warn(`Failed to create command "${template}": ${result.errors[0]?.message ?? 'unknown error'}`);
    }
  }

  let generated = false;
  const configResult = await resolveConfig(projectRoot);
  if (configResult.ok) {
    const genResult = await generate(configResult.data, projectRoot);
    generated = genResult.ok;
    if (!genResult.ok) {
      log.warn('Generation after init failed; you can run `codi generate` later.');
    }
  }

  // Install pre-commit hooks
  let hooksInstalled = false;
  if (configResult.ok) {
    try {
      const hookSetup = await detectHookSetup(projectRoot);
      const resolvedFlags = configResult.data.flags;
      const hooksConfig = generateHooksConfig(resolvedFlags, stack);
      if (hooksConfig.hooks.length > 0) {
        const hookResult = await installHooks({
          projectRoot,
          runner: hookSetup.runner,
          hooks: hooksConfig.hooks,
          flags: resolvedFlags,
          commitMsgValidation: hooksConfig.commitMsgValidation,
          secretScan: hooksConfig.secretScan,
          fileSizeCheck: hooksConfig.fileSizeCheck,
          versionCheck: hooksConfig.versionCheck,
        });
        hooksInstalled = hookResult.ok;
        if (hookResult.ok) {
          log.info(`Pre-commit hooks installed (${hookSetup.runner === 'none' ? 'standalone' : hookSetup.runner})`);
          const missingDeps = await checkHookDependencies(hooksConfig.hooks);
          if (missingDeps.length > 0) {
            log.warn('Missing hook tools — install before committing:');
            for (const dep of missingDeps) {
              log.warn(`  ${dep.name}: ${dep.installHint}`);
            }
          }
        } else {
          log.warn('Hook installation failed; you can set up hooks manually.');
        }
      }
    } catch {
      log.warn('Hook detection failed; skipping hook installation.');
    }
  }

  return createCommandResult({
    success: true,
    command: 'init',
    data: { codiDir, agents: agentIds, stack, generated, preset: presetName, rules: ruleTemplates, hooksInstalled },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

async function createCodiStructure(
  codiDir: string,
  agents: string[],
  preset: PresetName,
  versionPin: boolean,
): Promise<void> {
  const dirs = [
    codiDir,
    path.join(codiDir, 'rules', 'generated', 'common'),
    path.join(codiDir, 'rules', 'custom'),
    path.join(codiDir, 'skills'),
    path.join(codiDir, 'frameworks'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  const manifest: Record<string, unknown> = {
    name: path.basename(path.dirname(codiDir)),
    version: '1',
    agents,
  };
  if (versionPin) {
    manifest['codi'] = { requiredVersion: `>=${VERSION}` };
  }
  await fs.writeFile(
    path.join(codiDir, MANIFEST_FILENAME),
    stringifyYaml(manifest),
    'utf-8',
  );

  const presetFlags = getPreset(preset);
  const flagsObj: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(presetFlags)) {
    const entry: Record<string, unknown> = { mode: def.mode, value: def.value };
    if (def.locked) entry['locked'] = true;
    flagsObj[key] = entry;
  }
  await fs.writeFile(
    path.join(codiDir, FLAGS_FILENAME),
    stringifyYaml(flagsObj),
    'utf-8',
  );
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new .codi/ configuration directory')
    .option('--force', 'Reinitialize even if .codi/ exists')
    .option('--agents <agents...>', 'Specify agent IDs (skips wizard)')
    .option('--preset <preset>', 'Flag preset: minimal, balanced, strict (default: balanced)')
    .action(async (cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: InitOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await initHandler(process.cwd(), options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
