import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { addRuleHandler, addSkillHandler, addAgentHandler, addCommandHandler } from '../../../src/cli/add.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('add rule command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-add-'));
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a rule file without template', async () => {
    const result = await addRuleHandler(tmpDir, 'my-rule', {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('my-rule');
    expect(result.data.path).toContain('my-rule.md');
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('name: my-rule');
    expect(content).toContain('managed_by: user');
  });

  it('creates a rule file with security template', async () => {
    const result = await addRuleHandler(tmpDir, 'my-security', {
      template: 'security',
    });

    expect(result.success).toBe(true);
    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('name: my-security');
    expect(content).toContain('Security Rules');
    expect(content).toContain('priority: high');
  });

  it('creates a rule file with testing template', async () => {
    const result = await addRuleHandler(tmpDir, 'test-rules', {
      template: 'testing',
    });

    expect(result.success).toBe(true);
    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('Testing Standards');
  });

  it('fails with invalid rule name', async () => {
    const result = await addRuleHandler(tmpDir, 'Invalid_Name', {});
    expect(result.success).toBe(false);
  });

  it('fails with unknown template', async () => {
    const result = await addRuleHandler(tmpDir, 'my-rule', {
      template: 'nonexistent',
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('Unknown template');
  });

  it('fails if rule file already exists', async () => {
    await addRuleHandler(tmpDir, 'existing-rule', {});
    const result = await addRuleHandler(tmpDir, 'existing-rule', {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('already exists');
  });
});

describe('add skill command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-add-skill-'));
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a skill directory with SKILL.md', async () => {
    const result = await addSkillHandler(tmpDir, 'my-skill', {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('my-skill');
    expect(result.data.path).toContain('SKILL.md');
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('name: my-skill');
    expect(content).toContain('managed_by: user');
  });

  it('scaffolds skill subdirectories', async () => {
    const result = await addSkillHandler(tmpDir, 'test-skill', {});
    expect(result.success).toBe(true);

    const skillDir = path.join(tmpDir, '.codi', 'skills', 'test-skill');
    const dirs = ['evals', 'scripts', 'references', 'assets'];
    for (const dir of dirs) {
      const stat = await fs.stat(path.join(skillDir, dir));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it('creates evals.json in evals directory', async () => {
    await addSkillHandler(tmpDir, 'eval-skill', {});

    const evalsPath = path.join(tmpDir, '.codi', 'skills', 'eval-skill', 'evals', 'evals.json');
    const content = JSON.parse(await fs.readFile(evalsPath, 'utf-8'));
    expect(content.skill_name).toBe('eval-skill');
    expect(content.evals).toEqual([]);
  });

  it('fails with invalid skill name', async () => {
    const result = await addSkillHandler(tmpDir, 'Bad_Name', {});
    expect(result.success).toBe(false);
  });

  it('fails with unknown template', async () => {
    const result = await addSkillHandler(tmpDir, 'my-skill', { template: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('Unknown skill template');
  });

  it('fails if skill already exists', async () => {
    await addSkillHandler(tmpDir, 'dup-skill', {});
    const result = await addSkillHandler(tmpDir, 'dup-skill', {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('already exists');
  });
});

describe('add agent command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-add-agent-'));
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates an agent file without template', async () => {
    const result = await addAgentHandler(tmpDir, 'my-agent', {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('my-agent');
    expect(result.data.path).toContain('my-agent.md');

    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('name: my-agent');
    expect(content).toContain('managed_by: user');
    expect(content).toContain('tools:');
  });

  it('fails with invalid agent name', async () => {
    const result = await addAgentHandler(tmpDir, 'UPPER', {});
    expect(result.success).toBe(false);
  });

  it('fails with unknown template', async () => {
    const result = await addAgentHandler(tmpDir, 'my-agent', { template: 'fake' });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('Unknown agent template');
  });

  it('fails if agent already exists', async () => {
    await addAgentHandler(tmpDir, 'existing-agent', {});
    const result = await addAgentHandler(tmpDir, 'existing-agent', {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('already exists');
  });
});

describe('add command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-add-cmd-'));
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a command file without template', async () => {
    const result = await addCommandHandler(tmpDir, 'my-command', {});

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('my-command');
    expect(result.data.path).toContain('my-command.md');

    const content = await fs.readFile(result.data.path, 'utf-8');
    expect(content).toContain('name: my-command');
    expect(content).toContain('managed_by: user');
  });

  it('fails with invalid command name', async () => {
    const result = await addCommandHandler(tmpDir, 'has spaces', {});
    expect(result.success).toBe(false);
  });

  it('fails with unknown template', async () => {
    const result = await addCommandHandler(tmpDir, 'my-cmd', { template: 'bogus' });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('Unknown command template');
  });

  it('fails if command already exists', async () => {
    await addCommandHandler(tmpDir, 'dup-cmd', {});
    const result = await addCommandHandler(tmpDir, 'dup-cmd', {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('already exists');
  });
});
