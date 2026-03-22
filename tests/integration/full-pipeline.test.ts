import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { initHandler } from '../../src/cli/init.js';
import { generateHandler } from '../../src/cli/generate.js';
import { statusHandler } from '../../src/cli/status.js';
import { validateHandler } from '../../src/cli/validate.js';
import { Logger } from '../../src/core/output/logger.js';
import { clearAdapters } from '../../src/core/generator/adapter-registry.js';

let tmpDir: string;

beforeEach(async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-int-'));
  // Create a subdirectory with a valid project name (lowercase only)
  tmpDir = path.join(base, 'test-project');
  await fs.mkdir(tmpDir, { recursive: true });
  // Create a package.json so init detects 'node' stack
  await fs.writeFile(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'test-project', version: '1.0.0' }),
    'utf-8',
  );
  // Clear adapter registry to start fresh
  clearAdapters();
  // Initialize logger for test
  Logger.init({ level: 'error', mode: 'human', noColor: true });
});

afterEach(async () => {
  // Remove the parent temp dir (which contains test-project)
  await fs.rm(path.dirname(tmpDir), { recursive: true, force: true });
  clearAdapters();
});

describe('Full Pipeline Integration', () => {
  it('init creates .codi/ structure', async () => {
    const result = await initHandler(tmpDir, {});
    expect(result.success).toBe(true);
    expect(result.data.stack).toContain('node');

    // Verify .codi/ directory exists
    const codiDir = path.join(tmpDir, '.codi');
    const stat = await fs.stat(codiDir);
    expect(stat.isDirectory()).toBe(true);

    // Verify codi.yaml exists
    const manifestExists = await fs.access(path.join(codiDir, 'codi.yaml')).then(() => true).catch(() => false);
    expect(manifestExists).toBe(true);

    // Verify flags.yaml exists
    const flagsExists = await fs.access(path.join(codiDir, 'flags.yaml')).then(() => true).catch(() => false);
    expect(flagsExists).toBe(true);

    // Verify rules directories
    const rulesGenExists = await fs.access(path.join(codiDir, 'rules', 'generated', 'common')).then(() => true).catch(() => false);
    expect(rulesGenExists).toBe(true);

    const rulesCustomExists = await fs.access(path.join(codiDir, 'rules', 'custom')).then(() => true).catch(() => false);
    expect(rulesCustomExists).toBe(true);
  });

  it('init with --force reinitializes', async () => {
    // First init
    await initHandler(tmpDir, {});

    // Second init without force fails
    const failResult = await initHandler(tmpDir, {});
    expect(failResult.success).toBe(false);

    // Second init with force succeeds
    const forceResult = await initHandler(tmpDir, { force: true });
    expect(forceResult.success).toBe(true);
  });

  it('validate passes after init', async () => {
    await initHandler(tmpDir, {});

    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.valid).toBe(true);
  });

  it('validate fails without .codi/', async () => {
    const result = await validateHandler(tmpDir);
    expect(result.success).toBe(false);
  });

  it('generate runs after init', async () => {
    await initHandler(tmpDir, {});

    const result = await generateHandler(tmpDir, {});
    expect(result.success).toBe(true);
  });

  it('status reports no drift after generate', async () => {
    await initHandler(tmpDir, {});

    const result = await statusHandler(tmpDir);
    expect(result.success).toBe(true);
    expect(result.data.hasDrift).toBe(false);
  });
});
