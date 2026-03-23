export const template = `---
name: {{name}}
description: Code style and formatting conventions
priority: medium
alwaysApply: true
managed_by: codi
---

# Code Style

## Naming Conventions
- Variables and functions: camelCase
- Classes, interfaces, and types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case for modules, PascalCase for components
- Booleans: prefix with is, has, can, should (e.g., isActive, hasPermission)

## Functions
- Keep functions under 30 lines — extract when longer
- Single responsibility: one function does one thing
- Pure functions preferred: same input always produces same output
- Limit parameters to 3 — use an options object for more

## File Organization
- One primary export per file where practical
- Group imports: external libraries, internal modules, types
- Order imports alphabetically within each group
- Keep files focused on a single concern

## Error Handling
- Never silently swallow errors (empty catch blocks)
- Handle errors at the appropriate level, not everywhere
- Use typed errors when the language supports them
- Always clean up resources in finally blocks

## Comments
- Write self-documenting code first
- Comment the WHY, not the WHAT
- Remove commented-out code — version control has the history
- Use TODO/FIXME with ticket references, not open-ended notes`;
