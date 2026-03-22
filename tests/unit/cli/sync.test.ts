import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { syncHandler } from '../../../src/cli/sync.js';
import { Logger } from '../../../src/core/output/logger.js';
import { EXIT_CODES } from '../../../src/core/output/exit-codes.js';

describe('sync command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-sync-cli-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails when .codi does not exist', async () => {
    const result = await syncHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.CONFIG_NOT_FOUND);
  });

  it('fails when no sync config in manifest', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test\nversion: "1"\n`,
    );

    const result = await syncHandler(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.errors[0]!.message).toContain('No sync configuration');
  });
});
