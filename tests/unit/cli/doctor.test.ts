import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { doctorHandler } from '../../../src/cli/doctor.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('doctor command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-doctor-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('passes with valid project', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.allPassed).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('fails with --ci when version mismatch', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\ncodi:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await doctorHandler(tmpDir, { ci: true });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.DOCTOR_FAILED);
  });

  it('succeeds without --ci even when checks fail', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\ncodi:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('fails when no .codi directory exists', async () => {
    const result = await doctorHandler(tmpDir, {});
    expect(result.success).toBe(false);
  });

  it('includes check results in data', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\n`,
    );

    const result = await doctorHandler(tmpDir, {});
    expect(result.data.results.length).toBeGreaterThan(0);
    expect(result.data.results.every((r) => typeof r.check === 'string')).toBe(true);
  });
});
