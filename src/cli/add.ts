import type { Command } from 'commander';
import { resolveCodiDir } from '../utils/paths.js';
import { createRule } from '../core/scaffolder/rule-scaffolder.js';
import { createSkill } from '../core/scaffolder/skill-scaffolder.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface AddRuleOptions extends GlobalOptions {
  template?: string;
}

interface AddRuleData {
  name: string;
  path: string;
  template: string | null;
}

export async function addRuleHandler(
  projectRoot: string,
  name: string,
  options: AddRuleOptions,
): Promise<CommandResult<AddRuleData>> {
  const codiDir = resolveCodiDir(projectRoot);

  if (options.template && !AVAILABLE_TEMPLATES.includes(options.template)) {
    return createCommandResult({
      success: false,
      command: 'add rule',
      data: { name, path: '', template: options.template },
      errors: [{
        code: 'E_CONFIG_INVALID',
        message: `Unknown template "${options.template}". Available: ${AVAILABLE_TEMPLATES.join(', ')}`,
        hint: `Use one of: ${AVAILABLE_TEMPLATES.join(', ')}`,
        severity: 'error',
        context: { template: options.template },
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createRule({
    name,
    codiDir,
    template: options.template,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: 'add rule',
      data: { name, path: '', template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: 'add rule',
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface AddSkillOptions extends GlobalOptions {
  template?: string;
}

interface AddSkillData {
  name: string;
  path: string;
  template: string | null;
}

export async function addSkillHandler(
  projectRoot: string,
  name: string,
  options: AddSkillOptions,
): Promise<CommandResult<AddSkillData>> {
  const codiDir = resolveCodiDir(projectRoot);

  if (options.template && !AVAILABLE_SKILL_TEMPLATES.includes(options.template)) {
    return createCommandResult({
      success: false,
      command: 'add skill',
      data: { name, path: '', template: options.template },
      errors: [{
        code: 'E_CONFIG_INVALID',
        message: `Unknown skill template "${options.template}". Available: ${AVAILABLE_SKILL_TEMPLATES.join(', ')}`,
        hint: `Use one of: ${AVAILABLE_SKILL_TEMPLATES.join(', ')}`,
        severity: 'error',
        context: { template: options.template },
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createSkill({
    name,
    codiDir,
    template: options.template,
  });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: 'add skill',
      data: { name, path: '', template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: 'add skill',
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerAddCommand(program: Command): void {
  const addCmd = program
    .command('add')
    .description('Add resources to the .codi/ configuration');

  addCmd
    .command('rule <name>')
    .description('Add a new custom rule')
    .option(
      '-t, --template <template>',
      `Use a template (${AVAILABLE_TEMPLATES.join(', ')})`,
    )
    .action(async (name: string, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddRuleOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await addRuleHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command('skill <name>')
    .description('Add a new custom skill')
    .option(
      '-t, --template <template>',
      `Use a skill template (${AVAILABLE_SKILL_TEMPLATES.join(', ')})`,
    )
    .action(async (name: string, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddSkillOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);
      const result = await addSkillHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
