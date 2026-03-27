import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { Logger } from '../../../src/core/output/logger.js';

/**
 * Tests that registerXxxCommand functions correctly wire up
 * subcommands to Commander without crashing during registration.
 * The actual handler logic is tested in dedicated handler test files.
 */

describe('registerAddCommand', () => {
  beforeEach(() => {
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  it('registers add command with rule/skill/agent/command subcommands', async () => {
    const { registerAddCommand } = await import('../../../src/cli/add.js');
    const program = new Command();
    program.option('-j, --json');
    registerAddCommand(program);

    const addCmd = program.commands.find(c => c.name() === 'add');
    expect(addCmd).toBeDefined();

    const subNames = addCmd!.commands.map(c => c.name());
    expect(subNames).toContain('rule');
    expect(subNames).toContain('skill');
    expect(subNames).toContain('agent');
    expect(subNames).toContain('command');
  }, 15000);
});

describe('registerPresetCommand', () => {
  beforeEach(() => {
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  it('registers preset command with all subcommands', async () => {
    const { registerPresetCommand } = await import('../../../src/cli/preset.js');
    const program = new Command();
    program.option('-j, --json');
    registerPresetCommand(program);

    const presetCmd = program.commands.find(c => c.name() === 'preset');
    expect(presetCmd).toBeDefined();

    const subNames = presetCmd!.commands.map(c => c.name());
    expect(subNames).toContain('create');
    expect(subNames).toContain('list');
    expect(subNames).toContain('install');
    expect(subNames).toContain('export');
    expect(subNames).toContain('validate');
    expect(subNames).toContain('remove');
    expect(subNames).toContain('edit');
    expect(subNames).toContain('search');
    expect(subNames).toContain('update');
  });
});

describe('registerUpdateCommand', () => {
  beforeEach(() => {
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  it('registers update command with expected options', async () => {
    const { registerUpdateCommand } = await import('../../../src/cli/update.js');
    const program = new Command();
    program.option('-j, --json');
    registerUpdateCommand(program);

    const updateCmd = program.commands.find(c => c.name() === 'update');
    expect(updateCmd).toBeDefined();

    const optionNames = updateCmd!.options.map(o => o.long);
    expect(optionNames).toContain('--preset');
    expect(optionNames).toContain('--rules');
    expect(optionNames).toContain('--skills');
    expect(optionNames).toContain('--dry-run');
  });
});

describe('registerRevertCommand', () => {
  it('registers revert command with --list, --last, --backup options', async () => {
    const { registerRevertCommand } = await import('../../../src/cli/revert.js');
    const program = new Command();
    program.option('-j, --json');
    registerRevertCommand(program);

    const revertCmd = program.commands.find(c => c.name() === 'revert');
    expect(revertCmd).toBeDefined();

    const optionNames = revertCmd!.options.map(o => o.long);
    expect(optionNames).toContain('--list');
    expect(optionNames).toContain('--last');
    expect(optionNames).toContain('--backup');
  });
});
