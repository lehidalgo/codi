import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import * as skillTemplates from '../../templates/skills/index.js';

const TEMPLATE_MAP: Record<string, string> = {
  'mcp': skillTemplates.mcp,
  'code-review': skillTemplates.codeReview,
  'documentation': skillTemplates.documentation,
  'codi-operations': skillTemplates.codiOperations,
  'e2e-testing': skillTemplates.e2eTesting,
  'artifact-creator': skillTemplates.artifactCreator,
  'security-scan': skillTemplates.securityScan,
  'test-coverage': skillTemplates.testCoverage,
  'refactoring': skillTemplates.refactoring,
  'codebase-onboarding': skillTemplates.codebaseOnboarding,
  'presentation': skillTemplates.presentation,
  'mobile-development': skillTemplates.mobileDevelopment,
  'commit': skillTemplates.commit,
  'preset-creator': skillTemplates.presetCreator,
  'contribute': skillTemplates.contribute,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadSkillTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `skill-template:${templateName}`,
    })]);
  }
  return ok(content);
}
