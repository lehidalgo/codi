import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import type { NormalizedSkill } from '../../types/config.js';
import type { CodiError } from '../output/types.js';
import { createError } from '../output/errors.js';
import { buildSkillMd, SKIP_DIRS, SKIP_FILES } from '../../adapters/skill-generator.js';
import { parseSkillFile } from '../config/parser.js';
import { SKILL_OUTPUT_FILENAME } from '../../constants.js';
import { MAX_PRESET_ZIP_WARN_BYTES, MAX_PRESET_ZIP_ERROR_BYTES } from '../../constants.js';

const execFileAsync = promisify(execFile);

export type SkillExportFormat = 'standard' | 'claude-plugin' | 'codex-plugin' | 'zip';

export const EXPORT_FORMATS: SkillExportFormat[] = [
  'standard', 'claude-plugin', 'codex-plugin', 'zip',
];

export interface SkillExportOptions {
  name: string;
  codiDir: string;
  outputDir: string;
  format: SkillExportFormat;
}

export interface SkillExportResult {
  outputPath: string;
  format: SkillExportFormat;
  sizeBytes?: number;
  warnings: CodiError[];
}

/**
 * Validates that a skill exists and has valid frontmatter.
 */
export async function validateSkillForExport(
  skillDir: string,
  name: string,
): Promise<Result<NormalizedSkill>> {
  const skillMdPath = path.join(skillDir, SKILL_OUTPUT_FILENAME);

  try {
    await fs.access(skillDir);
  } catch {
    return err([createError('E_SKILL_NOT_FOUND', {
      name,
      path: skillDir,
    })]);
  }

  try {
    await fs.access(skillMdPath);
  } catch {
    return err([createError('E_SKILL_NOT_FOUND', {
      name,
      path: skillMdPath,
    })]);
  }

  const parseResult = await parseSkillFile(skillMdPath);
  if (!parseResult.ok) return parseResult;

  const skill = parseResult.data;
  if (!skill.description || skill.description.trim().length === 0) {
    return err([createError('E_SKILL_INVALID', {
      name,
      reason: 'Description is required for marketplace export.',
    })]);
  }

  return ok(skill);
}

/**
 * Exports a skill in the requested format.
 */
