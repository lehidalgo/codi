import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ciHandler } from '../../../src/cli/ci.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('ci command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-ci-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails when no .codi/ directory exists', async () => {
    const result = await ciHandler(tmpDir);

    expect(result.success).toBe(false);
    expect(result.command).toBe('ci');
    expect(result.data.configValid).toBe(false);
    expect(result.data.allPassed).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.DOCTOR_FAILED);
  });

  it('passes with a valid minimal config', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\n',
      'utf-8',
    );

    const result = await ciHandler(tmpDir);

    expect(result.command).toBe('ci');
    expect(result.data.configValid).toBe(true);
    expect(result.data.doctorPassed).toBe(true);
    expect(result.data.allPassed).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('fails when config is valid but doctor finds version mismatch', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\ncodi:\n  requiredVersion: ">=99.0.0"\n',
      'utf-8',
    );

    const result = await ciHandler(tmpDir);

    expect(result.data.configValid).toBe(true);
    expect(result.data.doctorPassed).toBe(false);
    expect(result.data.allPassed).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.DOCTOR_FAILED);
  });

  it('collects errors from both validate and doctor', async () => {
    const result = await ciHandler(tmpDir);

    expect(result.errors.length).toBeGreaterThan(0);
  });
});
