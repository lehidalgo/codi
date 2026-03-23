import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { claudeCodeAdapter } from '../../../src/adapters/claude-code.js';
import { createMockConfig } from './mock-config.js';

describe('claude-code adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-claude-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct id and name', () => {
    expect(claudeCodeAdapter.id).toBe('claude-code');
    expect(claudeCodeAdapter.name).toBe('Claude Code');
  });

  it('detects when CLAUDE.md exists', async () => {
    await writeFile(join(tmpDir, 'CLAUDE.md'), '# Test');
    expect(await claudeCodeAdapter.detect(tmpDir)).toBe(true);
  });

  it('detects when .claude/ directory exists', async () => {
    await mkdir(join(tmpDir, '.claude'), { recursive: true });
    expect(await claudeCodeAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await claudeCodeAdapter.detect(tmpDir)).toBe(false);
  });

  it('generates CLAUDE.md with rules and flag instructions', async () => {
    const config = createMockConfig();
    const files = await claudeCodeAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === 'CLAUDE.md');
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain('Do NOT execute shell commands.');
    expect(mainFile!.content).toContain('Do NOT delete files.');
    expect(mainFile!.content).toContain('Keep source code files under 500 lines.');
    expect(mainFile!.content).toContain('Write tests for all new code.');
    expect(mainFile!.content).not.toContain('Code Style');
    expect(mainFile!.content).not.toContain('Use 2-space indentation');
    expect(mainFile!.hash).toBeTruthy();
  });

  it('generates rule files without frontmatter', async () => {
    const config = createMockConfig();
    const files = await claudeCodeAdapter.generate(config, {});

    const ruleFiles = files.filter(f => f.path.startsWith('.claude/rules/'));
    expect(ruleFiles).toHaveLength(2);
    expect(ruleFiles[0]!.path).toBe('.claude/rules/code-style.md');
    expect(ruleFiles[0]!.content).not.toContain('---');
    expect(ruleFiles[0]!.content).toContain('# Code Style');
  });
});
