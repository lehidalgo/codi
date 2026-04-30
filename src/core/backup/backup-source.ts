import fs from "node:fs/promises";
import path from "node:path";
import { BACKUPS_DIR } from "#src/constants.js";
import type { ExternalSource } from "#src/core/external-source/connectors.js";

const NOOP_CLEANUP = async (): Promise<void> => {};
const ARTIFACT_DIR_NAMES = ["rules", "skills", "agents", "mcp-servers"];

async function hasAnyArtifactDir(rootPath: string): Promise<boolean> {
  for (const name of ARTIFACT_DIR_NAMES) {
    const stat = await fs.stat(path.join(rootPath, name)).catch(() => null);
    if (stat?.isDirectory()) return true;
  }
  return false;
}

/**
 * Adapts a backup directory into an ExternalSource so the existing
 * runArtifactSelectionFromSource wizard can consume it as a preset.
 * The backup's `.codi/` subtree IS the preset root.
 *
 * Throws when the backup either has no `.codi/` subtree (output-only legacy
 * backups) or has one but lacks any of the standard artifact dirs (rules/,
 * skills/, agents/, mcp-servers/). Both cases mean the backup is not
 * restorable via the artifact-selection wizard - the caller should fall back
 * to direct file restore.
 */
export async function connectBackup(configDir: string, timestamp: string): Promise<ExternalSource> {
  const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
  const rootPath = path.join(backupDir, ".codi");
  const stat = await fs.stat(rootPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(
      `Backup ${timestamp} has no .codi/ source - output-only backups can't be ` +
        `restored via the artifact-selection flow.`,
    );
  }
  if (!(await hasAnyArtifactDir(rootPath))) {
    throw new Error(
      `Backup ${timestamp} .codi/ has no artifact dirs - output-only backups can't be ` +
        `restored via the artifact-selection flow.`,
    );
  }
  return {
    id: `backup:${timestamp}`,
    rootPath,
    cleanup: NOOP_CLEANUP,
  };
}
