import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseYaml } from 'yaml';
import type { CodiManifest } from '../../types/config.js';
import { PRESET_MANIFEST_FILENAME, PRESET_LOCK_FILENAME, REGISTRY_INDEX_FILENAME, GIT_CLONE_DEPTH } from '../../constants.js';

const execFileAsync = promisify(execFile);

export interface RegistryConfig {
  url: string;
  branch: string;
}

export interface RegistryEntry {
  name: string;
  description: string;
  version: string;
  tags: string[];
}

export interface PresetLockEntry {
  version: string;
  source: string;
  installedAt: string;
}

export interface PresetLock {
  presets: Record<string, PresetLockEntry>;
}

export function getRegistryConfig(manifest: CodiManifest | null): RegistryConfig {
  if (manifest?.presetRegistry) {
    return {
      url: manifest.presetRegistry.url,
      branch: manifest.presetRegistry.branch ?? 'main',
    };
  }
  return { url: 'codi-registry/presets', branch: 'main' };
}

export async function readLockFile(codiDir: string): Promise<PresetLock> {
  const lockPath = path.join(codiDir, PRESET_LOCK_FILENAME);
  try {
    const raw = await fs.readFile(lockPath, 'utf8');
    return JSON.parse(raw) as PresetLock;
  } catch {
    return { presets: {} };
  }
}

export async function writeLockFile(codiDir: string, lock: PresetLock): Promise<void> {
  const lockPath = path.join(codiDir, PRESET_LOCK_FILENAME);
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
}

export async function cloneRegistry(config: RegistryConfig): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `codi-registry-${Date.now()}`);
  await execFileAsync('git', [
    'clone', '--depth', GIT_CLONE_DEPTH, '--branch', config.branch, config.url, tmpDir,
  ]);
  return tmpDir;
}

export async function readRegistryIndex(registryDir: string): Promise<RegistryEntry[]> {
  const indexPath = path.join(registryDir, REGISTRY_INDEX_FILENAME);
  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(raw) as RegistryEntry[];
  } catch {
    return [];
  }
}

export function filterEntries(entries: RegistryEntry[], query: string): RegistryEntry[] {
  const lowerQuery = query.toLowerCase();
  return entries.filter(entry => {
    const nameMatch = entry.name.toLowerCase().includes(lowerQuery);
    const descMatch = entry.description.toLowerCase().includes(lowerQuery);
    const tagMatch = entry.tags.some(t => t.toLowerCase().includes(lowerQuery));
    return nameMatch || descMatch || tagMatch;
  });
}

export async function getPresetVersionFromDir(presetDir: string): Promise<string> {
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = parseYaml(raw) as Record<string, unknown>;
    return (parsed['version'] as string) ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === '.git') continue;
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
