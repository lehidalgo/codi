import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import { execFileAsync } from "../../utils/exec.js";
import type { ProjectManifest } from "../../types/config.js";
import {
  PRESET_MANIFEST_FILENAME,
  PRESET_LOCK_FILENAME,
  REGISTRY_INDEX_FILENAME,
  GIT_CLONE_DEPTH,
  PROJECT_NAME,
} from "#src/constants.js";

const RegistryEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  tags: z.array(z.string()),
});

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
  sourceType: "builtin" | "zip" | "github" | "local" | "registry";
  commit?: string; // git commit hash for github sources
  installedAt: string;
}

export interface PresetLock {
  presets: Record<string, PresetLockEntry>;
}

export function getRegistryConfig(
  manifest: ProjectManifest | null,
): RegistryConfig {
  if (manifest?.presetRegistry) {
    return {
      url: manifest.presetRegistry.url,
      branch: manifest.presetRegistry.branch ?? "main",
    };
  }
  return { url: `${PROJECT_NAME}-registry/presets`, branch: "main" };
}

export async function readLockFile(configDir: string): Promise<PresetLock> {
  const lockPath = path.join(configDir, PRESET_LOCK_FILENAME);
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return JSON.parse(raw) as PresetLock;
  } catch {
    return { presets: {} };
  }
}

export async function writeLockFile(
  configDir: string,
  lock: PresetLock,
): Promise<void> {
  const lockPath = path.join(configDir, PRESET_LOCK_FILENAME);
  await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), "utf-8");
}

export async function cloneRegistry(config: RegistryConfig): Promise<string> {
  const tmpDir = path.join(
    os.tmpdir(),
    `${PROJECT_NAME}-registry-${Date.now()}`,
  );
  await execFileAsync("git", [
    "clone",
    "--depth",
    GIT_CLONE_DEPTH,
    "--branch",
    config.branch,
    config.url,
    tmpDir,
  ]);
  return tmpDir;
}

export async function readRegistryIndex(
  registryDir: string,
): Promise<RegistryEntry[]> {
  const indexPath = path.join(registryDir, REGISTRY_INDEX_FILENAME);
  try {
    const raw = await fs.readFile(indexPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const result = z.array(RegistryEntrySchema).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function filterEntries(
  entries: RegistryEntry[],
  query: string,
): RegistryEntry[] {
  const lowerQuery = query.toLowerCase();
  return entries.filter((entry) => {
    const nameMatch = entry.name.toLowerCase().includes(lowerQuery);
    const descMatch = entry.description.toLowerCase().includes(lowerQuery);
    const tagMatch = entry.tags.some((t) =>
      t.toLowerCase().includes(lowerQuery),
    );
    return nameMatch || descMatch || tagMatch;
  });
}

export async function getPresetVersionFromDir(
  presetDir: string,
): Promise<string> {
  const manifestPath = path.join(presetDir, PRESET_MANIFEST_FILENAME);
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    const parsed = parseYaml(raw) as Record<string, unknown>;
    return (parsed["version"] as string) ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function copyDir(src: string, dest: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === ".git") continue;
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
