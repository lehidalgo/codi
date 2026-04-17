import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Iterative audit-and-fix workflow. Use when processing a list of audit
  findings, a batch of fixes, an issue backlog, a lint or static-analysis
  backlog, a security-fix list, a migration checklist, a TODO list of
  improvements, or any set of items where each one needs: evidence gathering →
  fix proposal → explicit user approval → implementation → commit. Also
  activate for phrases like "work through a list", "go through these one by
  one", "batch of fixes", "process the backlog", "iterate through findings".
  Enforces strict one-item-at-a-time discipline with a commit per item. Do
  NOT activate for a single bug (use ${PROJECT_NAME}-debugging), new feature
  work, or exploratory review without a fix list.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 11
---

# {{name}} — Audit & Fix

## When to Activate

- Processing a list of audit findings, code quality issues, or security items
- Working through a lint, static analysis, or issue backlog
- Systematic migration of a codebase pattern (e.g., updating all usages of a deprecated API)
- Any batch of items where each requires: investigation → proposal → approval → fix → commit

## Skip When

- A single bug (use ${PROJECT_NAME}-debugging)
- New feature work (use ${PROJECT_NAME}-plan-execution)
- Exploratory review without a fix list (use ${PROJECT_NAME}-codebase-explore)

## The Iron Laws

> **One item at a time. Always.**
>
> **No fix proposal without evidence. No exceptions.**
>
> **No implementation without explicit user approval. No exceptions.**
>
> **One commit per item. Traceability is non-negotiable.**

## Phase 1: Build the TODO List

Before processing any item:

1. **Analyze the scope** — Read the input: audit report, issue list, user description, or codebase scan. Identify all items to process.
2. **Create one task per item** — Use TaskCreate for each item. Subject: imperative description of what needs to be evaluated (e.g., "Evaluate: unused variable in auth.ts:42").
3. **Present the list** — Show the user all items, their count, and ask for review. Let the user reorder, remove, or add items before processing begins.
4. **Lock the list** — Once processing starts, no new items are added mid-cycle. The user may request additions between items, never during one.

## Phase 2: Process Current Item (The Loop)

Repeat for each pending item in order:

### 2a. Select and Investigate

1. Mark the item as in-progress via TaskUpdate.
2. State clearly: "Processing item N of M: [item description]"
3. **Invoke ${PROJECT_NAME}-evidence-gathering** — investigate the item. Gather concrete evidence of actual vs intended behavior. Understand the root cause before forming any opinion.
4. **Evaluate the evidence:**
   - If no action is needed: state this clearly, provide the evidence-based justification, mark the task completed, and move to the next item.
   - If a fix is needed: proceed to 2b.

### 2b. Prepare Fix Proposal

Write a fix proposal with these 5 sections:

**Problem:** What is wrong, with exact evidence (file:line, tool output, test failure).

**Root Cause:** Why it is wrong. The underlying reason, not just the symptom.

**Proposed Fix:** The exact change to make. Include file paths, line numbers, and the precise modification.

**Impact:** What else might be affected. Any dependent code, tests, or configuration that needs updating.

**Validation Plan:** How to verify the fix works. The exact command to run and what output confirms success.

### 2c. Present and Wait

Present the fix proposal to the user. **STOP. Do not implement anything.**

Wait for one of:
- **Approved** → proceed to Phase 3
- **Changes requested** → revise the proposal and re-present (return to 2c)
- **Rejected** → note the rejection, mark item completed with "rejected" status note, move to next item

Do not ask "can I proceed?" — wait for an explicit approval or instruction.

## Phase 3: Close Item

After user approval:

1. **Implement** the approved fix exactly as proposed. Do not expand scope.
2. **Validate** — Run the validation plan from the fix proposal. Read the actual output.
3. **Invoke ${PROJECT_NAME}-verification** — confirm the fix with fresh evidence.
4. **Commit** — Create a commit for this single item. Commit message format:
   \`fix(<scope>): <what was fixed>\`
   Include the item description and validation evidence in the commit body.
5. **Attempt graph update** — Try to update the code graph via the graph-code MCP. If unavailable, skip silently.
6. **Mark completed** — Update the task to completed.
7. **Return to Phase 2** for the next pending item.

## Red Flags

These thoughts signal you are about to break the protocol. Stop immediately.

| Thought | Reality |
|---------|---------|
| "These two are related, I'll fix both together" | One item at a time. Split into separate items if needed. |
| "The fix is obvious, I can skip evidence" | Evidence is required regardless of apparent simplicity. |
| "The user will approve, let me just implement it" | Approval gate is non-negotiable. The user decides. |
| "Let me batch the commits for efficiency" | One commit per item. Batching destroys traceability. |
| "I'll add this related improvement while I'm here" | Scope creep. Fix only what was approved. |
| "I've seen this pattern before, no need to investigate" | Investigate this instance specifically. Context matters. |

## Escalation: Pattern Detection

If 3 or more consecutive items share the same root cause or fix type:

1. Pause processing.
2. Surface the pattern to the user: "I've noticed items N, N+1, N+2 all share the same root cause: [description]. This suggests a systematic issue rather than isolated bugs."
3. Propose a systematic approach: a refactor, a lint rule, a script, or a single architectural change.
4. Wait for the user's decision before continuing item-by-item or switching approaches.

## Progress Reporting

After each completed item, output:

\`Completed: N of M items | Pending: X | Skipped: Y | Rejected: Z\`

Always show what has been done, what is current, and what comes next.

## Integration

- Uses ${PROJECT_NAME}-evidence-gathering for structured investigation in Phase 2a.
- Uses ${PROJECT_NAME}-verification in Phase 3 to confirm fixes.
- Uses ${PROJECT_NAME}-debugging when root cause analysis is complex (invoke during 2a if needed).
- Produces commits that the graph-code MCP can index for future codebase understanding.
`;
