import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { contributeHandler } from '../../../src/cli/contribute.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('contribute command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-contrib-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when no artifacts are found', async () => {
    // No .codi/ directory at all — no artifacts to discover
    const result = await contributeHandler(tmpDir);

    expect(result.success).toBe(false);
    expect(result.command).toBe('contribute');
    expect(result.data.action).toBe('cancelled');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain('No artifacts found');
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it('returns error when .codi/ exists but has no artifact files', async () => {
    // Create empty artifact directories
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'rules', 'custom'), { recursive: true });
    await fs.mkdir(path.join(codiDir, 'skills'), { recursive: true });
    await fs.mkdir(path.join(codiDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(codiDir, 'commands'), { recursive: true });

    const result = await contributeHandler(tmpDir);

    expect(result.success).toBe(false);
    expect(result.data.action).toBe('cancelled');
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  // NOTE: Testing the interactive prompts (artifact selection, PR/ZIP choice)
  // requires mocking @clack/prompts, which is a heavy interactive dependency.
  // The non-interactive paths (no artifacts found) are fully tested above.
  // A full integration test would mock p.multiselect, p.select, etc.
});
