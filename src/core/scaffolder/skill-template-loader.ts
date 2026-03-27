import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import type { TemplateCounts } from '../../templates/skills/types.js';
import { AVAILABLE_TEMPLATES } from './template-loader.js';
import { AVAILABLE_AGENT_TEMPLATES } from './agent-template-loader.js';
import { AVAILABLE_COMMAND_TEMPLATES } from './command-template-loader.js';
import { FLAG_CATALOG } from '../flags/flag-catalog.js';
import * as skillTemplates from '../../templates/skills/index.js';

type TemplateEntry = string | ((counts: TemplateCounts) => string);

const TEMPLATE_MAP: Record<string, TemplateEntry> = {
  'mcp': skillTemplates.mcp,
  'code-review': skillTemplates.codeReview,
  'documentation': skillTemplates.documentation,
  'codi-operations': skillTemplates.getCodiOperationsTemplate,
  'e2e-testing': skillTemplates.getE2eTestingTemplate,
  'security-scan': skillTemplates.securityScan,
  'test-coverage': skillTemplates.testCoverage,
  'refactoring': skillTemplates.refactoring,
  'codebase-onboarding': skillTemplates.codebaseOnboarding,
  'presentation': skillTemplates.presentation,
  'mobile-development': skillTemplates.mobileDevelopment,
  'commit': skillTemplates.commit,
  'preset-creator': skillTemplates.presetCreator,
  'contribute': skillTemplates.contribute,
  'skill-creator': skillTemplates.skillCreator,
  'rule-creator': skillTemplates.ruleCreator,
  'agent-creator': skillTemplates.agentCreator,
  'command-creator': skillTemplates.commandCreator,
  'guided-qa-testing': skillTemplates.guidedQaTesting,
  'mcp-server-creator': skillTemplates.mcpServerCreator,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(TEMPLATE_MAP);

function getTemplateCounts(): TemplateCounts {
  return {
    rules: AVAILABLE_TEMPLATES.length,
    skills: AVAILABLE_SKILL_TEMPLATES.length,
    agents: AVAILABLE_AGENT_TEMPLATES.length,
    commands: AVAILABLE_COMMAND_TEMPLATES.length,
    flags: Object.keys(FLAG_CATALOG).length,
  };
}

export function loadSkillTemplate(templateName: string): Result<string> {
  const entry = TEMPLATE_MAP[templateName];
  if (!entry) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `skill-template:${templateName}`,
    })]);
  }
  const content = typeof entry === 'function' ? entry(getTemplateCounts()) : entry;
  return ok(content);
}
