import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { windsurfAdapter } from '../../../src/adapters/windsurf.js';
import { createMockConfig } from './mock-config.js';

describe('windsurf adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-windsurf-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct id and name', () => {
    expect(windsurfAdapter.id).toBe('windsurf');
    expect(windsurfAdapter.name).toBe('Windsurf');
  });

  it('detects when .windsurfrules exists', async () => {
    await writeFile(join(tmpDir, '.windsurfrules'), '# Rules');
    expect(await windsurfAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await windsurfAdapter.detect(tmpDir)).toBe(false);
  });

  it('generates .windsurfrules with rules (no flags section)', async () => {
    const config = createMockConfig({ flags: {} });
    const files = await windsurfAdapter.generate(config, {});

    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe('.windsurfrules');
    expect(files[0]!.content).toContain('# Code Style');
    expect(files[0]!.content).toContain('# Testing');
    expect(files[0]!.content).not.toContain('Do NOT');
  });

  it('includes flag instructions when flags are set', async () => {
    const config = createMockConfig();
    const files = await windsurfAdapter.generate(config, {});

    expect(files[0]!.content).toContain('Do NOT execute shell commands.');
  });
});
