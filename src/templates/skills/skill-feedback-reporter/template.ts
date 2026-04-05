import {
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: Internal meta-skill. Activates after completing a task that used a skill. Writes structured JSON feedback to .codi/feedback/ for skill health metrics. Not for direct user invocation — fires automatically after substantive skill usage.
category: ${PROJECT_NAME_DISPLAY} Platform
compatibility: ${SUPPORTED_PLATFORMS_YAML}
user-invocable: false
disable-model-invocation: false
managed_by: ${PROJECT_NAME}
version: 3
---

# {{name}}

## Purpose

You are an AI coding agent that uses skills (slash commands) to complete tasks.
After you finish a task that involved using a skill, you MUST write a feedback
report so the skill can be improved over time. This is NOT optional.

## When to Report

Report feedback after **every** skill invocation where you performed substantive
work. Skip trivial invocations (e.g., skill loaded but immediately cancelled).

## Feedback JSON Schema

Write a single JSON file to \`${PROJECT_DIR}/feedback/\` with this exact structure:

\`\`\`json
{
  "id": "<uuid-v4>",
  "skillName": "<skill-name>",
  "timestamp": "<ISO-8601 datetime>",
  "agent": "<your-agent-id>",
  "taskSummary": "<what you did, max 500 chars>",
  "outcome": "<success | partial | failure>",
  "issues": [
    {
      "category": "<category>",
      "description": "<what went wrong, max 500 chars>",
      "severity": "<low | medium | high>"
    }
  ],
  "suggestions": [
    "<free-text improvement idea, max 500 chars>"
  ]
}
\`\`\`

## Field Reference

### agent
Your agent identifier. Use exactly one of:
- \`claude-code\` — Claude Code CLI or IDE extension
- \`codex\` — OpenAI Codex CLI
- \`cursor\` — Cursor IDE
- \`windsurf\` — Windsurf IDE
- \`cline\` — Cline VS Code extension

### outcome
- \`success\` — Skill worked as intended, task completed correctly
- \`partial\` — Skill helped but required workarounds or manual fixes
- \`failure\` — Skill did not produce useful output or led to errors

### Issue Categories

| Category | When to Use |
|----------|-------------|
| \`trigger-miss\` | Skill should have activated but did not |
| \`trigger-false\` | Skill activated when it should not have |
| \`unclear-step\` | A step in the skill was ambiguous or confusing |
| \`missing-step\` | The skill lacked a step needed for the task |
| \`wrong-output\` | Following the skill produced incorrect output |
| \`context-overflow\` | Skill content was too large for the context window |
| \`other\` | Issue does not fit other categories |

## File Naming

Save the file as:
\`\`\`
${PROJECT_DIR}/feedback/{timestamp}-{skill-name}.json
\`\`\`

Replace colons and dots in the timestamp with hyphens. Example:
\`\`\`
${PROJECT_DIR}/feedback/2026-03-28T21-30-00-000Z-commit.json
\`\`\`

## Examples

### Success with no issues
\`\`\`json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "skillName": "commit",
  "timestamp": "2026-03-28T21:30:00.000Z",
  "agent": "claude-code",
  "taskSummary": "Created conventional commit for auth feature addition",
  "outcome": "success",
  "issues": [],
  "suggestions": []
}
\`\`\`

### Partial success with issues
\`\`\`json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "skillName": "security-scan",
  "timestamp": "2026-03-28T22:15:00.000Z",
  "agent": "claude-code",
  "taskSummary": "Ran security scan on auth module, found 3 issues but missed CSRF",
  "outcome": "partial",
  "issues": [
    {
      "category": "missing-step",
      "description": "Skill does not include CSRF token validation checks",
      "severity": "high"
    }
  ],
  "suggestions": [
    "Add CSRF validation to the security scan checklist"
  ]
}
\`\`\`

## Important

- Generate a real UUID v4 for the \`id\` field
- Use the current ISO-8601 timestamp
- Keep \`taskSummary\` concise (under 500 characters)
- Only report genuine issues — do not fabricate problems
- If the skill worked perfectly, report \`success\` with empty issues
- Write the file AFTER completing the task, not during

## Related Skills

- **${PROJECT_NAME}-rule-feedback** — Write structured feedback on a specific rule (same feedback loop, rule-scoped)
`;
