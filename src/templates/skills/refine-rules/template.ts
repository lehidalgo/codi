import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME,
  PLATFORM_CATEGORY,
  SUPPORTED_PLATFORMS_YAML,
} from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Review rule feedback collected by ${PROJECT_NAME}-rule-feedback and propose
  targeted improvements one at a time with human approval. Use when the
  user asks to improve rules, refine rules, process rule feedback, review
  collected observations, apply rule updates, or fix outdated rules. Also
  activate for phrases like "review .codi/feedback", "process rule
  feedback", "improve our rules", "update outdated rule", or on
  /${PROJECT_NAME}-refine-rules. Reads observations from
  \\\`${PROJECT_DIR}/feedback/rules/\\\`. Do NOT activate for creating a new
  rule from scratch (use ${PROJECT_NAME}-rule-creator) or for general
  quality audits without collected feedback (use
  ${PROJECT_NAME}-compare-preset or a direct review).
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Rule Refinement

## When to Activate

- User asks to review collected rule feedback or improve rules
- User asks to process observations accumulated in \\\`${PROJECT_DIR}/feedback/rules/\\\`
- User mentions an outdated rule, missing guidance, or wants a rule update
- User invokes /${PROJECT_NAME}-refine-rules

## Skip When

- User wants to create a brand-new rule — use ${PROJECT_NAME}-rule-creator
- User wants to diff local rules vs upstream — use ${PROJECT_NAME}-compare-preset
- No feedback has been collected yet — wait for ${PROJECT_NAME}-rule-feedback to accumulate observations
- User wants to refine skills, not rules — similar workflow via ${PROJECT_NAME}-skill-feedback-reporter + skill-creator

## Purpose

This skill reviews structured feedback collected by the rule-feedback skill and proposes targeted improvements to rules — always with human approval.

**Design principle:** Rules are sacred. Feedback is data. You propose; the human decides.

## Workflow

### Step 1 — Load Feedback

**[CODING AGENT]** Read all JSON files from \\\`${PROJECT_DIR}/feedback/rules/\\\`.

If the directory is empty or doesn't exist, inform the user:
> "No rule feedback collected yet. As you work, the rule-feedback skill automatically observes patterns, corrections, and outdated practices. Run this command again after a few coding sessions."

### Step 2 — Aggregate and Prioritize

**[CODING AGENT]** Group observations by \\\`ruleName\\\` and sort by priority:

1. **User corrections** (\\\`category: user-correction\\\`) — highest priority, the user explicitly said something
2. **High severity** — important gaps or outdated guidance
3. **Frequency** — rules with multiple observations need attention first
4. **Medium/low severity** — minor improvements

Present a summary table:

| Rule | Observations | Highest Severity | Top Category |
|------|-------------|-----------------|--------------|
| ${PROJECT_NAME}-testing | 3 | high | user-correction |
| ${PROJECT_NAME}-typescript | 2 | medium | outdated-rule |
| (no rule) | 1 | low | new-pattern |

### Step 3 — Review One at a Time

**[CODING AGENT]** For each rule with feedback (highest priority first):

1. **Show the observation(s):**
   - Quote the observation text
   - List all evidence points
   - Show the suggested change

2. **Read the current rule** from \\\`${PROJECT_DIR}/rules/<ruleName>.md\\\`

3. **Propose the specific change:**
   - Show what section to modify
   - Show the before/after diff
   - Explain the rationale

4. **Wait for user decision:**
   - **Approve** → Edit the rule file, mark feedback as resolved
   - **Reject** → Mark feedback as dismissed, move to next
   - **Skip** → Leave feedback for later review
   - **Edit** → User provides a modified version of the change

5. **For "new-pattern" observations without a ruleName:**
   - Propose creating a new custom rule: \\\`${PROJECT_CLI} add rule <name>\\\`
   - Or propose adding the pattern to an existing related rule

### Step 4 — Propagate Changes

**[CODING AGENT]** After all reviews:

\\\`\\\`\\\`bash
${PROJECT_CLI} generate
\\\`\\\`\\\`

This distributes updated rules to all configured agents.

### Step 5 — Cleanup

**[CODING AGENT]** Remove resolved and dismissed feedback:
- Delete JSON files for resolved/dismissed observations
- Keep skipped observations for future review
- Report: "Processed X observations: Y approved, Z rejected, W skipped"

## Handling Edge Cases

### Observation references a rule that doesn't exist
The rule may have been renamed or removed. Search \\\`${PROJECT_DIR}/rules/\\\` for similar names and ask the user which rule to update.

### Multiple conflicting observations for the same rule
Present all observations together so the user can decide on a coherent change rather than applying contradictory updates.

### Observation suggests a change already made
Check the current rule content against the suggestion. If already addressed, mark as resolved automatically.

## Related Skills

- **${PROJECT_NAME}-rule-feedback** — Collects the observations this skill reviews
- **${PROJECT_NAME}-rule-creator** — Create entirely new rules (when observations suggest gaps)
- **${PROJECT_NAME}-dev-operations** — General artifact management including rules
`;
