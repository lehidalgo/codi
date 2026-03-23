import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import * as ruleTemplates from '../../templates/rules/index.js';

const TEMPLATE_MAP: Record<string, string> = {
  'security': ruleTemplates.security,
  'code-style': ruleTemplates.codeStyle,
  'testing': ruleTemplates.testing,
  'architecture': ruleTemplates.architecture,
  'git-workflow': ruleTemplates.gitWorkflow,
  'error-handling': ruleTemplates.errorHandling,
  'performance': ruleTemplates.performance,
  'documentation': ruleTemplates.documentation,
  'api-design': ruleTemplates.apiDesign,
};

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `template:${templateName}`,
    })]);
  }
  return ok(content);
}