export async function exportSkill(
  options: SkillExportOptions,
): Promise<Result<SkillExportResult>> {
  const { name, codiDir, outputDir, format } = options;
  const skillDir = path.join(codiDir, 'skills', name);

  const validateResult = await validateSkillForExport(skillDir, name);
  if (!validateResult.ok) return validateResult;
  const skill = validateResult.data;

  const isZip = format === 'zip';
  const stagingDir = isZip
    ? path.join(os.tmpdir(), `codi-skill-export-${Date.now()}`)
    : outputDir;

  if (isZip) {
    await fs.mkdir(stagingDir, { recursive: true });
  }

  try {
    const baseFormat = isZip ? 'standard' : format;
    let buildResult: Result<SkillExportResult>;

    switch (baseFormat) {
      case 'standard':
        buildResult = await buildStandardExport(skill, skillDir, stagingDir);
        break;
      case 'claude-plugin':
        buildResult = await buildClaudePluginExport(skill, skillDir, stagingDir);
        break;
      case 'codex-plugin':
        buildResult = await buildCodexPluginExport(skill, skillDir, stagingDir);
        break;
      default:
        return err([createError('E_SKILL_EXPORT_FAILED', {
          name,
          reason: `Unsupported format: ${format}`,
        })]);
    }

    if (!buildResult.ok) return buildResult;

    if (isZip) {
      const zipOutputPath = path.resolve(outputDir, `${name}.zip`);
      await fs.mkdir(path.dirname(zipOutputPath), { recursive: true });
      const zipResult = await createSkillZip(
        buildResult.data.outputPath,
        zipOutputPath,
      );
      if (!zipResult.ok) return zipResult;

      return ok({
        outputPath: zipResult.data.outputPath,
        format: 'zip',
        sizeBytes: zipResult.data.sizeBytes,
        warnings: [...buildResult.data.warnings, ...zipResult.data.warnings],
      });
    }

    return ok({ ...buildResult.data, format });
  } finally {
    if (isZip) {
      await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Builds a standard Agent Skills export (universal format).
 */
async function buildStandardExport(
  skill: NormalizedSkill,
  skillDir: string,
  outputDir: string,
): Promise<Result<SkillExportResult>> {
  const destDir = path.join(outputDir, skill.name);
  await fs.mkdir(destDir, { recursive: true });

  // Write clean SKILL.md (no Codi-internal fields, no generated header)
  const cleanMd = buildSkillMd(skill);
  await fs.writeFile(path.join(destDir, SKILL_OUTPUT_FILENAME), cleanMd, 'utf-8');

  // Copy supporting files
  await copySkillFiles(skillDir, destDir);

  return ok({
    outputPath: destDir,
    format: 'standard' as SkillExportFormat,
    warnings: [],
  });
}

/**
 * Builds a Claude Code plugin export.
 */
async function buildClaudePluginExport(
  skill: NormalizedSkill,
  skillDir: string,
  outputDir: string,
): Promise<Result<SkillExportResult>> {
  const pluginDir = path.join(outputDir, `${skill.name}-plugin`);
  const skillsDir = path.join(pluginDir, 'skills', skill.name);
  const manifestDir = path.join(pluginDir, '.claude-plugin');

  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(manifestDir, { recursive: true });

  // Write plugin.json
  const manifest = {
    name: skill.name,
    description: skill.description.split('\n')[0]?.trim() ?? skill.description,
    version: '1.0.0',
  };
  await fs.writeFile(
    path.join(manifestDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );

  // Write clean SKILL.md
  const cleanMd = buildSkillMd(skill);
  await fs.writeFile(path.join(skillsDir, SKILL_OUTPUT_FILENAME), cleanMd, 'utf-8');

  // Copy supporting files
  await copySkillFiles(skillDir, skillsDir);

  return ok({
    outputPath: pluginDir,
    format: 'claude-plugin' as SkillExportFormat,
    warnings: [],
  });
}

/**
 * Builds a Codex plugin export.
 */
async function buildCodexPluginExport(
  skill: NormalizedSkill,
  skillDir: string,
  outputDir: string,
): Promise<Result<SkillExportResult>> {
  const pluginDir = path.join(outputDir, `${skill.name}-plugin`);
  const skillsDir = path.join(pluginDir, 'skills', skill.name);
  const manifestDir = path.join(pluginDir, '.codex-plugin');

  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(manifestDir, { recursive: true });

  // Write plugin.json
  const manifest = {
    name: skill.name,
    description: skill.description.split('\n')[0]?.trim() ?? skill.description,
    version: '1.0.0',
  };
  await fs.writeFile(
    path.join(manifestDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );

  // Write clean SKILL.md
  const cleanMd = buildSkillMd(skill);
  await fs.writeFile(path.join(skillsDir, SKILL_OUTPUT_FILENAME), cleanMd, 'utf-8');

  // Copy supporting files
  await copySkillFiles(skillDir, skillsDir);

  return ok({
    outputPath: pluginDir,
    format: 'codex-plugin' as SkillExportFormat,
    warnings: [],
  });
}

/**
 * Creates a ZIP archive from an exported skill directory.
 */
async function createSkillZip(
  sourceDir: string,
  outputPath: string,
): Promise<Result<{ outputPath: string; sizeBytes: number; warnings: CodiError[] }>> {
  const warnings: CodiError[] = [];
  const parentDir = path.dirname(sourceDir);
  const dirName = path.basename(sourceDir);

  try {
    await execFileAsync('zip', ['-r', path.resolve(outputPath), dirName], {
      cwd: parentDir,
    });
  } catch (cause) {
    return err([createError('E_SKILL_EXPORT_FAILED', {
      name: dirName,
      reason: `Failed to create ZIP: ${cause instanceof Error ? cause.message : String(cause)}. Ensure 'zip' command is available.`,
    })]);
  }

  const stat = await fs.stat(outputPath);
  if (stat.size > MAX_PRESET_ZIP_ERROR_BYTES) {
    await fs.unlink(outputPath).catch(() => {});
    return err([createError('E_SKILL_EXPORT_FAILED', {
      name: dirName,
      reason: `ZIP exceeds maximum size of ${MAX_PRESET_ZIP_ERROR_BYTES / 1_048_576}MB`,
    })]);
  }
  if (stat.size > MAX_PRESET_ZIP_WARN_BYTES) {
    warnings.push(createError('W_CONTENT_SIZE', {
      message: `ZIP is ${(stat.size / 1_048_576).toFixed(1)}MB — consider reducing skill size`,
    }));
  }

  return ok({ outputPath, sizeBytes: stat.size, warnings });
}

/**
 * Recursively copies supporting files from a skill directory,
 * excluding evals/, .gitkeep, evals.json, and SKILL.md.
 */
async function copySkillFiles(
  sourceDir: string,
  destDir: string,
): Promise<void> {
  await copyDirFiltered(sourceDir, destDir, sourceDir);
}

async function copyDirFiltered(
  rootDir: string,
  destRoot: string,
  currentDir: string,
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const sourcePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, sourcePath);
    const destPath = path.join(destRoot, relativePath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await fs.mkdir(destPath, { recursive: true });
      await copyDirFiltered(rootDir, destRoot, sourcePath);
      continue;
    }

    if (entry.name === SKILL_OUTPUT_FILENAME) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    const topDir = relativePath.split('/')[0] ?? '';
    if (topDir === 'evals') continue;

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(sourcePath, destPath);
  }
}

/**
 * Lists available skills in .codi/skills/ directory.
 */
export async function listAvailableSkills(
  codiDir: string,
): Promise<string[]> {
  const skillsDir = path.join(codiDir, 'skills');
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  } catch {
    return [];
  }
}
