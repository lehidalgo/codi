import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { docsUpdateHandler } from '../../../src/cli/docs-update.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('docs-update command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-docs-update-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('succeeds with no docs to fix in an empty project', async () => {
    const result = await docsUpdateHandler(tmpDir);

    expect(result.success).toBe(true);
    expect(result.command).toBe('docs-update');
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(Array.isArray(result.data.fixed)).toBe(true);
    expect(Array.isArray(result.data.remaining)).toBe(true);
  });

  it('returns fixed and remaining arrays', async () => {
    // Create a project with a STATUS.md that has wrong counts
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      'name: test\nversion: "1"\n',
      'utf-8',
    );

    const result = await docsUpdateHandler(tmpDir);

    expect(result.success).toBe(true);
    expect(typeof result.data.fixed).toBe('object');
    expect(Array.isArray(result.data.fixed)).toBe(true);
    expect(Array.isArray(result.data.remaining)).toBe(true);
    // Each remaining entry has file and description
    for (const item of result.data.remaining) {
      expect(typeof item.file).toBe('string');
      expect(typeof item.description).toBe('string');
    }
  });

  it('always returns SUCCESS exit code', async () => {
    // docs-update always returns SUCCESS even if there are unfixable issues
    const result = await docsUpdateHandler(tmpDir);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});
