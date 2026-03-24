import type { Command } from 'commander';
import { resolveCodiDir } from '../utils/paths.js';
import { createRule } from '../core/scaffolder/rule-scaffolder.js';
import { createSkill } from '../core/scaffolder/skill-scaffolder.js';
import { createAgent } from '../core/scaffolder/agent-scaffolder.js';
import { createCommand } from '../core/scaffolder/command-scaffolder.js';
import { AVAILABLE_TEMPLATES } from '../core/scaffolder/template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from '../core/scaffolder/agent-template-loader.js';
import { AVAILABLE_SKILL_TEMPLATES } from '../core/scaffolder/skill-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from '../core/scaffolder/command-template-loader.js';
import { createCommandResult } from '../core/output/formatter.js';
import { EXIT_CODES } from '../core/output/exit-codes.js';
import type { CommandResult } from '../core/output/types.js';
import { initFromOptions, handleOutput } from './shared.js';
import type { GlobalOptions } from './shared.js';

interface AddRuleOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
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
  all?: boolean;
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

interface AddAgentOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddAgentData {
  name: string;
  path: string;
  template: string | null;
}

export async function addAgentHandler(
  projectRoot: string,
  name: string,
  options: { template?: string },
): Promise<CommandResult<AddAgentData>> {
  const codiDir = resolveCodiDir(projectRoot);

  if (options.template && !AVAILABLE_AGENT_TEMPLATES.includes(options.template)) {
    return createCommandResult({
      success: false,
      command: 'add agent',
      data: { name, path: '', template: options.template },
      errors: [{
        code: 'E_CONFIG_INVALID',
        message: `Unknown agent template "${options.template}". Available: ${AVAILABLE_AGENT_TEMPLATES.join(', ')}`,
        hint: `Use one of: ${AVAILABLE_AGENT_TEMPLATES.join(', ')}`,
        severity: 'error',
        context: { template: options.template },
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createAgent({ name, codiDir, template: options.template });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: 'add agent',
      data: { name, path: '', template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: 'add agent',
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

interface AddCommandOptions extends GlobalOptions {
  template?: string;
  all?: boolean;
}

interface AddCommandData {
  name: string;
  path: string;
  template: string | null;
}

export async function addCommandHandler(
  projectRoot: string,
  name: string,
  options: { template?: string },
): Promise<CommandResult<AddCommandData>> {
  const codiDir = resolveCodiDir(projectRoot);

  if (options.template && !AVAILABLE_COMMAND_TEMPLATES.includes(options.template)) {
    return createCommandResult({
      success: false,
      command: 'add command',
      data: { name, path: '', template: options.template },
      errors: [{
        code: 'E_CONFIG_INVALID',
        message: `Unknown command template "${options.template}". Available: ${AVAILABLE_COMMAND_TEMPLATES.join(', ')}`,
        hint: `Use one of: ${AVAILABLE_COMMAND_TEMPLATES.join(', ')}`,
        severity: 'error',
        context: { template: options.template },
      }],
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  const result = await createCommand({ name, codiDir, template: options.template });

  if (!result.ok) {
    return createCommandResult({
      success: false,
      command: 'add command',
      data: { name, path: '', template: options.template ?? null },
      errors: result.errors,
      exitCode: EXIT_CODES.GENERAL_ERROR,
    });
  }

  return createCommandResult({
    success: true,
    command: 'add command',
    data: { name, path: result.data, template: options.template ?? null },
    exitCode: EXIT_CODES.SUCCESS,
  });
}

export function registerAddCommand(program: Command): void {
  const addCmd = program
    .command('add')
    .description('Add resources to the .codi/ configuration');

  addCmd
    .command('rule [name]')
    .description('Add a new custom rule')
    .option(
      '-t, --template <template>',
      `Use a template (${AVAILABLE_TEMPLATES.join(', ')})`,
    )
    .option('--all', 'Add all available template rules')
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddRuleOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_TEMPLATES) {
          const result = await addRuleHandler(process.cwd(), tmpl, { ...options, template: tmpl });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        const summary = createCommandResult({
          success: true,
          command: 'add rule --all',
          data: { added, skipped, total: AVAILABLE_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name) {
        const err = createCommandResult({
          success: false,
          command: 'add rule',
          data: { name: '', path: '', template: null },
          errors: [{ code: 'E_CONFIG_INVALID', message: 'Rule name required. Use --all to add all templates.', hint: '', severity: 'error', context: {} }],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(err, options);
        process.exit(err.exitCode);
        return;
      }

      const result = await addRuleHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command('skill [name]')
    .description('Add a new custom skill')
    .option(
      '-t, --template <template>',
      `Use a skill template (${AVAILABLE_SKILL_TEMPLATES.join(', ')})`,
    )
    .option('--all', 'Add all available skill templates')
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddSkillOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_SKILL_TEMPLATES) {
          const result = await addSkillHandler(process.cwd(), tmpl, { ...options, template: tmpl });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        const summary = createCommandResult({
          success: true,
          command: 'add skill --all',
          data: { added, skipped, total: AVAILABLE_SKILL_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name) {
        const err = createCommandResult({
          success: false,
          command: 'add skill',
          data: { name: '', path: '', template: null },
          errors: [{ code: 'E_CONFIG_INVALID', message: 'Skill name required. Use --all to add all templates.', hint: '', severity: 'error', context: {} }],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(err, options);
        process.exit(err.exitCode);
        return;
      }

      const result = await addSkillHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command('agent [name]')
    .description('Add a new custom agent')
    .option(
      '-t, --template <template>',
      `Use an agent template (${AVAILABLE_AGENT_TEMPLATES.join(', ')})`,
    )
    .option('--all', 'Add all available agent templates')
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddAgentOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_AGENT_TEMPLATES) {
          const result = await addAgentHandler(process.cwd(), tmpl, { template: tmpl });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        const summary = createCommandResult({
          success: true,
          command: 'add agent --all',
          data: { added, skipped, total: AVAILABLE_AGENT_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name) {
        const errResult = createCommandResult({
          success: false,
          command: 'add agent',
          data: { name: '', path: '', template: null },
          errors: [{ code: 'E_CONFIG_INVALID', message: 'Agent name required. Use --all to add all templates.', hint: '', severity: 'error', context: {} }],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(errResult, options);
        process.exit(errResult.exitCode);
        return;
      }

      const result = await addAgentHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });

  addCmd
    .command('command [name]')
    .description('Add a new custom command')
    .option(
      '-t, --template <template>',
      `Use a command template (${AVAILABLE_COMMAND_TEMPLATES.join(', ')})`,
    )
    .option('--all', 'Add all available command templates')
    .action(async (name: string | undefined, cmdOptions: Record<string, unknown>) => {
      const globalOptions = program.opts() as GlobalOptions;
      const options: AddCommandOptions = { ...globalOptions, ...cmdOptions };
      initFromOptions(options);

      if (options.all) {
        const results: Array<{ name: string; success: boolean }> = [];
        for (const tmpl of AVAILABLE_COMMAND_TEMPLATES) {
          const result = await addCommandHandler(process.cwd(), tmpl, { template: tmpl });
          results.push({ name: tmpl, success: result.success });
        }
        const added = results.filter((r) => r.success).map((r) => r.name);
        const skipped = results.filter((r) => !r.success).map((r) => r.name);
        const summary = createCommandResult({
          success: true,
          command: 'add command --all',
          data: { added, skipped, total: AVAILABLE_COMMAND_TEMPLATES.length },
          exitCode: EXIT_CODES.SUCCESS,
        });
        handleOutput(summary, options);
        process.exit(summary.exitCode);
        return;
      }

      if (!name) {
        const errResult = createCommandResult({
          success: false,
          command: 'add command',
          data: { name: '', path: '', template: null },
          errors: [{ code: 'E_CONFIG_INVALID', message: 'Command name required. Use --all to add all templates.', hint: '', severity: 'error', context: {} }],
          exitCode: EXIT_CODES.GENERAL_ERROR,
        });
        handleOutput(errResult, options);
        process.exit(errResult.exitCode);
        return;
      }

      const result = await addCommandHandler(process.cwd(), name, options);
      handleOutput(result, options);
      process.exit(result.exitCode);
    });
}
