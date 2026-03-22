import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const TEMPLATES: Record<string, string> = {
  security: `---
name: {{name}}
description: Security best practices
priority: high
alwaysApply: true
managed_by: user
---

# Security Rules

- Never expose secrets, API keys, or credentials in code
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs
- Follow OWASP security guidelines`,

  'code-style': `---
name: {{name}}
description: Code style guidelines
priority: medium
alwaysApply: true
managed_by: user
---

# Code Style

- Follow consistent naming conventions
- Keep functions focused and small
- Write self-documenting code
- Add comments only for complex logic`,

  testing: `---
name: {{name}}
description: Testing standards
priority: medium
alwaysApply: true
managed_by: user
---

# Testing Standards

- Write tests for all new features
- Maintain minimum 80% code coverage
- Use descriptive test names
- Follow arrange-act-assert pattern`,

  architecture: `---
name: {{name}}
description: Architecture guidelines
priority: high
alwaysApply: true
managed_by: user
---

# Architecture Guidelines

- Follow established patterns in the codebase
- Keep files focused and under the configured line limit
- Prefer composition over inheritance
- Document architectural decisions`,
};

export const AVAILABLE_TEMPLATES = Object.keys(TEMPLATES);

export function loadTemplate(templateName: string): Result<string> {
  const content = TEMPLATES[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `template:${templateName}`,
    })]);
  }
  return ok(content);
}
