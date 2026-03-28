import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { validateHandler } from '../../../src/cli/validate.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('validate command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-val-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails when no .codi/ directory exists', async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.data.valid).toBe(false);
  });

  it('reports valid config', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'rules'), { recursive: true });

    const manifest = { name: 'test', version: '1', agents: ['claude-code'] };
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      stringifyYaml(manifest),
      'utf-8',
    );
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({}),
      'utf-8',
    );

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
    expect(result.data.errorCount).toBe(0);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('reports invalid agents', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'rules'), { recursive: true });

    const manifest = { name: 'test', version: '1', agents: ['nonexistent-agent'] };
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      stringifyYaml(manifest),
      'utf-8',
    );
    await fs.writeFile(
      path.join(codiDir, 'flags.yaml'),
      stringifyYaml({}),
      'utf-8',
    );

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
    expect(result.data.valid).toBe(false);
    expect(result.data.errorCount).toBeGreaterThan(0);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_INVALID);
  });
});
