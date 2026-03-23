import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { codexAdapter } from '../../../src/adapters/codex.js';
import { createMockConfig } from './mock-config.js';

describe('codex adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-codex-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct id and name', () => {
    expect(codexAdapter.id).toBe('codex');
    expect(codexAdapter.name).toBe('Codex');
  });

  it('detects when AGENTS.md exists', async () => {
    await writeFile(join(tmpDir, 'AGENTS.md'), '# Agents');
    expect(await codexAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await codexAdapter.detect(tmpDir)).toBe(false);
  });

  it('generates AGENTS.md with rules and flag instructions', async () => {
    const config = createMockConfig();
    const files = await codexAdapter.generate(config, {});

    const agentsMd = files.find(f => f.path === 'AGENTS.md');
    expect(agentsMd).toBeDefined();
    expect(agentsMd!.content).toContain('Do NOT execute shell commands.');
    expect(agentsMd!.content).toContain('Keep source code files under 500 lines.');
    expect(agentsMd!.content).toContain('Code Style');
    expect(agentsMd!.content).toContain('Testing');
    expect(agentsMd!.hash).toBeTruthy();
  });

  it('generates skill files in .agents/skills/', async () => {
    const config = createMockConfig({
      skills: [{ name: 'test-skill', description: 'A test skill', content: 'Do something' }],
    });
    const files = await codexAdapter.generate(config, {});

    const skillFile = files.find(f => f.path.includes('.agents/skills/'));
    expect(skillFile).toBeDefined();
    expect(skillFile!.path).toBe('.agents/skills/test-skill/SKILL.md');
    expect(skillFile!.content).toContain('name: test-skill');

    const agentsMd = files.find(f => f.path === 'AGENTS.md');
    expect(agentsMd!.content).not.toContain('test-skill');
  });
});
