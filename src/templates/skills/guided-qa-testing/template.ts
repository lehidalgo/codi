import { PROJECT_NAME } from "#src/constants.js";

export const template = `---
name: {{name}}
description: Step-by-step QA testing methodology. Coding agent drives the process one phase at a time — executing automatable checks, flagging human-only phases, planning bug fixes collaboratively, and tracking all results in a living QA report document.
category: Code Quality
compatibility: [claude-code, cursor, codex, windsurf, cline]
managed_by: ${PROJECT_NAME}
intentHints:
  taskType: QA Testing
  examples:
    - "Run QA tests"
    - "Test this feature step by step"
---

# {{name}}

## When to Activate

- User asks to "test", "QA", or "validate" the project
- User says "let's check if everything works"
- User has a QA document and wants help executing it
- After a release or major feature merge that needs verification

## Phase Types

Every QA phase falls into one of two categories. The coding agent MUST identify and label each phase before starting it.

| Type | Label | Who Drives | Examples |
|------|-------|-----------|----------|
| **AGENT** | \`[AGENT]\` | Coding agent executes commands and analyzes output | CLI commands, file checks, JSON validation, config verification |
| **HUMAN** | \`[HUMAN]\` | Human must perform the action (IDE, visual, interactive) | IDE integration, interactive prompts, visual/UX checks, git commit hooks |

**Rules for AGENT phases**: The coding agent runs commands, reads output, and diagnoses results autonomously. The human observes and confirms.

**Rules for HUMAN phases**: The coding agent describes exactly what the human should do and what to look for. The human performs the action and reports back. The agent analyzes the feedback.

## Core Workflow — One Phase at a Time

\`\`\`mermaid
flowchart TD
    A[Start: Load or create QA plan] --> B[Present next phase to human]
    B --> C{Phase type?}
    C -->|AGENT| D[Agent executes checks]
    C -->|HUMAN| E[Agent describes steps for human]
    D --> F[Analyze results]
    E --> G[Human performs and reports]
    G --> F
    F --> H{Bug found?}
    H -->|Yes| I[Diagnose root cause from source code]
    I --> J[Propose fix plan to human]
    J --> K{Human approves fix?}
    K -->|Yes| L[Implement fix + tests]
    L --> M[Re-run failed check to verify]
    K -->|No| N[Log as known issue]
    H -->|No| O[Update QA report]
    M --> O
    N --> O
    O --> P{Human approves moving to next phase?}
    P -->|Yes| B
    P -->|No| Q[Address concerns]
    Q --> B
\`\`\`

**CRITICAL**: Never jump ahead to the next phase without explicit human approval. Present results, wait for confirmation, then proceed.

## Process

### Step 1: Discover and Classify Test Scope

**[CODING AGENT]** Before starting:

1. Check for existing QA documents (\`docs/qa/\`, QA report files, \`TESTING.md\`)
2. If a QA document exists, read it and extract phases
3. If not, analyze the project to build a phase list:
   - Read \`package.json\` or equivalent for available commands
   - Check \`README.md\` for documented features
   - Scan CLI entry points, API routes, or UI components

4. **Classify each phase** as AGENT or HUMAN:

   **AGENT phases** — coding agent can execute directly:
   - CLI commands that produce deterministic output
   - File existence and content checks
   - JSON/YAML validation
   - Config generation and drift detection
   - Error handling and edge case testing
   - Build and test suite execution

   **HUMAN phases** — require human interaction:
   - IDE integration testing (loading rules, verifying agent behavior)
   - Interactive wizard/prompt flows
   - Visual/UX verification
   - Git hook testing that requires real commits
   - Anything requiring interactive terminal input

5. Present the full phase list with classifications to the human for approval before starting.

### Step 2: Prepare Environment

**[CODING AGENT]** Verify prerequisites:

1. Check runtime environment (Node version, Python version, etc.)
2. Verify dependencies are installed
3. Ensure a clean state if needed (build, re-init, etc.)
4. Confirm environment is ready with the human

### Step 3: Execute One Phase

#### For AGENT Phases

The coding agent drives execution:

1. **Announce**: "Starting Phase N: [name] [AGENT]"
2. **Read source code** to understand expected behavior BEFORE running checks
3. **Execute each check** in the phase:
   - Run the command
   - Compare output against expected behavior from source code
   - Diagnose: PASS / FAIL / WARN / SKIP
4. **Present results summary** to the human

Format for each check:
\`\`\`
CHECK [N.M]: [description]
Command:  [what was run]
Expected: [from source code analysis]
Actual:   [command output]
Result:   PASS | FAIL | WARN | SKIP
\`\`\`

#### For HUMAN Phases

The coding agent provides instructions:

1. **Announce**: "Phase N: [name] [HUMAN] — requires your action"
2. **Describe each step** the human should perform:
   - Exact actions to take
   - What to observe
   - What success looks like
   - What failure looks like
3. **Wait for human feedback** before diagnosing

### Step 4: Handle Bugs

When a check fails:

1. **Diagnose**: Read the relevant source code to identify the root cause
2. **Classify**: Is it a bug, a missing feature, a config issue, or user error?
3. **Present diagnosis** to the human with:
   - What happened vs what should have happened
   - Root cause in the source code (file path + line)
   - Proposed fix approach
4. **Wait for human decision**:
   - Fix now → enter plan mode, implement fix, add tests, verify
   - Fix later → log as known issue in the QA report
   - Not a bug → update the QA document to reflect correct behavior
5. **After fix**: Re-run the failed check to confirm the fix works
6. **Update the QA report** with the bug, fix, and version

### Step 5: Complete Phase and Get Approval

After all checks in a phase are done:

1. **Present phase summary**:
   - Total checks, passed, failed, warnings, skipped
   - Any bugs found and their status (fixed / deferred)
2. **Update the QA report document** with results
3. **Ask human**: "Phase N complete. Ready to proceed to Phase N+1?"
4. **Only proceed when human confirms**

### Step 6: Generate Final Report

After all phases (or when human decides to stop):

Save the QA report to the project docs directory. The report is a **living document** updated throughout the process, not generated only at the end.

Report structure:
\`\`\`markdown
# QA Progress Report
**Date**: [date]
**Document**: [filename]
**Category**: REPORT

## Summary
[High-level status and context]

## QA Phase Status
| Phase | Type | Status | Notes |
|-------|------|--------|-------|
| N: [Name] | AGENT/HUMAN | COMPLETED/PENDING/IN PROGRESS | [summary] |

## Phase Results Detail
### Phase N: [Name] (STATUS)
| Test | Result | Detail |
|------|--------|--------|
| [check description] | PASS/FAIL/WARN/SKIP | [details] |

## Remaining Human-Only Phases
[Instructions for phases that still need human execution]

## Bugs Found and Fixed During QA
| # | Bug | Fix | Version |
|---|-----|-----|---------|
| N | [description] | [fix applied] | [version] |

## Doc Corrections Found During QA
[Any documentation errors discovered during testing]
\`\`\`

## Key Principles

1. **One phase at a time** — never batch multiple phases without human approval between them
2. **Never guess** — always read source code to understand expected behavior before diagnosing
3. **Classify before executing** — every phase must be labeled AGENT or HUMAN before starting
4. **Fix or defer, never ignore** — every failure gets a decision: fix now, fix later, or reclassify
5. **Living document** — update the QA report after every phase, not just at the end
6. **Human controls pace** — the agent proposes, the human approves progression
7. **Be specific** — give exact commands, exact expected outputs, exact file paths
8. **Distinguish bug from misuse** — a failed check might be a real bug OR a testing environment issue
9. **Verify fixes** — after fixing a bug, re-run the failed check to confirm
10. **Track doc errors too** — if a QA document references a wrong command name or non-existent feature, log the correction

## Tester Roles

| Role | Responsibility |
|------|---------------|
| **HUMAN** | Approves phase progression, performs HUMAN-only checks, makes fix/defer decisions, provides judgment on UX/visual checks |
| **CODING AGENT** | Drives AGENT phases autonomously, reads source code for diagnosis, proposes fixes, maintains the QA report document, tracks all results |

## Available Agents

For automated test generation from QA findings, delegate to these agents (see \\\`agents/\\\` directory):
- **codi-test-generator** — Convert QA findings into automated regression tests
`;
