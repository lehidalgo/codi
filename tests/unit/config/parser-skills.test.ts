import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanSkills, scanCodiDir } from '../../../src/core/config/parser.js';

describe('scanSkills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-parser-skills-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when skills dir does not exist', async () => {
    const result = await scanSkills(path.join(tmpDir, 'nonexistent'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('parses a valid skill file', async () => {
    const skillsDir = path.join(tmpDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, 'review.md'),
      `---
name: review
description: Code review skill
type: skill
compatibility: [claude-code]
tools: [read, grep]
---

Review code for bugs and security issues.
`,
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.name).toBe('review');
    expect(result.data[0]!.description).toBe('Code review skill');
    expect(result.data[0]!.content).toBe('Review code for bugs and security issues.');
    expect(result.data[0]!.compatibility).toEqual(['claude-code']);
    expect(result.data[0]!.tools).toEqual(['read', 'grep']);
  });

  it('parses multiple skill files', async () => {
    const skillsDir = path.join(tmpDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });

    for (const name of ['alpha', 'beta']) {
      await fs.writeFile(
        path.join(skillsDir, `${name}.md`),
        `---
name: ${name}
description: ${name} skill
type: skill
---

Content for ${name}.
`,
      );
    }

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
  });

  it('returns error for invalid frontmatter', async () => {
    const skillsDir = path.join(tmpDir, 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, 'bad.md'),
      `---
name: 123
---

Content.
`,
    );

    const result = await scanSkills(skillsDir);
    expect(result.ok).toBe(false);
  });
});

describe('scanCodiDir with skills', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-scan-skills-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('includes skills in parsed result', async () => {
    const codiDir = path.join(tmpDir, '.codi');
    await fs.mkdir(path.join(codiDir, 'skills'), { recursive: true });
    await fs.mkdir(path.join(codiDir, 'rules'), { recursive: true });

    await fs.writeFile(
      path.join(codiDir, 'codi.yaml'),
      `name: test-project\nversion: "1"\n`,
    );

    await fs.writeFile(
      path.join(codiDir, 'skills', 'my-skill.md'),
      `---
name: my-skill
description: A test skill
type: skill
---

Skill content here.
`,
    );

    const result = await scanCodiDir(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.skills[0]!.name).toBe('my-skill');
  });
});
