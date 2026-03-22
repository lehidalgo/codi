import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const SKILL_TEMPLATES: Record<string, string> = {
  mcp: `---
name: {{name}}
description: MCP server usage skill
type: skill
compatibility: [claude-code]
tools: []
---

# {{name}}

## When to Use

Use this skill when interacting with MCP servers.

## Instructions

- Check available MCP tools before starting
- Validate tool parameters before calling
- Handle MCP connection errors gracefully
- Log tool results for debugging`,

  'code-review': `---
name: {{name}}
description: Code review workflow skill
type: skill
compatibility: []
tools: []
---

# {{name}}

## When to Use

Use this skill when reviewing code changes.

## Instructions

- Check for security vulnerabilities
- Verify error handling coverage
- Ensure consistent naming conventions
- Validate test coverage for changes
- Flag performance concerns`,

  documentation: `---
name: {{name}}
description: Documentation generation skill
type: skill
compatibility: []
tools: []
---

# {{name}}

## When to Use

Use this skill when generating or updating documentation.

## Instructions

- Use clear, concise language
- Include code examples where appropriate
- Follow the project's documentation standards
- Keep documentation close to the code it describes
- Update related docs when code changes`,
};

export const AVAILABLE_SKILL_TEMPLATES = Object.keys(SKILL_TEMPLATES);

export function loadSkillTemplate(templateName: string): Result<string> {
  const content = SKILL_TEMPLATES[templateName];
  if (!content) {
    return err([createError('E_CONFIG_NOT_FOUND', {
      path: `skill-template:${templateName}`,
    })]);
  }
  return ok(content);
}
