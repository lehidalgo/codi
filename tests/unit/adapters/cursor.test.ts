import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cursorAdapter } from '../../../src/adapters/cursor.js';
import { createMockConfig } from './mock-config.js';

describe('cursor adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-cursor-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct id and name', () => {
    expect(cursorAdapter.id).toBe('cursor');
    expect(cursorAdapter.name).toBe('Cursor');
  });

  it('detects when .cursor/ exists', async () => {
    await mkdir(join(tmpDir, '.cursor'), { recursive: true });
    expect(await cursorAdapter.detect(tmpDir)).toBe(true);
  });

  it('detects when .cursorrules exists', async () => {
    await writeFile(join(tmpDir, '.cursorrules'), '# Rules');
    expect(await cursorAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await cursorAdapter.detect(tmpDir)).toBe(false);
  });

  it('generates .cursorrules with combined content', async () => {
    const config = createMockConfig();
    const files = await cursorAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.cursorrules');
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain('Do NOT execute shell commands.');
    expect(mainFile!.content).toContain('Code Style');
    expect(mainFile!.content).toContain('Testing');
  });

  it('generates .mdc rule files with YAML frontmatter', async () => {
    const config = createMockConfig();
    const files = await cursorAdapter.generate(config, {});

    const ruleFiles = files.filter(f => f.path.startsWith('.cursor/rules/'));
    expect(ruleFiles).toHaveLength(2);

    const testingRule = ruleFiles.find(f => f.path.includes('testing'));
    expect(testingRule).toBeDefined();
    expect(testingRule!.content).toContain('---');
    expect(testingRule!.content).toContain('description: Testing requirements');
    expect(testingRule!.content).toContain('alwaysApply: false');
    expect(testingRule!.content).toContain('globs: **/*.test.ts');
  });
});
