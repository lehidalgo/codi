import fs from 'node:fs/promises';
import path from 'node:path';
import { err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
// PresetSourceType used via preset-source.ts types
import type { PresetSourceDescriptor } from './preset-source.js';
import type { LoadedPreset } from './preset-loader.js';
import { loadPresetFromDir } from './preset-loader.js';
import { isBuiltinPreset as checkBuiltin, materializeBuiltinPreset } from './preset-builtin.js';
import { createError } from '../output/errors.js';

/**
 * Parses a preset identifier string into a source descriptor.
 *
 * Supported formats:
 *   "balanced"                        → builtin
 *   "./my-preset.zip"                 → zip
 *   "/abs/path/preset.zip"            → zip
 *   "github:org/repo"                 → github
 *   "github:org/repo@v1.0"            → github with tag
 *   "github:org/repo#branch"          → github with branch
 *   "https://github.com/org/repo"     → github
 *   "my-custom-preset"                → local (directory in .codi/presets/)
 */
export function parsePresetIdentifier(id: string): PresetSourceDescriptor {
  // Built-in presets
  if (isBuiltinPresetName(id)) {
    return { type: 'builtin', identifier: id };
  }

  // ZIP files
  if (id.endsWith('.zip')) {
    return { type: 'zip', identifier: id };
  }

  // GitHub shorthand: github:org/repo[@tag][#branch]
  if (id.startsWith('github:')) {
    return parseGithubIdentifier(id.slice(7));
  }

  // GitHub URL: https://github.com/org/repo
  if (isGithubUrl(id)) {
    const repoPath = extractGithubRepoPath(id);
    return parseGithubIdentifier(repoPath);
  }

  // Default: local directory name
  return { type: 'local', identifier: id };
}

/**
 * Resolves a preset identifier to a loaded preset.
 *
 * Resolution order:
 * 1. Check if it's a built-in preset name
 * 2. Check if the identifier points to a local directory in presetsDir
 * 3. Delegate to the appropriate source (zip, github)
 *
 * For zip and github sources, resolution is handled by dedicated modules
 * that must be called separately before this function (they copy into presetsDir).
 */
export async function resolveAndLoadPreset(
  id: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  const descriptor = parsePresetIdentifier(id);

  switch (descriptor.type) {
    case 'builtin':
      return loadBuiltinPreset(descriptor.identifier, presetsDir);

    case 'local':
      return loadLocalPreset(descriptor.identifier, presetsDir);

    case 'zip':
    case 'github':
      // These sources should have been installed into presetsDir already.
      // Try loading from presetsDir by extracting the preset name.
      return loadInstalledPreset(descriptor, presetsDir);
  }
}

function isBuiltinPresetName(name: string): boolean {
  return checkBuiltin(name);
}

function isGithubUrl(id: string): boolean {
  return id.startsWith('https://github.com/') || id.startsWith('http://github.com/');
}

function extractGithubRepoPath(url: string): string {
  const match = url.match(/github\.com\/(.+?)(?:\.git)?$/);
  return match?.[1] ?? url;
}

function parseGithubIdentifier(raw: string): PresetSourceDescriptor {
  // Handle @tag notation: org/repo@v1.0
  const tagMatch = raw.match(/^(.+?)@(.+)$/);
  if (tagMatch && tagMatch[1] && tagMatch[2]) {
    return {
      type: 'github',
      identifier: tagMatch[1],
      version: tagMatch[2],
      ref: tagMatch[2],
    };
  }

  // Handle #branch notation: org/repo#branch
  const branchMatch = raw.match(/^(.+?)#(.+)$/);
  if (branchMatch && branchMatch[1] && branchMatch[2]) {
    return {
      type: 'github',
      identifier: branchMatch[1],
      ref: branchMatch[2],
    };
  }

  return { type: 'github', identifier: raw };
}

async function loadBuiltinPreset(
  name: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  // First check if there's a local override in presetsDir
  const localDir = path.join(presetsDir, name);
  if (await dirExists(localDir)) {
    return loadPresetFromDir(name, presetsDir);
  }

  // Materialize the built-in preset from templates
  return materializeBuiltinPreset(name);
}

async function loadLocalPreset(
  name: string,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  const presetDir = path.join(presetsDir, name);
  if (!(await dirExists(presetDir))) {
    return err([createError('E_PRESET_NOT_FOUND', { name })]);
  }
  return loadPresetFromDir(name, presetsDir);
}

async function loadInstalledPreset(
  descriptor: PresetSourceDescriptor,
  presetsDir: string,
): Promise<Result<LoadedPreset>> {
  // Extract preset name from identifier (last segment of github path, or zip filename)
  const name = extractPresetName(descriptor);
  const presetDir = path.join(presetsDir, name);

  if (!(await dirExists(presetDir))) {
    const hint = descriptor.type === 'zip'
      ? `Install it first: codi preset install ${descriptor.identifier}`
      : `Install it first: codi preset install github:${descriptor.identifier}`;
    return err([createError('E_PRESET_NOT_FOUND', { name, hint })]);
  }

  return loadPresetFromDir(name, presetsDir);
}

/**
 * Extracts a preset name from a source descriptor identifier.
 */
export function extractPresetName(descriptor: PresetSourceDescriptor): string {
  switch (descriptor.type) {
    case 'zip': {
      const basename = path.basename(descriptor.identifier, '.zip');
      return basename;
    }
    case 'github': {
      const parts = descriptor.identifier.split('/');
      return parts[parts.length - 1] ?? descriptor.identifier;
    }
    default:
      return descriptor.identifier;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
