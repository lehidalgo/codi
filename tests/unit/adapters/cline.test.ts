import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clineAdapter } from '../../../src/adapters/cline.js';
import { createMockConfig } from './mock-config.js';
import { CONTEXT_TOKENS_LARGE } from '../../../src/constants.js';

describe('cline adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-cline-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --- Identity ---

  it('has correct id and name', () => {
    expect(clineAdapter.id).toBe('cline');
    expect(clineAdapter.name).toBe('Cline');
  });

  // --- Capabilities ---

  it('has correct capabilities', () => {
    expect(clineAdapter.capabilities).toEqual({
      rules: true,
      skills: true,
      commands: false,
      mcp: false,
      frontmatter: false,
      progressiveLoading: false,
      agents: false,
      maxContextTokens: CONTEXT_TOKENS_LARGE,
    });
  });

  // --- Paths ---

  it('has correct paths', () => {
    expect(clineAdapter.paths.configRoot).toBe('.cline');
    expect(clineAdapter.paths.rules).toBe('.cline');
    expect(clineAdapter.paths.skills).toBe('.cline/skills');
    expect(clineAdapter.paths.commands).toBeNull();
    expect(clineAdapter.paths.agents).toBeNull();
    expect(clineAdapter.paths.instructionFile).toBe('.clinerules');
    expect(clineAdapter.paths.mcpConfig).toBeNull();
  });

  // --- Detection ---

  it('detects when .clinerules exists', async () => {
    await writeFile(join(tmpDir, '.clinerules'), '# Rules');
    expect(await clineAdapter.detect(tmpDir)).toBe(true);
  });

  it('detects when .cline/ directory exists', async () => {
    await mkdir(join(tmpDir, '.cline'), { recursive: true });
    expect(await clineAdapter.detect(tmpDir)).toBe(true);
  });

  it('detects when both .clinerules and .cline/ exist', async () => {
    await writeFile(join(tmpDir, '.clinerules'), '# Rules');
    await mkdir(join(tmpDir, '.cline'), { recursive: true });
    expect(await clineAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await clineAdapter.detect(tmpDir)).toBe(false);
  });

  // --- generate() with minimal config ---

  it('generates .clinerules with minimal config (empty rules, skills, flags)', async () => {
    const config = createMockConfig({ rules: [], skills: [], flags: {} });
    const files = await clineAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.clinerules');
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain('## Workflow');
    expect(mainFile!.hash).toBeTruthy();
    expect(mainFile!.sources).toContain('codi.yaml');

    // Only the instruction file, no extras
    expect(files).toHaveLength(1);
  });

  // --- generate() with rules ---

  it('generates .clinerules with rules and flag instructions', async () => {
    const config = createMockConfig();
    const files = await clineAdapter.generate(config, {});

    expect(files[0]!.path).toBe('.clinerules');
    expect(files[0]!.content).toContain('Do NOT execute shell commands.');
    expect(files[0]!.content).toContain('Write tests for all new code.');
    expect(files[0]!.content).toContain('Code Style');
    expect(files[0]!.hash).toBeTruthy();
  });

  it('inlines rules as heading sections in .clinerules', async () => {
    const config = createMockConfig({
      rules: [
        {
          name: 'Naming',
          description: 'Naming conventions',
          content: 'Use camelCase for variables.',
          priority: 'medium',
          alwaysApply: true,
          managedBy: 'codi',
        },
        {
          name: 'Error Handling',
          description: 'Error handling rules',
          content: 'Always catch errors.',
          priority: 'high',
          alwaysApply: true,
          managedBy: 'codi',
        },
      ],
      flags: {},
    });
    const files = await clineAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.clinerules');
    expect(mainFile!.content).toContain('# Naming');
    expect(mainFile!.content).toContain('Use camelCase for variables.');
    expect(mainFile!.content).toContain('# Error Handling');
    expect(mainFile!.content).toContain('Always catch errors.');
  });

  it('generates .clinerules without flag section when flags are empty', async () => {
    const config = createMockConfig({ flags: {} });
    const files = await clineAdapter.generate(config, {});

    expect(files[0]!.content).not.toContain('Do NOT');
  });

  // --- generate() with skills ---

  it('inlines skills when progressive_loading is off', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'deploy', description: 'Deploy skill', content: 'Run deploy commands' },
      ],
      flags: {},
    });
    const files = await clineAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.clinerules');
    expect(mainFile!.content).toContain('# Skill: deploy');
    expect(mainFile!.content).toContain('Run deploy commands');
  });

  it('generates skill files in .cline/skills/', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'review', description: 'Code review', content: 'Review code' },
      ],
      flags: {},
    });
    const files = await clineAdapter.generate(config, {});

    const skillMds = files.filter(f => f.path.startsWith('.cline/skills/') && f.path.endsWith('SKILL.md'));
    expect(skillMds).toHaveLength(1);
    expect(skillMds[0]!.path).toBe('.cline/skills/review/SKILL.md');
  });

  it('generates multiple skill files', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'alpha', description: 'Alpha', content: 'A' },
        { name: 'beta', description: 'Beta', content: 'B' },
        { name: 'gamma', description: 'Gamma', content: 'G' },
      ],
      flags: {},
    });
    const files = await clineAdapter.generate(config, {});

    const skillMds = files.filter(f => f.path.startsWith('.cline/skills/') && f.path.endsWith('SKILL.md'));
    expect(skillMds).toHaveLength(3);
    expect(skillMds.find(f => f.path === '.cline/skills/alpha/SKILL.md')).toBeDefined();
    expect(skillMds.find(f => f.path === '.cline/skills/beta/SKILL.md')).toBeDefined();
    expect(skillMds.find(f => f.path === '.cline/skills/gamma/SKILL.md')).toBeDefined();
  });

  // --- Cline does NOT support MCP ---

  it('does not generate any MCP config files', async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          'my-server': {
            command: 'node',
            args: ['server.js'],
            enabled: true,
          },
        },
      },
    });
    const files = await clineAdapter.generate(config, {});

    const mcpFiles = files.filter(f => f.path.includes('mcp'));
    expect(mcpFiles).toHaveLength(0);
  });

  // --- Cline does NOT support agents ---

  it('does not generate agent files even when agents are in config', async () => {
    const config = createMockConfig({
      agents: [{
        name: 'reviewer',
        description: 'Code reviewer',
        content: 'Review code',
      }],
    });
    const files = await clineAdapter.generate(config, {});

    const agentFiles = files.filter(f => f.path.includes('agents'));
    expect(agentFiles).toHaveLength(0);
  });

  // --- generate() produces unique hashes ---

  it('produces different hashes for different configs', async () => {
    const config1 = createMockConfig({ rules: [], flags: {} });
    const config2 = createMockConfig();

    const files1 = await clineAdapter.generate(config1, {});
    const files2 = await clineAdapter.generate(config2, {});

    const hash1 = files1.find(f => f.path === '.clinerules')!.hash;
    const hash2 = files2.find(f => f.path === '.clinerules')!.hash;
    expect(hash1).not.toBe(hash2);
  });

  // --- generate() all files have required fields ---

  it('all generated files have path, content, sources, and hash', async () => {
    const config = createMockConfig({
      skills: [{ name: 'sk', description: 'desc', content: 'c' }],
    });
    const files = await clineAdapter.generate(config, {});

    for (const file of files) {
      expect(file.path).toBeTruthy();
      if (!file.path.endsWith('.gitkeep')) {
        expect(file.content).toBeTruthy();
      }
      expect(file.sources).toBeDefined();
      expect(file.hash).toBeDefined();
    }
  });
});
