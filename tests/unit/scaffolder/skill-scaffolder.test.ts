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

    expect(result.data).toContain('my-skill.md');
    const content = await fs.readFile(result.data, 'utf-8');
    expect(content).toContain('name: my-skill');
    expect(content).toContain('type: skill');
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
    expect(content).toContain('Guidelines for using MCP server tools');
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
    expect(content).toContain('Code review checklist and workflow');
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

  it('writes to .codi/skills/ flat directory', async () => {
    const result = await createSkill({ name: 'flat-test', codiDir });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = path.join(codiDir, 'skills', 'flat-test.md');
    expect(result.data).toBe(expected);
  });
});
