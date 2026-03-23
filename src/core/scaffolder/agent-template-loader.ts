import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import * as agentTemplates from '../../templates/agents/index.js';

const TEMPLATE_MAP: Record<string, string> = {
  'code-reviewer': agentTemplates.codeReviewer,
  'test-generator': agentTemplates.testGenerator,
  'security-analyzer': agentTemplates.securityAnalyzer,
};

export const AVAILABLE_AGENT_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadAgentTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `agent-template:${templateName}`,
    })]);
  }
  return ok(content);
}
