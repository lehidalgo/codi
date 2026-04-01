import { PROJECT_CLI, PROJECT_DIR, PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Error recovery and session health skill. Activate when you have corrected
  your own mistakes 2 or more times in the current conversation. Produces a
  diagnostic report analyzing what went wrong, why, and how to prevent it.
category: Code Quality
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: Error Recovery
  examples:
    - "Help me fix this error"
    - "Debug this failure"
---

# {{name}}

## When to Activate

Activate this skill when **any** of these are true:

- You have corrected your own approach, code, or assumptions **2 or more times** in this conversation
- You have encountered repeated test failures, lint errors, or type errors caused by your own output
- The user has pointed out the same kind of mistake more than once
- You notice yourself reverting changes you just made or trying a third approach to the same problem

**Self-check trigger:** Before continuing after a second correction, pause and ask yourself:
> "Have I already fixed a mistake I introduced earlier in this conversation?"
> If yes — activate this skill immediately.

## Error Recovery Process

### Step 1 — Stop and Acknowledge

**[CODING AGENT]** Do NOT continue with the current task. Instead:

1. Tell the user: "I've corrected my approach multiple times. Let me generate a diagnostic report before continuing."
2. Do not attempt further fixes until the report is complete.

### Step 2 — Build the Error Timeline

**[CODING AGENT]** Review the conversation and reconstruct the error timeline:

For each error you made, record:
- **What happened**: The specific mistake (wrong path, bad assumption, broken code, etc.)
- **When it happened**: What step or action triggered it
- **Root cause**: Why you made the mistake (stale context, wrong assumption, missing information, hallucinated API, etc.)
- **How it was fixed**: The correction applied
- **Time wasted**: Rough estimate of how many messages/steps were spent on this error

### Step 3 — Identify Patterns

**[CODING AGENT]** Analyze the errors for patterns:

| Pattern | Check |
|---------|-------|
| **Stale context** | Did you rely on information from earlier in the conversation that became outdated? |
| **Assumption cascade** | Did one wrong assumption lead to a chain of dependent errors? |
| **Missing verification** | Did you skip a check (file exists, test passes, type compiles) before proceeding? |
| **Hallucinated API/path** | Did you reference a function, file, or API that doesn't exist? |
| **Scope creep** | Did you change more than was asked, introducing unrelated breakage? |
| **Copy-paste drift** | Did you copy a pattern from one place but miss adapting it to the new context? |
| **Environment mismatch** | Did you assume a tool, version, or config that wasn't present? |

### Step 4 — Generate the Report

**[CODING AGENT]** Write a markdown report to the project docs directory.

**Filename format**: \\\`YYYYMMDD_HHMM_REVIEW_error-recovery.md\\\`

**Report structure**:

\\\`\\\`\\\`markdown
# Error Recovery Report
**Date**: YYYY-MM-DD HH:MM
**Document**: YYYYMMDD_HHMM_REVIEW_error-recovery.md
**Category**: REVIEW

## Summary

- **Errors corrected**: [number]
- **Root cause pattern**: [most common pattern from Step 3]
- **Session health**: [degraded / severely degraded]

## Error Timeline

### Error 1: [short title]
- **What**: [description]
- **Root cause**: [why it happened]
- **Fix**: [how it was resolved]
- **Prevention**: [what would have prevented this]

### Error 2: [short title]
[same structure]

## Pattern Analysis

[Which patterns from Step 3 were present. What systemic issue connects the errors.]

## Recommendations

### For the Codebase
- [Specific improvements: missing tests, unclear APIs, confusing file structure, etc.]

### For Future Sessions
- [What information should be gathered upfront next time]
- [What checks should be run before proceeding]

### Proposed Rules or Tests
- [If a pattern suggests a new ${PROJECT_NAME} rule, describe it]
- [If a missing test caused the error, describe what test to add]
\\\`\\\`\\\`

### Step 5 — Recommend Session Reset

**[CODING AGENT]** After saving the report, tell the user:

> **Session health is degraded.** After 2+ error corrections, the conversation
> context contains failed approaches and stale assumptions that increase the
> risk of further mistakes.
>
> **Recommended actions:**
> 1. Review the error recovery report: \\\`docs/YYYYMMDD_HHMM_REVIEW_error-recovery.md\\\`
> 2. If there are proposed rules or tests, consider implementing them
> 3. Use \\\`/clear\\\` to reset context, or start a new Claude Code session
> 4. In the new session, reference the report if you need to continue the same task
>
> This is not a failure — it's a healthy practice. Clean context produces better results.

### Step 6 — Propose Preventive Artifacts (Optional)

**[CODING AGENT]** If the error pattern suggests a systemic fix:

- **Recurring type errors** → propose a ${PROJECT_NAME} rule for stricter type checking practices
- **Missing file/path errors** → propose a rule to always verify paths before operations
- **Test failures from stale fixtures** → propose a test maintenance rule
- **API hallucinations** → propose a rule to always query the code graph before referencing functions

Use \\\`${PROJECT_CLI} add rule <name>\\\` to scaffold the rule if the user approves.

**Also write rule feedback:** If the error pattern was caused by a missing or incorrect rule, write a structured observation to \\\`${PROJECT_DIR}/feedback/rules/\\\` (see the rule-feedback skill for the JSON format). This ensures the pattern is captured for future \\\`/codi-refine-rules\\\` review even if the user doesn't create a rule now.

## Important Notes

- This skill is about **your own errors**, not user-reported bugs in the codebase
- Do not skip this skill to "save time" — contaminated context costs more time than the report
- The report should be honest and specific — vague reports like "I made a mistake" are not useful
- If you're unsure whether to activate, activate — false positives are cheap, false negatives are expensive
`;
