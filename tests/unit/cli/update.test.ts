import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { updateHandler } from '../../../src/cli/update.js';
import { Logger } from '../../../src/core/output/logger.js';

describe('update command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-update-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });

    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'rules', 'custom'), { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      stringifyYaml({ name: 'test', version: '1', agents: ['claude-code'] }),
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('adds missing flags from catalog', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.flagsAdded.length).toBeGreaterThan(0);
    expect(result.data.flagsAdded).toContain('security_scan');

    const updated = parseYaml(await fs.readFile(path.join(codiDir, 'flags.yaml'), 'utf-8')) as Record<string, unknown>;
    expect(updated['security_scan']).toBeDefined();
    expect(updated['auto_commit']).toBeDefined();
  });

  it('resets flags to preset', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: true } }),
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true, preset: 'strict' });
    expect(result.success).toBe(true);
    expect(result.data.flagsReset).toBe(true);
    expect(result.data.preset).toBe('strict');

    const updated = parseYaml(await fs.readFile(path.join(codiDir, 'flags.yaml'), 'utf-8')) as Record<string, unknown>;
    const secScan = updated['security_scan'] as Record<string, unknown>;
    expect(secScan['mode']).toBe('enforced');
    expect(secScan['locked']).toBe(true);
  });

  it('dry-run does not write', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    const original = stringifyYaml({ auto_commit: { mode: 'enabled', value: false } });
    await fs.writeFile(path.join(codiDir, 'flags.yaml'), original, 'utf-8');

    const result = await updateHandler(tmpDir, { json: true, preset: 'strict', dryRun: true });
    expect(result.success).toBe(true);

    const afterContent = await fs.readFile(path.join(codiDir, 'flags.yaml'), 'utf-8');
    expect(afterContent).toBe(original);
  });

  it('fails if no .codi/ exists', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-empty-'));
    const result = await updateHandler(emptyDir, { json: true });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe('E_CONFIG_NOT_FOUND');
    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it('rejects invalid preset name', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true, preset: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.errors[0]!.code).toBe('E_CONFIG_INVALID');
  });

  it('refreshes codi-managed rules with --rules', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );

    // Create a codi-managed rule with a matching template name
    await fs.writeFile(
      path.join(codiDir, 'rules', 'custom', 'security.md'),
      '---\nname: security\nmanaged_by: codi\n---\nold content',
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toContain('security');
  });

  it('skips user-managed rules with --rules', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );

    await fs.writeFile(
      path.join(codiDir, 'rules', 'custom', 'my-custom.md'),
      '---\nname: my-custom\nmanaged_by: user\n---\nmy content',
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesSkipped).toContain('my-custom');
    expect(result.data.rulesUpdated).not.toContain('my-custom');
  });

  it('handles missing rules directory gracefully with --rules', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );
    // Remove the custom rules dir
    await fs.rm(path.join(codiDir, 'rules'), { recursive: true, force: true });

    const result = await updateHandler(tmpDir, { json: true, rules: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toEqual([]);
  });

  it('does not update rules/skills/agents when flags not passed', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({ auto_commit: { mode: 'enabled', value: false } }),
      'utf-8',
    );

    const result = await updateHandler(tmpDir, { json: true, dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data.rulesUpdated).toEqual([]);
    expect(result.data.skillsUpdated).toEqual([]);
    expect(result.data.agentsUpdated).toEqual([]);
    expect(result.data.commandsUpdated).toEqual([]);
  });
});
