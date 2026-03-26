import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import {
  presetValidateHandler,
  presetRemoveHandler,
  presetListEnhancedHandler,
  presetExportHandler,
} from '../../../src/cli/preset-handlers.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';
import {
  PRESET_MANIFEST_FILENAME,
  PRESET_LOCK_FILENAME,
} from '../../../src/constants.js';

describe('presetValidateHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-ph-val-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('succeeds for a valid preset with manifest', async () => {
    // Arrange
    const presetName = 'my-preset';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });

    const manifest = {
      name: presetName,
      version: '1.0.0',
      description: 'A test preset',
      artifacts: { rules: [], skills: [], agents: [], commands: [] },
    };
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml(manifest),
      'utf-8',
    );

    // Act
    const result = await presetValidateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe('validate');
    expect(result.data.name).toBe(presetName);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('fails when preset manifest is missing', async () => {
    // Arrange
    const presetName = 'no-manifest';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });

    // Act
    const result = await presetValidateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('fails when preset manifest has invalid YAML', async () => {
    // Arrange
    const presetName = 'bad-yaml';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      '{ invalid yaml [[[',
      'utf-8',
    );

    // Act
    const result = await presetValidateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it('fails when manifest does not match schema (missing name)', async () => {
    // Arrange
    const presetName = 'no-name';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });

    const manifest = { version: '1.0.0' };
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml(manifest),
      'utf-8',
    );

    // Act
    const result = await presetValidateHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });
});

describe('presetRemoveHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-ph-rm-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes an installed preset and updates lock file', async () => {
    // Arrange
    const presetName = 'removable';
    const codiDir = path.join(tmpDir, '.codi');
    const presetDir = path.join(codiDir, 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml({ name: presetName, version: '1.0.0' }),
      'utf-8',
    );

    const lock = {
      presets: {
        [presetName]: {
          version: '1.0.0',
          source: 'local',
          sourceType: 'local',
          installedAt: new Date().toISOString(),
        },
      },
    };
    await fs.writeFile(
      path.join(codiDir, PRESET_LOCK_FILENAME),
      JSON.stringify(lock, null, 2),
      'utf-8',
    );

    // Act
    const result = await presetRemoveHandler(tmpDir, presetName);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.action).toBe('remove');
    expect(result.data.name).toBe(presetName);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Verify directory was removed
    await expect(fs.access(presetDir)).rejects.toThrow();

    // Verify lock file was updated
    const updatedLock = JSON.parse(
      await fs.readFile(path.join(codiDir, PRESET_LOCK_FILENAME), 'utf-8'),
    );
    expect(updatedLock.presets[presetName]).toBeUndefined();
  });

  it('returns error when preset does not exist', async () => {
    // Arrange
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });

    // Act
    const result = await presetRemoveHandler(tmpDir, 'nonexistent');

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors![0]!.message).toContain('not found');
  });
});

describe('presetListEnhancedHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-ph-list-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty list when no presets directory exists', async () => {
    // Arrange
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });

    // Act
    const result = await presetListEnhancedHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

    const presets = result.data.presets as Array<{ name: string }>;
    expect(presets).toEqual([]);
  });

  it('lists installed presets from directory', async () => {
    // Arrange
    const presetName = 'my-preset';
    const presetsDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetsDir, { recursive: true });

    const manifest = {
      name: presetName,
      version: '1.0.0',
      description: 'Test preset',
    };
    await fs.writeFile(
      path.join(presetsDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml(manifest),
      'utf-8',
    );

    // Act
    const result = await presetListEnhancedHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);

    const presets = result.data.presets as Array<{
      name: string;
      description: string;
    }>;
    expect(presets.length).toBe(1);
    expect(presets[0]!.name).toBe(presetName);
    expect(presets[0]!.description).toBe('Test preset');
  });

  it('includes builtin presets when showBuiltin is true', async () => {
    // Arrange
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });

    // Act
    const result = await presetListEnhancedHandler(tmpDir, true);

    // Assert
    expect(result.success).toBe(true);

    const presets = result.data.presets as Array<{
      name: string;
      sourceType: string;
    }>;
    const builtins = presets.filter((p) => p.sourceType === 'builtin');
    expect(builtins.length).toBeGreaterThan(0);
  });

  it('lists preset with no manifest as (no manifest)', async () => {
    // Arrange
    const presetName = 'bare-preset';
    const presetsDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetsDir, { recursive: true });
    // No preset.yaml file

    // Act
    const result = await presetListEnhancedHandler(tmpDir, false);

    // Assert
    expect(result.success).toBe(true);

    const presets = result.data.presets as Array<{
      name: string;
      description: string;
    }>;
    expect(presets.length).toBe(1);
    expect(presets[0]!.description).toBe('(no manifest)');
  });
});

describe('presetExportHandler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-ph-export-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails with unsupported format', async () => {
    // Act
    const result = await presetExportHandler(tmpDir, 'test', 'tar', '/tmp/out');

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors![0]!.message).toContain('Unsupported export format');
  });

  it('fails when preset does not exist', async () => {
    // Arrange
    const codiDir = path.join(tmpDir, '.codi', 'presets');
    await fs.mkdir(codiDir, { recursive: true });

    // Act
    const result = await presetExportHandler(
      tmpDir,
      'nonexistent',
      'zip',
      path.join(tmpDir, 'out.zip'),
    );

    // Assert
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors![0]!.message).toContain('not found');
  });

  it('exports a valid preset as zip', async () => {
    // Arrange
    const presetName = 'exportable';
    const presetDir = path.join(tmpDir, '.codi', 'presets', presetName);
    await fs.mkdir(presetDir, { recursive: true });

    const manifest = {
      name: presetName,
      version: '1.0.0',
      description: 'Exportable preset',
      artifacts: { rules: [], skills: [], agents: [], commands: [] },
    };
    await fs.writeFile(
      path.join(presetDir, PRESET_MANIFEST_FILENAME),
      stringifyYaml(manifest),
      'utf-8',
    );

    const outputPath = path.join(tmpDir, 'export.zip');

    // Act
    const result = await presetExportHandler(
      tmpDir,
      presetName,
      'zip',
      outputPath,
    );

    // Assert
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});
