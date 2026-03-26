import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { windsurfAdapter } from '../../../src/adapters/windsurf.js';
import { createMockConfig } from './mock-config.js';
import { CONTEXT_TOKENS_SMALL } from '../../../src/constants.js';

describe('windsurf adapter', () => {
  const tmpDir = join(tmpdir(), 'codi-test-windsurf-' + Date.now());

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // --- Identity ---

  it('has correct id and name', () => {
    expect(windsurfAdapter.id).toBe('windsurf');
    expect(windsurfAdapter.name).toBe('Windsurf');
  });

  // --- Capabilities ---

  it('has correct capabilities', () => {
    expect(windsurfAdapter.capabilities).toEqual({
      rules: true,
      skills: true,
      commands: false,
      mcp: false,
      frontmatter: false,
      progressiveLoading: false,
      agents: false,
      maxContextTokens: CONTEXT_TOKENS_SMALL,
    });
  });

  // --- Paths ---

  it('has correct paths', () => {
    expect(windsurfAdapter.paths.configRoot).toBe('.');
    expect(windsurfAdapter.paths.rules).toBe('.');
    expect(windsurfAdapter.paths.skills).toBe('.windsurf/skills');
    expect(windsurfAdapter.paths.commands).toBeNull();
    expect(windsurfAdapter.paths.agents).toBeNull();
    expect(windsurfAdapter.paths.instructionFile).toBe('.windsurfrules');
    expect(windsurfAdapter.paths.mcpConfig).toBeNull();
  });

  // --- Detection ---

  it('detects when .windsurfrules exists', async () => {
    await writeFile(join(tmpDir, '.windsurfrules'), '# Rules');
    expect(await windsurfAdapter.detect(tmpDir)).toBe(true);
  });

  it('does not detect in empty directory', async () => {
    expect(await windsurfAdapter.detect(tmpDir)).toBe(false);
  });

  it('does not detect when only .windsurf/ directory exists (no .windsurfrules)', async () => {
    await mkdir(join(tmpDir, '.windsurf'), { recursive: true });
    expect(await windsurfAdapter.detect(tmpDir)).toBe(false);
  });

  // --- generate() with minimal config ---

  it('generates .windsurfrules with minimal config (empty rules, skills, flags)', async () => {
    const config = createMockConfig({ rules: [], skills: [], flags: {} });
    const files = await windsurfAdapter.generate(config, {});

    // Should produce only the main instruction file
    const mainFile = files.find(f => f.path === '.windsurfrules');
    expect(mainFile).toBeDefined();
    expect(mainFile!.content).toContain('## Workflow');
    expect(mainFile!.hash).toBeTruthy();
    expect(mainFile!.sources).toContain('codi.yaml');

    // No MCP or extra files
    const mcpFile = files.find(f => f.path === '.windsurf/mcp.json');
    expect(mcpFile).toBeUndefined();
  });

  // --- generate() with rules ---

  it('generates .windsurfrules with rules (no flags section)', async () => {
    const config = createMockConfig({ flags: {} });
    const files = await windsurfAdapter.generate(config, {});

    expect(files[0]!.path).toBe('.windsurfrules');
    expect(files[0]!.content).toContain('# Code Style');
    expect(files[0]!.content).toContain('# Testing');
    expect(files[0]!.content).not.toContain('Do NOT');
  });

  it('includes flag instructions when flags are set', async () => {
    const config = createMockConfig();
    const files = await windsurfAdapter.generate(config, {});

    expect(files[0]!.content).toContain('Do NOT execute shell commands.');
  });

  it('inlines rules as heading sections in .windsurfrules', async () => {
    const config = createMockConfig({
      rules: [{
        name: 'Security',
        description: 'Security rules',
        content: 'Never expose API keys.',
        priority: 'high',
        alwaysApply: true,
        managedBy: 'codi',
      }],
      flags: {},
    });
    const files = await windsurfAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.windsurfrules');
    expect(mainFile!.content).toContain('# Security');
    expect(mainFile!.content).toContain('Never expose API keys.');
  });

  // --- generate() with skills ---

  it('inlines skills when progressive_loading is off', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'deploy', description: 'Deploy skill', content: 'Run deploy' },
      ],
      flags: {},
    });
    const files = await windsurfAdapter.generate(config, {});

    const mainFile = files.find(f => f.path === '.windsurfrules');
    expect(mainFile!.content).toContain('# Skill: deploy');
    expect(mainFile!.content).toContain('Run deploy');
  });

  it('generates skill files in .windsurf/skills/', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'alpha', description: 'Alpha skill', content: 'Alpha content' },
      ],
      flags: {},
    });
    const files = await windsurfAdapter.generate(config, {});

    const skillFiles = files.filter(f => f.path.startsWith('.windsurf/skills/'));
    expect(skillFiles).toHaveLength(1);
    expect(skillFiles[0]!.path).toBe('.windsurf/skills/alpha/SKILL.md');
  });

  it('generates multiple skill files', async () => {
    const config = createMockConfig({
      skills: [
        { name: 'alpha', description: 'Alpha', content: 'A' },
        { name: 'beta', description: 'Beta', content: 'B' },
      ],
      flags: {},
    });
    const files = await windsurfAdapter.generate(config, {});

    const skillFiles = files.filter(f => f.path.startsWith('.windsurf/skills/'));
    expect(skillFiles).toHaveLength(2);
  });

  // --- MCP not supported (Windsurf only reads global MCP config) ---

  it('does not generate .windsurf/mcp.json (not supported by Windsurf)', async () => {
    const config = createMockConfig({
      mcp: {
        servers: {
          'my-server': {
            command: 'node',
            args: ['server.js'],
            env: { API_KEY: 'test-key' },
            enabled: true,
          },
        },
      },
    });
    const files = await windsurfAdapter.generate(config, {});

    const mcpFile = files.find(f => f.path === '.windsurf/mcp.json');
    expect(mcpFile).toBeUndefined();
  });

  // --- generate() produces unique hashes ---

  it('produces different hashes for different configs', async () => {
    const config1 = createMockConfig({ rules: [], flags: {} });
    const config2 = createMockConfig();

    const files1 = await windsurfAdapter.generate(config1, {});
    const files2 = await windsurfAdapter.generate(config2, {});

    const hash1 = files1.find(f => f.path === '.windsurfrules')!.hash;
    const hash2 = files2.find(f => f.path === '.windsurfrules')!.hash;
    expect(hash1).not.toBe(hash2);
  });

  // --- generate() all files have required fields ---

  it('all generated files have path, content, sources, and hash', async () => {
    const config = createMockConfig({
      skills: [{ name: 'sk', description: 'desc', content: 'c' }],
      mcp: { servers: { s: { command: 'x', enabled: true } } },
    });
    const files = await windsurfAdapter.generate(config, {});

    for (const file of files) {
      expect(file.path).toBeTruthy();
      expect(file.content).toBeTruthy();
      expect(file.sources).toBeDefined();
      expect(file.hash).toBeTruthy();
    }
  });
});
