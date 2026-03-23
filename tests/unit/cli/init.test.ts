import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initHandler } from '../../../src/cli/init.js';
import { Logger } from '../../../src/core/output/logger.js';

describe('init command handler', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-init-'));
    Logger.init({ level: 'error', mode: 'human', noColor: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .codi/ directory structure', async () => {
    const result = await initHandler(tmpDir, { json: true });

    expect(result.success).toBe(true);
    expect(result.data.codiDir).toBe(path.join(tmpDir, '.codi'));

    const codiDir = path.join(tmpDir, '.codi');
    const stat = await fs.stat(codiDir);
    expect(stat.isDirectory()).toBe(true);

    const manifest = await fs.readFile(path.join(codiDir, 'codi.yaml'), 'utf-8');
    expect(manifest).toContain('version: "1"');

    const flags = await fs.readFile(path.join(codiDir, 'flags.yaml'), 'utf-8');
    expect(flags).toContain('auto_commit:');

    const customDir = await fs.stat(path.join(codiDir, 'rules', 'custom'));
    expect(customDir.isDirectory()).toBe(true);
  });

  it('fails if .codi/ already exists without --force', async () => {
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.message).toContain('already exists');
  });

  it('reinitializes with --force', async () => {
    await fs.mkdir(path.join(tmpDir, '.codi'), { recursive: true });

    const result = await initHandler(tmpDir, { force: true, json: true });
    expect(result.success).toBe(true);
  });

  it('detects node stack when package.json exists', async () => {
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}', 'utf-8');

    const result = await initHandler(tmpDir, { json: true });
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain('node');
  });
});
