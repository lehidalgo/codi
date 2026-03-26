import { describe, it, expect } from 'vitest';
import {
  buildSkillMd,
  buildSkillMetadataOnly,
  generateSkillFiles,
  buildSkillCatalog,
} from '../../../src/adapters/skill-generator.js';
import type { NormalizedSkill } from '../../../src/types/config.js';

const baseSkill: NormalizedSkill = {
  name: 'deploy',
  description: 'Deployment skill',
  content: 'Run deploy commands here.',
};

describe('buildSkillMd', () => {
  it('includes frontmatter with name and description', () => {
    const result = buildSkillMd(baseSkill);
    expect(result).toContain('name: deploy');
    expect(result).toContain('description: Deployment skill');
    expect(result).toContain('Run deploy commands here.');
  });

  it('includes disableModelInvocation when set', () => {
    const result = buildSkillMd({ ...baseSkill, disableModelInvocation: true });
    expect(result).toContain('disable-model-invocation: true');
  });

  it('includes argumentHint when set', () => {
    const result = buildSkillMd({ ...baseSkill, argumentHint: 'service name' });
    expect(result).toContain('argument-hint: "service name"');
  });

  it('includes allowedTools when set', () => {
    const result = buildSkillMd({ ...baseSkill, allowedTools: ['Read', 'Bash'] });
    expect(result).toContain('allowed-tools: Read, Bash');
  });

  it('includes license when set', () => {
    const result = buildSkillMd({ ...baseSkill, license: 'MIT' });
    expect(result).toContain('license: MIT');
  });

  it('includes metadata entries', () => {
    const result = buildSkillMd({ ...baseSkill, metadata: { author: 'test', version: '1.0' } });
    expect(result).toContain('metadata-author: "test"');
    expect(result).toContain('metadata-version: "1.0"');
  });

  it('omits optional fields when not set', () => {
    const result = buildSkillMd(baseSkill);
    expect(result).not.toContain('disable-model-invocation');
    expect(result).not.toContain('argument-hint');
    expect(result).not.toContain('allowed-tools');
    expect(result).not.toContain('license');
    expect(result).not.toContain('metadata-');
  });
});

describe('buildSkillMetadataOnly', () => {
  it('includes only name and description', () => {
    const result = buildSkillMetadataOnly(baseSkill);
    expect(result).toContain('name: deploy');
    expect(result).toContain('description: Deployment skill');
    expect(result).not.toContain('Run deploy commands');
  });

  it('includes reference to full skill file', () => {
    const result = buildSkillMetadataOnly(baseSkill);
    expect(result).toContain('.codi/skills/deploy/SKILL.md');
  });
});

describe('generateSkillFiles', () => {
  const skills: NormalizedSkill[] = [
    { name: 'deploy', description: 'Deploy', content: 'deploy content' },
    { name: 'review', description: 'Review', content: 'review content' },
  ];

  it('generates one SKILL.md per skill', () => {
    const files = generateSkillFiles(skills, '.claude/skills');
    expect(files).toHaveLength(2);
    expect(files[0]!.path).toBe('.claude/skills/deploy/SKILL.md');
    expect(files[1]!.path).toBe('.claude/skills/review/SKILL.md');
  });

  it('uses full content when progressive loading is off', () => {
    const files = generateSkillFiles(skills, '.test/skills', 'off');
    expect(files[0]!.content).toContain('deploy content');
  });

  it('uses metadata only when progressive loading is metadata', () => {
    const files = generateSkillFiles(skills, '.test/skills', 'metadata');
    expect(files[0]!.content).not.toContain('deploy content');
    expect(files[0]!.content).toContain('Full skill content available');
  });

  it('returns empty array for no skills', () => {
    const files = generateSkillFiles([], '.claude/skills');
    expect(files).toHaveLength(0);
  });

  it('each file has hash and sources', () => {
    const files = generateSkillFiles(skills, '.claude/skills');
    for (const file of files) {
      expect(file.hash).toBeDefined();
      expect(file.hash.length).toBeGreaterThan(0);
      expect(file.sources).toContain('codi.yaml');
    }
  });
});

describe('buildSkillCatalog', () => {
  it('returns null when no skills', () => {
    expect(buildSkillCatalog([])).toBeNull();
  });

  it('builds markdown table with skills', () => {
    const skills: NormalizedSkill[] = [
      { name: 'deploy', description: 'Deploy to production', content: 'c' },
      { name: 'review', description: 'Code review\nExtra detail', content: 'c' },
    ];
    const result = buildSkillCatalog(skills)!;
    expect(result).toContain('## Available Skills');
    expect(result).toContain('| deploy | Deploy to production |');
    expect(result).toContain('| review | Code review |');
    expect(result).toContain('.codi/skills/<name>/SKILL.md');
  });
});
