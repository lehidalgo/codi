import fs from "node:fs/promises";
import path from "node:path";
import { isPathSafe } from "../../utils/path-guard.js";
import { fileExists, safeRm } from "../../utils/fs.js";
import {
  MAX_BACKUPS,
  STATE_FILENAME,
  BACKUPS_DIR,
  BACKUP_MANIFEST_FILENAME,
} from "#src/constants.js";

interface BackupManifest {
  timestamp: string;
  files: string[];
}

interface BackupInfo {
  timestamp: string;
  fileCount: number;
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function createBackup(
  projectRoot: string,
  configDir: string,
): Promise<string | null> {
  const statePath = path.join(configDir, STATE_FILENAME);
  if (!(await fileExists(statePath))) {
    return null;
  }

  let stateData: { agents: Record<string, Array<{ path: string }>> };
  try {
    const raw = await fs.readFile(statePath, "utf8");
    stateData = JSON.parse(raw) as typeof stateData;
  } catch {
    return null;
  }

  const generatedFiles = collectFilesFromState(stateData.agents);
  if (generatedFiles.length === 0) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  const backupDir = path.join(backupsRoot, timestamp);
  await fs.mkdir(backupDir, { recursive: true });

  const backedUpFiles: string[] = [];

  for (const relPath of generatedFiles) {
    if (!isPathSafe(projectRoot, relPath)) continue;
    const absSource = path.resolve(projectRoot, relPath);
    if (!(await fileExists(absSource))) continue;

    const destPath = path.join(backupDir, relPath);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(absSource, destPath);
    backedUpFiles.push(relPath);
  }

  if (backedUpFiles.length === 0) {
    await safeRm(backupDir);
    return null;
  }

  const manifest: BackupManifest = {
    timestamp,
    files: backedUpFiles,
  };
  await fs.writeFile(
    path.join(backupDir, BACKUP_MANIFEST_FILENAME),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  await cleanupOldBackups(backupsRoot);

  return timestamp;
}

export async function listBackups(configDir: string): Promise<BackupInfo[]> {
  const backupsRoot = path.join(configDir, BACKUPS_DIR);
  if (!(await dirExists(backupsRoot))) {
    return [];
  }

  const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
  const backups: BackupInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(
      backupsRoot,
      entry.name,
      BACKUP_MANIFEST_FILENAME,
    );
    if (!(await fileExists(manifestPath))) continue;

    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw) as BackupManifest;
      backups.push({
        timestamp: manifest.timestamp,
        fileCount: manifest.files.length,
      });
    } catch {
      continue;
    }
  }

  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function restoreBackup(
  projectRoot: string,
  configDir: string,
  timestamp: string,
): Promise<string[]> {
  const backupDir = path.join(configDir, BACKUPS_DIR, timestamp);
  const manifestPath = path.join(backupDir, BACKUP_MANIFEST_FILENAME);

  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as BackupManifest;

  const restoredFiles: string[] = [];
  for (const relPath of manifest.files) {
    if (!isPathSafe(projectRoot, relPath)) continue;
    const sourcePath = path.join(backupDir, relPath);
    const destPath = path.resolve(projectRoot, relPath);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
    restoredFiles.push(relPath);
  }

  return restoredFiles;
}

async function cleanupOldBackups(backupsDir: string): Promise<void> {
  if (!(await dirExists(backupsDir))) return;

  const entries = await fs.readdir(backupsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  while (dirs.length > MAX_BACKUPS) {
    const oldest = dirs.shift();
    if (!oldest) break;
    await safeRm(path.join(backupsDir, oldest));
  }
}

function collectFilesFromState(
  agents: Record<string, Array<{ path: string }>>,
): string[] {
  const files = new Set<string>();
  for (const agentFiles of Object.values(agents)) {
    for (const file of agentFiles) {
      files.add(file.path);
    }
  }
  return [...files];
}
