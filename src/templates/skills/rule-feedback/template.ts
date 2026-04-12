import { PROJECT_NAME, PLATFORM_CATEGORY, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: "Rule observation skill. Activates when the agent notices a gap, outdated guidance, or missing example in a loaded rule. Emits a CODI-OBSERVATION marker — the Stop hook collects and structures it automatically."
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
user-invocable: false
disable-model-invocation: false
managed_by: ${PROJECT_NAME}
version: 6
---

# Rule Feedback

## Purpose

You are both a consumer and an observer of the rules loaded into your context. When you notice a gap, outdated guidance, or missing example, emit a one-line marker in your response. The system collects and structures this automatically — you do not write files.

**Rules are not changed directly.** Observations are reviewed when the user runs \\\`/${PROJECT_NAME}-refine-rules\\\`.

## When to Emit an Observation

Emit a marker when ANY of these occur during your work:

### 1. New Pattern Detected
A codebase pattern appears 2+ times but no existing rule covers it.
- Example: Every service uses a Result type for error handling, but no rule documents this.
- Category: \\\`missing-step\\\`

### 2. Outdated Rule
A rule recommends something the codebase has moved away from.
- Example: Rule says "use ESLint + Prettier" but the project uses Biome exclusively.
- Category: \\\`outdated-rule\\\`

### 3. Missing Example
A rule covers a topic but lacks a BAD/GOOD example for a pattern you encounter.
- Example: The testing rule says "mock only external dependencies" but shows no example for this project's DI container.
- Category: \\\`missing-example\\\`

### 4. User Correction
The user corrects behaviour that contradicts or extends a rule.
- Example: User says "don't mock the database in these tests."
- Category: \\\`user-correction\\\` (severity: high — always emit)

## How to Emit

Add this marker anywhere in your normal response text:

\\\`\\\`\\\`
[CODI-OBSERVATION: <rule-name> | <category> | <observation text, max 200 chars>]
\\\`\\\`\\\`

**Categories:** \\\`missing-step\\\`, \\\`outdated-rule\\\`, \\\`missing-example\\\`, \\\`user-correction\\\`, \\\`trigger-miss\\\`, \\\`trigger-false\\\`, \\\`wrong-output\\\`

**Example:**

\\\`\\\`\\\`
[CODI-OBSERVATION: codi-testing | outdated-rule | rule says use Jest but project migrated to Vitest — all test files use vitest imports]
\\\`\\\`\\\`

The Stop hook scans your response, extracts the marker, and writes a structured JSON file to \\\`.codi/feedback/\\\`. You do not touch the file system.

## Guardrails

- **Max 3 observations per session** — focus on the most impactful gaps
- **Require 2+ evidence points** — no single-occurrence anecdotes
- **User corrections are always high severity** — always emit them, no evidence threshold
- **Do not announce observations** — emit the marker inline, do not draw attention to it

## Related Skills

- **${PROJECT_NAME}-refine-rules** — Review and apply collected rule feedback
- **${PROJECT_NAME}-skill-feedback-reporter** — Review accumulated skill and rule observations
`;
