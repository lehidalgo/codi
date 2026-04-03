import {
  PROJECT_DIR,
  PROJECT_NAME,
  PROJECT_NAME_DISPLAY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Background rule observation skill. Collects structured feedback about rules
  during coding sessions — pattern detection, outdated practices, missing examples,
  and user corrections. Writes observations to ${PROJECT_DIR}/feedback/rules/ for
  later review via /codi-refine-rules. Does NOT modify rules directly.
category: ${PROJECT_NAME_DISPLAY} Platform
compatibility: ${SUPPORTED_PLATFORMS_YAML}
user-invocable: false
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Rule Improvement
  examples:
    - "This rule seems outdated"
    - "The codebase always does X but the rule says Y"
version: 1
---

# Rule Feedback Collector

## Purpose

You are both a consumer and an observer of the rules loaded into your context. As you work, you may notice gaps, outdated guidance, or patterns the rules don't cover. This skill instructs you to capture those observations as structured feedback — never to modify rules directly.

**Rules are sacred.** Only humans promote feedback into rules. Your job is to collect evidence.

## When to Write Feedback

Write a rule observation when ANY of these occur during your work:

### 1. New Pattern Detected
You notice a codebase pattern repeated 2+ times that no existing rule covers.
- Example: Every service uses a Result type for error handling, but no rule documents this convention.
- Category: \\\`new-pattern\\\`

### 2. Outdated Rule
A rule recommends something the codebase has moved away from.
- Example: Rule says "use ESLint + Prettier" but the project uses Biome exclusively.
- Category: \\\`outdated-rule\\\`

### 3. Missing Example
A rule covers a topic but lacks a BAD/GOOD example for a pattern you encounter.
- Example: The testing rule says "mock only external dependencies" but doesn't show the pattern for this project's DI container.
- Category: \\\`missing-example\\\`

### 4. User Correction
The user corrects your behavior in a way that contradicts or extends a rule.
- Example: User says "don't mock the database in these tests" — contradicts the general mocking guidance.
- Category: \\\`user-correction\\\`, severity: \\\`high\\\`

## How to Write Feedback

**[CODING AGENT]** Write a JSON file to \\\`${PROJECT_DIR}/feedback/rules/\\\`:

\\\`\\\`\\\`json
{
  "id": "<generate-uuid>",
  "type": "rule-observation",
  "timestamp": "<ISO-8601>",
  "category": "new-pattern | outdated-rule | missing-example | user-correction",
  "ruleName": "<rule-name-or-null>",
  "observation": "<what you noticed — max 500 chars>",
  "evidence": ["<evidence-1>", "<evidence-2>"],
  "suggestedChange": "<what should change in the rule — max 500 chars>",
  "severity": "low | medium | high",
  "source": "pattern-detection | user-correction | api-deprecation",
  "resolved": false
}
\\\`\\\`\\\`

**Filename:** \\\`<timestamp>-<ruleName>.json\\\` (replace colons/dots with hyphens).

## Guardrails

- **Max 3 observations per session** — avoid noise, focus on the most impactful
- **Require 2+ evidence points** — no single-occurrence anecdotes
- **Check for duplicates first** — read existing feedback files before writing
- **User corrections are always high severity** — the user explicitly told you something
- **Never modify rules directly** — only write feedback JSON
- **Do not announce observations** — write silently unless the user asks about rule improvements

## What Happens Next

Collected feedback is reviewed when the user runs \\\`/codi-refine-rules\\\`. That skill reads all observations, groups them by rule, and proposes changes one at a time with human approval.

## Related Skills

- **codi-refine-rules** — Review and apply collected rule feedback
- **codi-skill-reporter** — Similar feedback system for skills (not rules)
`;
