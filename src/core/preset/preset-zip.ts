import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { MAX_PRESET_ZIP_WARN_BYTES, MAX_PRESET_ZIP_ERROR_BYTES, PRESET_MANIFEST_FILENAME } from '../../constants.js';
import { createError } from '../output/errors.js';
import type { CodiError } from '../output/types.js';
import { validatePreset } from './preset-validator.js';
import { copyDir } from './preset-registry.js';

const execFileAsync = promisify(execFile);

export interface ZipCreateResult {
  outputPath: string;
  sizeBytes: number;
  warnings: CodiError[];
}

export interface ZipExtractResult {
  extractedDir: string;
  presetName: string;
  warnings: CodiError[];
}

/**
 * Creates a ZIP archive from a preset directory.
 */
export async function createPresetZip(
  presetDir: string,
  outputPath: string,
): Promise<Result<ZipCreateResult>> {
  const warnings: CodiError[] = [];

  // Validate the preset before packaging
  const validation = await validatePreset(presetDir);
  if (!validation.ok) {
    return err(validation.errors);
  }
  warnings.push(...validation.data.warnings);

  const presetName = path.basename(presetDir);
  const resolvedOutput = outputPath.endsWith('.zip')
    ? outputPath
    : path.join(outputPath, `${presetName}.zip`);

  try {
    // Use system zip command (available on macOS and most Linux)
    const parentDir = path.dirname(presetDir);
    const dirName = path.basename(presetDir);

    await execFileAsync('zip', ['-r', path.resolve(resolvedOutput), dirName], {
      cwd: parentDir,
    });
  } catch (cause) {
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `Failed to create ZIP: ${cause instanceof Error ? cause.message : String(cause)}. Ensure 'zip' command is available.`,
    })]);
  }

  // Check file size
  const stat = await fs.stat(resolvedOutput);
  if (stat.size > MAX_PRESET_ZIP_ERROR_BYTES) {
    await fs.unlink(resolvedOutput).catch(() => {});
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `ZIP file exceeds maximum size of ${MAX_PRESET_ZIP_ERROR_BYTES / 1_048_576}MB`,
    })]);
  }
  if (stat.size > MAX_PRESET_ZIP_WARN_BYTES) {
    warnings.push(createError('W_PRESET_SIZE', {
      message: `ZIP file is ${(stat.size / 1_048_576).toFixed(1)}MB — consider reducing preset size`,
    }));
  }

  return ok({ outputPath: resolvedOutput, sizeBytes: stat.size, warnings });
}

/**
 * Extracts a ZIP preset to a temporary directory and validates it.
 */
export async function extractPresetZip(
  zipPath: string,
): Promise<Result<ZipExtractResult>> {
  const warnings: CodiError[] = [];
  const resolvedZipPath = path.resolve(zipPath);

  // Check ZIP exists
  try {
    await fs.access(resolvedZipPath);
  } catch {
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `ZIP file not found: ${zipPath}`,
    })]);
  }

  // Check file size
  const stat = await fs.stat(resolvedZipPath);
  if (stat.size > MAX_PRESET_ZIP_ERROR_BYTES) {
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `ZIP file exceeds maximum size of ${MAX_PRESET_ZIP_ERROR_BYTES / 1_048_576}MB`,
    })]);
  }

  // Extract to temp dir
  const tmpDir = path.join(os.tmpdir(), `codi-preset-zip-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await execFileAsync('unzip', ['-o', resolvedZipPath, '-d', tmpDir]);
  } catch (cause) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `Failed to extract ZIP: ${cause instanceof Error ? cause.message : String(cause)}. Ensure 'unzip' command is available.`,
    })]);
  }

  // Find the preset root (may be nested in a single subdirectory)
  const presetRoot = await findPresetRoot(tmpDir);
  if (!presetRoot) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `ZIP does not contain a valid preset (no ${PRESET_MANIFEST_FILENAME} found)`,
    })]);
  }

  // Validate the extracted preset
  const validation = await validatePreset(presetRoot);
  if (!validation.ok) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return err(validation.errors);
  }
  warnings.push(...validation.data.warnings);

  const presetName = validation.data.manifest.name;

  return ok({ extractedDir: presetRoot, presetName, warnings });
}

/**
 * Installs a ZIP preset into the project's presets directory.
 */
export async function installPresetFromZip(
  zipPath: string,
  presetsDir: string,
): Promise<Result<{ name: string; warnings: CodiError[] }>> {
  const extractResult = await extractPresetZip(zipPath);
  if (!extractResult.ok) {
    return err(extractResult.errors);
  }

  const { extractedDir, presetName, warnings } = extractResult.data;
  const destDir = path.join(presetsDir, presetName);

  try {
    await fs.rm(destDir, { recursive: true, force: true });
    await fs.mkdir(destDir, { recursive: true });
    await copyDir(extractedDir, destDir);
  } catch (cause) {
    return err([createError('E_PRESET_ZIP_FAILED', {
      reason: `Failed to install preset: ${cause instanceof Error ? cause.message : String(cause)}`,
    })]);
  } finally {
    // Clean up temp dir (parent of extractedDir)
    const tmpParent = path.dirname(extractedDir);
    await fs.rm(tmpParent, { recursive: true, force: true }).catch(() => {});
  }

  return ok({ name: presetName, warnings });
}

/**
 * Finds the preset root directory within an extracted ZIP.
 * The preset.yaml may be at the root or inside a single subdirectory.
 */
async function findPresetRoot(extractDir: string): Promise<string | null> {
  // Check if preset.yaml is at the root
  const rootManifest = path.join(extractDir, PRESET_MANIFEST_FILENAME);
  try {
    await fs.access(rootManifest);
    return extractDir;
  } catch {
    // Not at root
  }

  // Check one level of subdirectories
  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));

  for (const dir of dirs) {
    const subManifest = path.join(extractDir, dir.name, PRESET_MANIFEST_FILENAME);
    try {
      await fs.access(subManifest);
      return path.join(extractDir, dir.name);
    } catch {
      continue;
    }
  }

  return null;
}
