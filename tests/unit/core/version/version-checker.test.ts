import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  checkCodiVersion,
  checkGeneratedFreshness,
  checkCodiDirectory,
  runAllChecks,
} from '../../../../src/core/version/version-checker.js';

describe('checkCodiVersion', () => {
  it('passes when version satisfies exact match', () => {
    // This tests against the actual package version
    const result = checkCodiVersion('>=0.0.1');
    expect(result.check).toBe('codi-version');
    expect(result.passed).toBe(true);
  });

  it('fails when required version is impossibly high', () => {
    const result = checkCodiVersion('>=99.0.0');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('does not satisfy');
  });
});

describe('checkGeneratedFreshness', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-version-'));
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('passes when no state file exists', async () => {
    const results = await checkGeneratedFreshness(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
  });

  it('reports drift when tracked files are missing', async () => {
    const stateData = {
      version: '1',
      lastGenerated: new Date().toISOString(),
      agents: {
        'claude-code': [{
          path: 'CLAUDE.md',
          sourceHash: 'abc',
          generatedHash: 'def',
          sources: ['codi.yaml'],
          timestamp: new Date().toISOString(),
        }],
      },
    };
    await fs.writeFile(
      path.join(tmpDir, '.codi', 'state.json'),
      JSON.stringify(stateData),
    );

    const results = await checkGeneratedFreshness(tmpDir);
    const claudeResult = results.find((r) => r.check === 'drift-claude-code');
    expect(claudeResult).toBeDefined();
    expect(claudeResult!.passed).toBe(false);
    expect(claudeResult!.message).toContain('out of sync');
  });
});

describe('checkCodiDirectory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-doctor-dir-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails when .codi directory does not exist', async () => {
    const result = await checkCodiDirectory(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('.codi/ directory has issues');
  });

  it('passes with valid .codi directory', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\n`,
    );

    const result = await checkCodiDirectory(tmpDir);
    expect(result.passed).toBe(true);
  });
});

describe('runAllChecks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-all-checks-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns report with allPassed when everything is valid', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\n`,
    );

    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allPassed).toBe(true);
  });

  it('checks version requirement from manifest', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\ncodi:\n  requiredVersion: ">=99.0.0"\n`,
    );

    const result = await runAllChecks(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.allPassed).toBe(false);
    const versionResult = result.data.results.find((r) => r.check === 'codi-version');
    expect(versionResult).toBeDefined();
    expect(versionResult!.passed).toBe(false);
  });
});
