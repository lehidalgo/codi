import { ok, err } from '../../types/result.js';
import type { Result } from '../../types/result.js';
import { createError } from '../output/errors.js';

const SKILL_TEMPLATES: Record<string, string> = {
  mcp: `---
name: {{name}}
description: Guidelines for using MCP server tools. Use when interacting with MCP servers, calling MCP tools, or debugging MCP connections
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
description: Code review checklist and workflow. Use when reviewing PRs, examining code changes, or when asked to review code quality
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
description: Documentation creation and maintenance. Use when writing docs, updating README, generating API documentation, or creating guides
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

  'rule-management': `---
name: {{name}}
description: Create and manage codi rules. Use when the user asks to write, modify, update, or review codi rules and configuration
type: skill
compatibility: [claude-code, cursor, codex]
tools: []
---

# {{name}}

## When to Use

Use this skill when the user asks to create, modify, or update codi rules.

## Rule Format

Rules are Markdown files in \`.codi/rules/custom/\` with YAML frontmatter:

\`\`\`markdown
---
name: rule-name
description: One-line description
priority: high | medium | low
alwaysApply: true
managed_by: user | codi
---

# Rule Title

## Section
- Specific, actionable guideline
- Include measurable criteria where possible
\`\`\`

## Creating a New Rule

1. Run: \`codi add rule <name>\` (blank) or \`codi add rule <name> --template <template>\`
2. Edit \`.codi/rules/custom/<name>.md\` with the team's guidelines
3. Run: \`codi generate\` to push the rule to all agent configs
4. Run: \`codi status\` to verify no drift

## Modifying an Existing Rule

1. Edit the file in \`.codi/rules/custom/\`
2. If the rule has \`managed_by: codi\` and you want to keep custom changes, change it to \`managed_by: user\`
3. Run: \`codi generate\`

## managed_by Field

- \`managed_by: codi\` — template-managed, updated by \`codi update --rules\`
- \`managed_by: user\` — custom, never overwritten by codi

## Available Templates

security, code-style, testing, architecture, git-workflow, error-handling, performance, documentation, api-design

Add all at once: \`codi add rule --all\`

## Writing Guidelines

- Be specific: "Use 2-space indentation" not "Use consistent indentation"
- Be measurable: "80% test coverage" not "Write enough tests"
- Use imperative mood: "Validate all inputs" not "Inputs should be validated"
- Group under clear section headings
- Explain WHY when not obvious

## After Changes

Always run \`codi generate\` after modifying rules to update all agent config files.`,
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
