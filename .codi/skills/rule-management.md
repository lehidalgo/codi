---
name: rule-management
description: Create and manage codi rules. Use when the user asks to write, modify, update, or review codi rules and configuration
type: skill
compatibility: [claude-code, cursor, codex]
tools: []
managed_by: codi
---

# rule-management

## When to Use

Use this skill when the user asks to create, modify, or update codi rules.

## Rule Format

Rules are Markdown files in `.codi/rules/custom/` with YAML frontmatter:

```markdown
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
```

## Creating a New Rule

1. Run: `codi add rule <name>` (blank) or `codi add rule <name> --template <template>`
2. Edit `.codi/rules/custom/<name>.md` with the team's guidelines
3. Run: `codi generate` to push the rule to all agent configs
4. Run: `codi status` to verify no drift

## Modifying an Existing Rule

1. Edit the file in `.codi/rules/custom/`
2. If the rule has `managed_by: codi` and you want to keep custom changes, change it to `managed_by: user`
3. Run: `codi generate`

## managed_by Field

- `managed_by: codi` — template-managed, updated by `codi update --rules`
- `managed_by: user` — custom, never overwritten by codi

## Available Templates

security, code-style, testing, architecture, git-workflow, error-handling, performance, documentation, api-design

Add all at once: `codi add rule --all`

## Writing Guidelines

- Be specific: "Use 2-space indentation" not "Use consistent indentation"
- Be measurable: "80% test coverage" not "Write enough tests"
- Use imperative mood: "Validate all inputs" not "Inputs should be validated"
- Group under clear section headings
- Explain WHY when not obvious

## After Changes

Always run `codi generate` after modifying rules to update all agent config files.
