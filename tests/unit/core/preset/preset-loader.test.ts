import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadPresetFromDir } from '../../../../src/core/preset/preset-loader.js';

describe('loadPresetFromDir', () => {
  let tmpDir: string;
  let codiDir: string;
  let presetsDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codi-preset-loader-'));
    codiDir = path.join(tmpDir, '.codi');
    presetsDir = path.join(codiDir, 'presets');
    await fs.mkdir(presetsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves skills from skills/<name>/SKILL.md directory structure', async () => {
    // Create a preset manifest that references a skill by name
    const presetDir = path.join(presetsDir, 'test-preset');
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, 'preset.yaml'),
      [
        'name: test-preset',
        'description: Test preset',
        'version: 1.0.0',
        'artifacts:',
        '  skills:',
        '    - my-skill',
      ].join('\n'),
      'utf-8',
    );

    // Create the skill in directory structure (not flat file)
    const skillDir = path.join(codiDir, 'skills', 'my-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: A test skill',
        'managed_by: user',
        '---',
        '',
        'Skill content here.',
      ].join('\n'),
      'utf-8',
    );

    const result = await loadPresetFromDir('test-preset', presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(1);
    expect(result.data.skills[0]!.name).toBe('my-skill');
    expect(result.data.skills[0]!.description).toBe('A test skill');
  });

  it('returns empty skills when skill file does not exist', async () => {
    const presetDir = path.join(presetsDir, 'missing-skill');
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, 'preset.yaml'),
      [
        'name: missing-skill',
        'description: Preset with missing skill',
        'version: 1.0.0',
        'artifacts:',
        '  skills:',
        '    - nonexistent',
      ].join('\n'),
      'utf-8',
    );

    const result = await loadPresetFromDir('missing-skill', presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Skill not found → silently dropped (returns null from loader)
    expect(result.data.skills).toHaveLength(0);
  });

  it('loads flags-only preset without artifacts', async () => {
    const presetDir = path.join(presetsDir, 'flags-only');
    await fs.mkdir(presetDir, { recursive: true });
    await fs.writeFile(
      path.join(presetDir, 'preset.yaml'),
      [
        'name: flags-only',
        'description: Flags only preset',
        'version: 1.0.0',
      ].join('\n'),
      'utf-8',
    );

    const result = await loadPresetFromDir('flags-only', presetsDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toHaveLength(0);
    expect(result.data.rules).toHaveLength(0);
  });
});
