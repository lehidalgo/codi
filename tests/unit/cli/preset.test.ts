import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parse as parseYaml } from 'yaml';
import { presetCreateHandler } from '../../../src/cli/preset.js';
import { Logger } from '../../../src/core/output/logger.js';
import { PRESET_MANIFEST_FILENAME, PRESET_LOCK_FILENAME } from '../../../src/constants.js';

describe('presetCreateHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-preset-create-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates preset directory with manifest', async () => {
    // Arrange
    const presetName = 'my-preset';

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe('create');
    expect(result.data.name).toBe(presetName);

    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    const stat = await fs.stat(presetDir);
    expect(stat.isDirectory()).toBe(true);

    const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(raw) as Record<string, unknown>;

    expect(manifest.name).toBe(presetName);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.artifacts).toEqual({
      rules: [],
      skills: [],
      agents: [],
      commands: [],
    });
  });

  it('returns error if preset already exists', async () => {
    // Arrange
    const presetName = 'existing-preset';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]!.message).toContain('already exists');
    expect(result.data.name).toBe(presetName);
  });

  it('creates nested preset names with slashes', async () => {
    // Arrange
    const presetName = 'org/team-preset';

    // Act
    const result = await presetCreateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);

    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    const stat = await fs.stat(presetDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('manifest has empty description field', async () => {
    // Arrange
    const presetName = 'check-desc';

    // Act
    await presetCreateHandler(tmpDir, presetName);

    // Assert
    const manifestPath = path.join(
      tmpDir, '.codi', 'presets', presetName, PRESET_MANIFEST_FILENAME,
    );
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = parseYaml(raw) as Record<string, unknown>;
    expect(manifest.description).toBe('');
  });
});

describe('presetUpdateHandler — empty lock file', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-preset-update-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('handles empty lock file (no presets to update)', async () => {
    // Arrange — create .codi dir with empty lock file
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, PRESET_LOCK_FILENAME),
      JSON.stringify({ presets: {} }, null, 2),
      'utf-8',
    );

    // presetUpdateHandler calls scanCodiDir which needs codi.yaml
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\n',
      'utf-8',
    );

    // Dynamic import to avoid top-level import issues with git mocking
    const { presetUpdateHandler } = await import('../../../src/cli/preset.js');

    // Act
    const result = await presetUpdateHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe('update');
    expect(result.data.updated).toEqual([]);
  });

  it('handles missing lock file (no presets to update)', async () => {
    // Arrange — create .codi dir without lock file
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\n',
      'utf-8',
    );

    const { presetUpdateHandler } = await import('../../../src/cli/preset.js');

    // Act
    const result = await presetUpdateHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe('update');
    expect(result.data.updated).toEqual([]);
  });

  it('dry-run with empty lock file returns empty updated list', async () => {
    // Arrange
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, PRESET_LOCK_FILENAME),
      JSON.stringify({ presets: {} }, null, 2),
      'utf-8',
    );
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\n',
      'utf-8',
    );

    const { presetUpdateHandler } = await import('../../../src/cli/preset.js');

    // Act
    const result = await presetUpdateHandler(tmpDir, true);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.updated).toEqual([]);
  });
});

describe('presetSearchHandler', () => {
  // NOTE: presetSearchHandler requires cloning a git registry, which involves
  // network access and external git operations. Testing it properly would
  // require mocking the cloneRegistry function. The handler's error path
  // (when git clone fails) does return a structured error result, but
  // triggering it reliably in a test without network is fragile.
  // Skipping these tests in favor of testing handlers that work with
  // filesystem setup alone.

  it.skip('requires git clone — not tested with filesystem alone', () => {
    // Placeholder to document the intentional skip
  });
});
