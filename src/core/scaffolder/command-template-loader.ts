import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';
import * as commandTemplates from '../../templates/commands/index.js';

const TEMPLATE_MAP: Record<string, string> = {
  'review': commandTemplates.review,
  'test-run': commandTemplates.testRun,
};

export const AVAILABLE_COMMAND_TEMPLATES = Object.keys(TEMPLATE_MAP);

export function loadCommandTemplate(templateName: string): Result<string> {
  const content = TEMPLATE_MAP[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `command-template:${templateName}`,
    })]);
  }
  return ok(content);
}
