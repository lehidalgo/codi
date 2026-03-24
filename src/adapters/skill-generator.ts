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
  frontmatter.push('---');

  return `${frontmatter.join('\n')}\n\n${skill.content}`;
}

export function generateSkillFiles(
  skills: NormalizedSkill[],
  basePath: string,
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  for (const skill of skills) {
    const dirName = skill.name.toLowerCase().replace(/\s+/g, '-');
    const content = addGeneratedHeader(buildSkillMd(skill));
    files.push({
      path: `${basePath}/${dirName}/${SKILL_OUTPUT_FILENAME}`,
      content,
      sources: [MANIFEST_FILENAME],
      hash: hashContent(content),
    });
  }
  return files;
}
