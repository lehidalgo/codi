import { MAX_FUNCTION_LINES } from '../../constants.js';

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
- Booleans: prefix with is, has, can, should (e.g., isActive, hasPermission) — makes conditionals read like English

## Functions
- Keep functions under ${MAX_FUNCTION_LINES} lines — longer functions are harder to test and reason about

BAD: A 60-line function doing validation + transformation + persistence
GOOD: Three focused functions: validate(), transform(), persist()

- Single responsibility: one function does one thing
- Pure functions preferred: same input always produces same output — easier to test and cache
- Limit parameters to 3 — use an options object for more

BAD: \`createUser(name, email, role, team, isActive, notify)\`
GOOD: \`createUser({ name, email, role, team, isActive, notify })\`

## File Organization
- One primary export per file where practical — simplifies imports and dependency tracking
- Group imports: external libraries, internal modules, types
- Order imports alphabetically within each group
- Keep files focused on a single concern

## Type Discipline
- Treat type errors as design feedback, not noise — fix the design, don't suppress the error
- Automate type generation in CI where applicable (API schemas, database types, GraphQL)

## Linting
- Always fix linting errors before moving to other tasks — never leave broken lint for later
- Never suppress linter warnings without a documented reason and ticket reference

## Error Handling
- Never silently swallow errors (empty catch blocks) — hidden failures cause hard-to-debug production issues
- Handle errors at the appropriate level, not everywhere
- Use typed errors when the language supports them
- Always clean up resources in finally blocks

## Comments
- Write self-documenting code first
- Comment the WHY, not the WHAT — the code already shows what it does

BAD: \`// increment counter\` above \`counter++\`
GOOD: \`// retry count resets after successful auth per RFC 6749 §4.1.3\`

- Remove commented-out code — version control has the history
- Use TODO/FIXME with ticket references, not open-ended notes`;
