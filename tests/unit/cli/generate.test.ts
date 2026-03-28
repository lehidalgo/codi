import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { generateHandler } from '../../../src/cli/generate.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('generate command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-gen-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails when no .codi/ directory exists', async () => {
    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
  });

  it('generates files for configured agents', async () => {
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

    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.agents).toContain('claude-code');
    expect(result.data.filesGenerated).toBeGreaterThanOrEqual(0);
  });

  it('supports --dry-run without writing files', async () => {
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

    const result = await generateHandler(tmpDir, { dryRun: true });
    expect(result.success).toBe(true);

    // state.json should not be written in dry-run mode
    const stateExists = await fs.access(path.join(codiDir, 'state.json'))
      .then(() => true)
      .catch(() => false);
    expect(stateExists).toBe(false);
  });
});
