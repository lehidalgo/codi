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
  Review and refine rules from collected feedback. Two modes: REVIEW (read-only
  summary of \\\`${PROJECT_DIR}/feedback/\\\` grouped by artifact with top 3
  actions) and REFINE (interactive one-at-a-time approval flow that edits rule
  files and runs \\\`${PROJECT_CLI} generate\\\`). Use when the user asks to
  review collected observations, show accumulated feedback, audit
  \\\`${PROJECT_DIR}/feedback/\\\`, improve rules, refine rules, process rule
  feedback, apply rule updates, or fix outdated rules. Also activates on
  /${PROJECT_NAME}-refine-rules or phrases like "show feedback summary",
  "what's accumulated", "review observations", "process rule feedback",
  "update outdated rule". Do NOT activate for creating a brand-new rule (use
  ${PROJECT_NAME}-rule-creator), emitting new observations during work (that
  happens automatically via ${PROJECT_NAME}-rule-feedback), or general quality
  audits without collected feedback (use ${PROJECT_NAME}-compare-preset).
category: ${PLATFORM_CATEGORY}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 7
---

# {{name}} — Review and Refine Rules

Two modes on one pipeline:

| Mode | Trigger | Output | Modifies rules? |
|------|---------|--------|-----------------|
| **REVIEW** | "show feedback", "what's accumulated", "summary" | Read-only grouped summary | No |
| **REFINE** | "refine rules", "improve rules", "process feedback", /${PROJECT_NAME}-refine-rules | Interactive one-at-a-time approval + edits | Yes |

Start in REVIEW mode when the user just wants visibility. Move to REFINE when they are ready to apply changes.

## Skip When

- User wants to create a brand-new rule — use ${PROJECT_NAME}-rule-creator
- User is emitting a new observation during coding work — ${PROJECT_NAME}-rule-feedback handles it automatically
- User wants to diff local rules vs upstream templates — use ${PROJECT_NAME}-compare-preset
- No feedback has been collected yet — wait for ${PROJECT_NAME}-rule-feedback to accumulate observations
- Feedback directory is empty — this skill still works but reports "no observations"

---

## Mode: REVIEW (read-only summary)

Read the observations collected in \\\`${PROJECT_DIR}/feedback/\\\` and show a concise summary grouped by artifact. This is the first step before running the REFINE mode.

Observations are written automatically by the Stop hook — the agent emits a \\\`[CODI-OBSERVATION: ...]\\\` marker in its response and the hook structures it into JSON. You do not write feedback files manually.

### REVIEW Steps

1. Read all JSON files in \\\`${PROJECT_DIR}/feedback/\\\`
2. Group observations by \\\`artifactName\\\` (skill or rule)
3. Within each group, sort by severity (high → medium → low), then by timestamp (newest first)
4. Show the top 3 most actionable observations across all groups
5. For each, show: artifact name, category, observation text, severity, and date

### REVIEW Output Format

\\\`\\\`\\\`
## Feedback Summary — N observations across M artifacts

### ${PROJECT_NAME}-commit (2 observations)
1. [HIGH] trigger-miss — skill did not activate when user typed /${PROJECT_NAME}-commit directly (2026-04-10)
2. [LOW] missing-step — no step to verify staged files are not empty before committing (2026-04-08)

### ${PROJECT_NAME}-testing (1 observation)
3. [MEDIUM] outdated-rule — rule says use Jest but project migrated to Vitest (2026-04-09)

---
Run /${PROJECT_NAME}-refine-rules to review these one by one and propose changes.
\\\`\\\`\\\`

If no feedback exists, report: "No observations in \\\`${PROJECT_DIR}/feedback/\\\` yet. The system collects them automatically as you work."

---

## Mode: REFINE (interactive one-at-a-time edits)

Review collected feedback and propose targeted improvements to rules — always with human approval.

**Design principle:** Rules are sacred. Feedback is data. You propose; the human decides.

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
- **${PROJECT_NAME}-skill-creator** — Refine or create new skills
- **${PROJECT_NAME}-dev-operations** — General artifact management
`;
