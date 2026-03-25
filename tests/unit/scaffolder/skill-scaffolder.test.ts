import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createSkill } from '../../../src/core/scaffolder/skill-scaffolder.js';

describe('skill scaffolder', () => {
  let tmpDir: string;
  let codiDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-skill-'));
    codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(codiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a skill file with default content', async () => {
    const result = await createSkill({ name: 'my-skill', codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toContain(path.join('my-skill', 'SKILL.md'));
    const content = await fs.readFile(result.data, 'utf-8');
    expect(content).toContain('name: my-skill');
    expect(content).toContain('managed_by: user');
    expect(content).toContain('Describe what this skill does');
  });

  it('creates a skill file with mcp template', async () => {
    const result = await createSkill({
      name: 'mcp-usage',
      codiDir,
      template: 'mcp',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, 'utf-8');
    expect(content).toContain('name: mcp-usage');
    expect(content).toContain('MCP (Model Context Protocol) server usage');
  });

  it('creates a skill file with code-review template', async () => {
    const result = await createSkill({
      name: 'review',
      codiDir,
      template: 'code-review',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, 'utf-8');
    expect(content).toContain('Structured code review workflow');
  });

  it('creates a skill file with documentation template', async () => {
    const result = await createSkill({
      name: 'docs',
      codiDir,
      template: 'documentation',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const content = await fs.readFile(result.data, 'utf-8');
    expect(content).toContain('Documentation creation and maintenance');
  });

  it('rejects invalid skill names', async () => {
    const result = await createSkill({ name: 'Invalid_Name', codiDir });
    expect(result.ok).toBe(false);
  });

  it('rejects names starting with a digit', async () => {
    const result = await createSkill({ name: '1bad', codiDir });
    expect(result.ok).toBe(false);
  });

  it('fails if skill already exists', async () => {
    await createSkill({ name: 'existing', codiDir });
    const result = await createSkill({ name: 'existing', codiDir });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.message).toContain('already exists');
  });

  it('fails with unknown template', async () => {
    const result = await createSkill({
      name: 'test',
      codiDir,
      template: 'nonexistent',
    });

    expect(result.ok).toBe(false);
  });

  it('writes to .codi/skills/<name>/SKILL.md directory structure', async () => {
    const result = await createSkill({ name: 'flat-test', codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = path.join(codiDir, 'skills', 'flat-test', 'SKILL.md');
    expect(result.data).toBe(expected);

    const evalsJson = await fs.readFile(
      path.join(codiDir, 'skills', 'flat-test', 'evals', 'evals.json'),
      'utf-8',
    );
    const parsed = JSON.parse(evalsJson);
    expect(parsed.skill_name).toBe('flat-test');
    expect(parsed.evals).toEqual([]);

    for (const sub of ['scripts', 'references', 'assets']) {
      const gitkeep = path.join(codiDir, 'skills', 'flat-test', sub, '.gitkeep');
      await expect(fs.access(gitkeep)).resolves.toBeUndefined();
    }
  });
});
