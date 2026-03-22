import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { addRuleHandler } from '../../../src/cli/add.js';
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
    // Create first
    await addRuleHandler(tmpDir, 'existing-rule', {});
    // Try to create again
    const result = await addRuleHandler(tmpDir, 'existing-rule', {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('already exists');
  });
});
