export const template = `---
name: {{name}}
description: Human-in-the-loop QA testing methodology. Use when validating project behavior interactively — human runs commands and provides output, coding agent analyzes results against codebase expectations, diagnoses pass/fail, and produces a structured QA report.
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: codi
---

# {{name}}

## When to Use

Use when a human wants guided help testing their project interactively — running commands, providing output, and having the coding agent analyze whether the behavior is correct based on the codebase.

## When to Activate

- User asks to "test", "QA", or "validate" the project behavior
- User says "let's check if everything works"
- User wants to walk through a testing checklist with agent assistance
- User has a QA document and wants help executing it
- After a release or major feature merge that needs manual verification

## Methodology

This skill implements a **human-in-the-loop QA cycle**:

\`\`\`
┌─────────────────────────────────────────────────┐
│  1. AGENT defines the check                     │
│     → What to run, what to look for             │
│                                                 │
│  2. HUMAN executes the command                  │
│     → Runs in terminal, provides output/feedback│
│                                                 │
│  3. AGENT analyzes the result                   │
│     → Reads codebase to understand expected     │
│       behavior, compares with actual output     │
│                                                 │
│  4. AGENT diagnoses                             │
│     → PASS: behavior matches expectation        │
│     → FAIL: explains what went wrong and why    │
│     → SKIP: not applicable in current context   │
│                                                 │
│  5. AGENT updates task status                   │
│     → Marks check as completed with result      │
│     → Moves to next check                       │
└─────────────────────────────────────────────────┘
\`\`\`

## Process

### Step 1: Discover Test Scope

**[CODING AGENT]** Before starting, understand what needs testing:

1. Check if a QA document exists (e.g., \`docs/qa/\`, \`docs/testing/\`, \`TESTING.md\`)
2. If yes, read it and extract all test checks into a task list
3. If no, analyze the project to identify testable features:
   - Read \`package.json\` or equivalent for available commands
   - Check \`README.md\` for documented features
   - Scan CLI entry points, API routes, or UI components
   - Identify configuration files that affect behavior

Create a task for each phase/group of related checks.

### Step 2: Prepare the Environment

**[CODING AGENT]** Verify prerequisites:

1. Check the runtime environment (Node version, Python version, etc.)
2. Verify dependencies are installed
3. Identify if a clean state is needed (fresh install, empty database, etc.)
4. Tell the human what setup steps to run, if any

### Step 3: Execute Checks (Loop)

For each check in the task list:

#### 3a. Present the Check

**[CODING AGENT]** Tell the human:
- **What to run**: the exact command or action
- **What to observe**: specific output, file changes, or behaviors to look for
- **Expected result**: what success looks like

Format each check as:

\`\`\`
CHECK [phase.number]: [description]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run:     [exact command]
Expect:  [expected output or behavior]
Look for: [specific strings, files, or states]
\`\`\`

#### 3b. Receive Human Feedback

**[HUMAN]** Runs the command and provides one of:
- The command output (paste into chat)
- A description of what happened
- A screenshot (for visual checks)
- "ok" / "done" (if output matches expectation)
- "failed" / description of unexpected behavior

#### 3c. Analyze the Result

**[CODING AGENT]** When the human provides feedback:

1. **If output provided**: Compare against expected behavior
   - Read the relevant source code to understand what SHOULD happen
   - Check error codes, messages, file contents against the implementation
   - Identify if the output is correct, partially correct, or wrong

2. **If "ok" or "done"**: Mark as PASS, move to next check

3. **If unexpected behavior reported**:
   - Read the source code responsible for this behavior
   - Identify the root cause (bug, missing feature, config issue, user error)
   - Explain what happened vs what should have happened
   - Suggest a fix if it's a bug, or corrective action if it's a usage issue

#### 3d. Record the Result

**[CODING AGENT]** Update the task with the result:
- **PASS** — behavior matches expectation
- **FAIL** — behavior does not match, with diagnosis
- **SKIP** — not applicable (explain why)
- **WARN** — works but with caveats worth noting

### Step 4: Generate QA Report

**[CODING AGENT]** After all checks are complete, produce a structured report:

\`\`\`markdown
# QA Report — [Project Name] v[version]

**Date**: [date]
**Tester**: Human + [Agent Name]
**Environment**: [OS, runtime versions]

## Summary

| Metric | Value |
|--------|-------|
| Total checks | [N] |
| Passed | [N] |
| Failed | [N] |
| Skipped | [N] |
| Warnings | [N] |

## Results by Phase

### Phase [N]: [Name]

| # | Check | Result | Notes |
|---|-------|--------|-------|
| [N.M] | [description] | PASS/FAIL/SKIP | [details] |

## Failures & Diagnosis

### [N.M] [Failed check name]
- **Expected**: [what should happen]
- **Actual**: [what happened]
- **Root cause**: [analysis from source code]
- **Suggested fix**: [if applicable]

## Warnings

[Any caveats or non-blocking issues]
\`\`\`

Save this report to \`docs/qa/[date]-[context]-qa-report.md\`.

## Key Principles

1. **Never guess** — always read the source code to understand expected behavior
2. **One check at a time** — don't overwhelm the human with multiple commands
3. **Explain the diagnosis** — when something fails, show WHY based on the code
4. **Track everything** — use tasks to maintain progress across the session
5. **Respect human time** — group related checks, skip obviously passing checks if human requests
6. **Be specific** — give exact commands, exact expected outputs, exact file paths
7. **Distinguish bug from misuse** — a failed check might be a real bug OR a testing environment issue

## Tester Roles

| Role | Responsibility |
|------|---------------|
| **HUMAN** | Runs commands, provides output, makes judgment calls on visual/UX checks |
| **CODING AGENT** | Defines checks, analyzes output against codebase, diagnoses issues, writes report |

The coding agent should NEVER run destructive commands or commands that require interactive input. Always delegate those to the human.

## References

- Project README for feature documentation
- Source code for expected behavior verification
- Existing test suites for automated coverage context
- CHANGELOG for version-specific behavior changes
`;
