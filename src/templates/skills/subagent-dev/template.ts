import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Subagent-driven plan execution. Use after ${PROJECT_NAME}-plan-writer
  produces an implementation plan and the user wants to dispatch a fresh
  subagent per task with a two-stage review (spec compliance + code
  quality). Also activate for phrases like "dispatch subagents for each
  task", "multi-file implementation", "subagent orchestration",
  "two-stage review", "plan execution with subagents", "fresh subagent
  per task", "run the plan with subagents". Recommended over
  ${PROJECT_NAME}-plan-executor for complex or multi-file tasks. Do NOT
  activate without an approved plan (use ${PROJECT_NAME}-brainstorming
  → ${PROJECT_NAME}-plan-writer first), for trivial single-file edits,
  for inline sequential execution preference (use
  ${PROJECT_NAME}-plan-executor), or when the baseline test suite is
  already failing (fix the baseline first).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 8
---

# {{name}} — Subagent Dev

Announce at start: "I'm using ${PROJECT_NAME}-subagent-dev to execute this plan."

## When to Activate

- After ${PROJECT_NAME}-plan-writer produces an implementation plan
- User prefers subagent isolation per task over sequential inline execution
- Tasks involve multiple files or significant complexity
- Recommended default for most implementation plans

## Skip When

- No approved plan yet — run ${PROJECT_NAME}-brainstorming → ${PROJECT_NAME}-plan-writer first
- Single-file trivial edit that doesn't warrant the review overhead — edit directly
- User prefers inline sequential execution with checkpoints — use ${PROJECT_NAME}-plan-executor
- Baseline tests are already failing — fix the baseline first (never execute on red)
- Bug investigation without a plan — use ${PROJECT_NAME}-debugging

## Prerequisites

Before executing any task:
1. A plan document must exist in docs/ (from ${PROJECT_NAME}-plan-writer)
2. ${PROJECT_NAME}-worktrees must have set up an isolated workspace or branch
3. Confirm baseline tests pass (from worktrees setup report, Path B only)

## Core Pattern

"Fresh subagent per task + two-stage review (spec compliance first, then code quality) = high quality, fast iteration."

Each subagent gets only what it needs: its specific task, the relevant design spec section, and no session history. This keeps focus sharp.

## Execution Loop

For each task in the plan (in order):

**Step 1: Prepare task context**
Extract the complete task text from the plan. Note: spec compliance reviewers need the original requirements, not your summary of them.

**Step 2: Dispatch implementer subagent**
Use \\\`\${CLAUDE_SKILL_DIR}[[/references/implementer-prompt.md]]\\\` as the base for the implementer subagent prompt.
Using the Agent tool with a prompt that includes:
- The exact task text from the plan (complete, word for word)
- The design spec section relevant to this task
- The branch and worktree path
- Explicit instruction: "Use ${PROJECT_NAME}-tdd. Write the test first, verify it fails, then implement."
- Explicit instruction: "Use ${PROJECT_NAME}-verification before reporting completion."
- What to report back: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

**Step 3: Handle implementer status**

| Status | Response |
|--------|----------|
| DONE | Proceed to spec review |
| DONE_WITH_CONCERNS | Note the concern, proceed to spec review, include concern in review context |
| NEEDS_CONTEXT | Provide the missing information, re-dispatch the same task |
| BLOCKED | Assess root cause: 1. Context problem: provide more context, re-dispatch same model. 2. Needs more reasoning: re-dispatch with more capable model. 3. Task too large: break into smaller pieces. 4. Plan is wrong: escalate to user. |

**Step 4: Spec compliance review**
Use \\\`\${CLAUDE_SKILL_DIR}[[/references/spec-reviewer-prompt.md]]\\\` for the spec reviewer prompt.
Dispatch a spec reviewer subagent:
- Provide: the original task requirements, the design spec section, the git diff of changes made
- Ask: "Do the changes fully satisfy the task requirements? Yes/No. If no, what is missing?"
- If reviewer finds gaps: dispatch implementer again with specific gap description. Re-review.

**Step 5: Code quality review**
Use \\\`\${CLAUDE_SKILL_DIR}[[/references/quality-review-prompt.md]]\\\` for the quality reviewer prompt.
Dispatch the ${PROJECT_NAME}-code-reviewer agent:
- Provide: the git diff, the task context
- Severity-ranked findings (CRITICAL/HIGH/MEDIUM/LOW)
- CRITICAL and HIGH findings must be fixed before proceeding
- MEDIUM noted; LOW noted

**Step 6: Mark task complete**
Update task tracking. Move to next task.

## Model Selection

Choose model complexity based on task:
- Simple, isolated changes (1 file, clear spec): use a faster model
- Integration changes (multiple files, coordination needed): standard model
- Architecture or design decisions: most capable model available

Task complexity signals: isolated functions/clear spec/1-2 files = fast model; multiple files/coordination = standard model; architecture/design decisions = most capable model

## What Never to Do

- Never dispatch multiple implementer subagents in parallel (review is sequential, feedback loops require order)
- Never skip a review stage because "the task was simple"
- Never proceed with a DONE_WITH_CONCERNS status without including the concern in review context
- Never let subagents read plan files directly — extract and provide the specific task text
- Never start code quality review before spec compliance is done (wrong order)
- Never move to the next task while either review has open issues
- Never let implementer self-review replace actual review (both stages are required)
- Never skip spec review because the task was simple
- Never reuse a subagent from a previous task (fresh context per task is essential)
- Never give the implementer access to the full plan (provide only the specific task)
- Never accept DONE_WITH_CONCERNS without noting the concern in the review context
- Never let review cycles run more than 3 iterations without escalating or decomposing the task

## After All Tasks

1. Run full test suite via ${PROJECT_NAME}-verification
2. Dispatch ${PROJECT_NAME}-code-reviewer agent for the complete changeset
3. Invoke ${PROJECT_NAME}-branch-finish for cleanup and merge options

## Integration

- Requires: ${PROJECT_NAME}-worktrees (workspace), ${PROJECT_NAME}-plan-writer (plan)
- Uses: ${PROJECT_NAME}-code-reviewer agent (Step 5), ${PROJECT_NAME}-tdd (during implementation), ${PROJECT_NAME}-verification (before completion)
- Invokes: ${PROJECT_NAME}-branch-finish (after all tasks complete)
`;
