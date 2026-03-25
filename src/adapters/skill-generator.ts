import type { NormalizedSkill } from '../types/config.js';
import type { GeneratedFile } from '../types/agent.js';
import { hashContent } from '../utils/hash.js';
import { addGeneratedHeader } from './generated-header.js';
import { SKILL_OUTPUT_FILENAME, MANIFEST_FILENAME } from '../constants.js';

export function buildSkillMd(skill: NormalizedSkill): string {
  const frontmatter: string[] = ['---'];
  frontmatter.push(`name: ${skill.name}`);
  frontmatter.push(`description: ${skill.description}`);
  if (skill.disableModelInvocation) {
    frontmatter.push('disable-model-invocation: true');
  }
  if (skill.argumentHint) {
    frontmatter.push(`argument-hint: "${skill.argumentHint}"`);
  }
  if (skill.allowedTools && skill.allowedTools.length > 0) {
    frontmatter.push(`allowed-tools: ${skill.allowedTools.join(', ')}`);
  }
  if (skill.license) {
    frontmatter.push(`license: ${skill.license}`);
  }
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    for (const [key, value] of Object.entries(skill.metadata)) {
      frontmatter.push(`metadata-${key}: "${value}"`);
    }
  }
  frontmatter.push('---');

  return `${frontmatter.join('\n')}\n\n${skill.content}`;
}

/** Build a metadata-only SKILL.md (Tier 1 — name + description only). */
export function buildSkillMetadataOnly(skill: NormalizedSkill): string {
  const lines = [
    '---',
    `name: ${skill.name}`,
    `description: ${skill.description}`,
    '---',
    '',
    `Full skill content available at: .codi/skills/${skill.name}/SKILL.md`,
  ];
  return lines.join('\n');
}

export type ProgressiveLoadingMode = 'off' | 'metadata' | 'full';

export function generateSkillFiles(
  skills: NormalizedSkill[],
  basePath: string,
  progressiveLoading: ProgressiveLoadingMode = 'off',
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  for (const skill of skills) {
    const dirName = skill.name.toLowerCase().replace(/\s+/g, '-');
    const raw = progressiveLoading === 'off'
      ? buildSkillMd(skill)
      : buildSkillMetadataOnly(skill);
    const content = addGeneratedHeader(raw);
    files.push({
      path: `${basePath}/${dirName}/${SKILL_OUTPUT_FILENAME}`,
      content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(content),
    });
  }
  return files;
}

/** Build an inline skill catalog for agents without separate file discovery. */
export function buildSkillCatalog(skills: NormalizedSkill[]): string | null {
  if (skills.length === 0) return null;
  const lines = [
    '## Available Skills',
    '',
    '| Skill | Description |',
    '|-------|-------------|',
  ];
  for (const skill of skills) {
    const desc = skill.description.split('\n')[0]?.trim() ?? '';
    lines.push(`| ${skill.name} | ${desc} |`);
  }
  lines.push('');
  lines.push('Full skill content: `.codi/skills/<name>/SKILL.md`');
  return lines.join('\n');
}
