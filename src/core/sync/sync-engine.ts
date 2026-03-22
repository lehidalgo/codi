import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import { hashContent } from '../../utils/hash.js';
import { cloneRepo, createBranch, stageFiles, commit, push } from './git-operations.js';
import { createPullRequest } from './pr-creator.js';

export interface SyncConfig {
  repo: string;
  branch: string;
  paths: string[];
}

export interface SyncOptions {
  projectRoot: string;
  config: SyncConfig;
  projectName: string;
  dryRun?: boolean;
  message?: string;
}

export interface SyncResult {
  prUrl: string | null;
  filesAdded: string[];
  filesModified: string[];
}

interface FileChange {
  relativePath: string;
  status: 'added' | 'modified';
}

async function collectFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectFiles(fullPath);
        for (const [nestedPath, content] of nested) {
          files.set(path.join(entry.name, nestedPath), content);
        }
      } else if (entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf-8');
        files.set(entry.name, content);
      }
    }
  } catch {
    // Directory does not exist
  }
  return files;
}

async function detectChanges(
  localCodiDir: string,
  clonedCodiDir: string,
  syncPaths: string[],
): Promise<FileChange[]> {
  const changes: FileChange[] = [];

  for (const syncPath of syncPaths) {
    const localDir = path.join(localCodiDir, syncPath);
    const clonedDir = path.join(clonedCodiDir, syncPath);

    const localFiles = await collectFiles(localDir);
    const clonedFiles = await collectFiles(clonedDir);

    for (const [filePath, localContent] of localFiles) {
      const relativePath = path.join(syncPath, filePath);
      const clonedContent = clonedFiles.get(filePath);

      if (!clonedContent) {
        changes.push({ relativePath, status: 'added' });
      } else if (hashContent(localContent) !== hashContent(clonedContent)) {
        changes.push({ relativePath, status: 'modified' });
      }
    }
  }

  return changes;
}

async function copyChangedFiles(
  localCodiDir: string,
  clonedCodiDir: string,
  changes: FileChange[],
): Promise<void> {
  for (const change of changes) {
    const srcPath = path.join(localCodiDir, change.relativePath);
    const destPath = path.join(clonedCodiDir, change.relativePath);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }
}

export async function syncToTeamRepo(
  options: SyncOptions,
): Promise<Result<SyncResult>> {
  const { projectRoot, config, projectName, dryRun, message } = options;
  const localCodiDir = path.join(projectRoot, '.codi');

  // Detect changes against remote
  const tmpDir = path.join(
    os.tmpdir(),
    `codi-sync-${Date.now()}`,
  );

  const cloneResult = await cloneRepo(config.repo, tmpDir, config.branch);
  if (!cloneResult.ok) {
    return cloneResult;
  }

  const clonedCodiDir = path.join(tmpDir, '.codi');
  const changes = await detectChanges(localCodiDir, clonedCodiDir, config.paths);

  if (changes.length === 0) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return ok({ prUrl: null, filesAdded: [], filesModified: [] });
  }

  const filesAdded = changes.filter((c) => c.status === 'added').map((c) => c.relativePath);
  const filesModified = changes.filter((c) => c.status === 'modified').map((c) => c.relativePath);

  if (dryRun) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return ok({ prUrl: null, filesAdded, filesModified });
  }

  // Copy changed files to cloned repo
  await copyChangedFiles(localCodiDir, clonedCodiDir, changes);

  // Create branch, stage, commit, push
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `codi/sync-${projectName}-${timestamp}`;

  const branchResult = await createBranch(tmpDir, branchName);
  if (!branchResult.ok) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return branchResult;
  }

  const filePaths = changes.map((c) => path.join('.codi', c.relativePath));
  const stageResult = await stageFiles(tmpDir, filePaths);
  if (!stageResult.ok) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return stageResult;
  }

  const commitMessage = message ?? `codi: sync ${projectName} rules and skills`;
  const commitResult = await commit(tmpDir, commitMessage);
  if (!commitResult.ok) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return commitResult;
  }

  const pushResult = await push(tmpDir, branchName);
  if (!pushResult.ok) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    return pushResult;
  }

  // Create PR
  const prBody = buildPrBody(filesAdded, filesModified, message);
  const prResult = await createPullRequest({
    repo: config.repo,
    baseBranch: config.branch,
    headBranch: branchName,
    title: `codi: sync from ${projectName}`,
    body: prBody,
    cwd: tmpDir,
  });

  await fs.rm(tmpDir, { recursive: true, force: true });

  if (!prResult.ok) return prResult;

  return ok({ prUrl: prResult.data, filesAdded, filesModified });
}

function buildPrBody(
  added: string[],
  modified: string[],
  message?: string,
): string {
  const lines: string[] = [];
  lines.push('## Codi Config Sync');
  if (message) lines.push(`\n${message}`);
  if (added.length > 0) {
    lines.push('\n### Added');
    for (const f of added) lines.push(`- \`${f}\``);
  }
  if (modified.length > 0) {
    lines.push('\n### Modified');
    for (const f of modified) lines.push(`- \`${f}\``);
  }
  return lines.join('\n');
}
