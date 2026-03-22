import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clineAdapter } from '../../../src/adapters/cline.js';
import { createMockConfig } from './mock-config.js';

describe('cline adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-cline-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct id and name', () => {
    expect(clineAdapter.id).toBe('cline');
    expect(clineAdapter.name).toBe('Cline');
  });

  it('detects when .clinerules exists', async () => {
    await writeFile(join(tmpDir, '.clinerules'), '# Rules');
    expect(await clineAdapter.detect(tmpDir)).toBe(true);
  });

  it('detects when .cline/ directory exists', async () => {
    await mkdir(join(tmpDir, '.cline'), { recursive: true });
    expect(await clineAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await clineAdapter.detect(tmpDir)).toBe(false);
  });

  it('generates .clinerules with rules and flag instructions', async () => {
    const config = createMockConfig();
    const files = await clineAdapter.generate(config, {});

    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe('.clinerules');
    expect(files[0]!.content).toContain('Do NOT execute shell commands.');
    expect(files[0]!.content).toContain('Write tests for all new code.');
    expect(files[0]!.content).toContain('Code Style');
    expect(files[0]!.hash).toBeTruthy();
  });
});
