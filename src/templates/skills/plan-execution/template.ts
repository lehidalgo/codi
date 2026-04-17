import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Execute an approved implementation plan in one of two modes — INLINE
  (sequential checkpoint-driven execution by the primary agent) or
  SUBAGENT (fresh subagent per task with two-stage review). Use after
  ${PROJECT_NAME}-plan-writer produces an approved plan. Always asks the
  user to pick the mode — never auto-selects. Activates on phrases like
  "execute this plan", "implement the plan", "run the plan", "walk
  through the plan step by step", "TDD per task", "dispatch subagents
  for each task", "subagent orchestration", "two-stage review",
  "plan execution", "multi-file implementation". Do NOT activate without
  an approved plan (use ${PROJECT_NAME}-brainstorming →
  ${PROJECT_NAME}-plan-writer first), for trivial single-file edits, for
  bug investigation without a fix plan (use ${PROJECT_NAME}-debugging),
  or when the baseline test suite is already failing (fix the baseline
  first, never execute on red).
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 3
---

# {{name}} — Plan Execution

Two execution modes, same plan, same post-conditions. **Always ask the user which mode** — never auto-select.

## Announce at Start

> "I'm using ${PROJECT_NAME}-plan-execution. Before I start: how should I execute this plan — **INLINE** (I work through each task sequentially with checkpoints) or **SUBAGENT** (I dispatch a fresh subagent per task with two-stage review)?"

Wait for the user's choice before proceeding. Do not pick a default.

## Mode Comparison (for the user)

| Dimension | INLINE | SUBAGENT |
|-----------|--------|----------|
| Who writes the code | Primary agent (you watch) | Dispatched subagents (isolated) |
| Context | Plan stays in main context | Fresh context per task |
| Review stages | 1 — verification + TDD per step | 2 — spec compliance + code quality |
| Best for | Watch-along execution, single-file tasks, when you want to be involved each step | Multi-file tasks, complex coordination, keeping main context clean |
| Reviewer subagent | No | Yes (${PROJECT_NAME}-code-reviewer) |

## Skip When

- No approved plan yet — run ${PROJECT_NAME}-brainstorming → ${PROJECT_NAME}-plan-writer first
- Exploratory or single-file edit that does not warrant a plan — edit directly
- Bug investigation without a fix plan — use ${PROJECT_NAME}-debugging
- Baseline test suite is already failing — fix the baseline first, never execute on red

## Prerequisites (both modes)

1. A plan document in \\\`docs/\\\` (from ${PROJECT_NAME}-plan-writer)
2. ${PROJECT_NAME}-worktrees has set up a clean workspace or branch
3. Baseline tests confirmed passing

## Shared Discipline (both modes)

### No Improvisation

If a task says "add X to file Y", add ONLY X to file Y. Do not also refactor Y. Do not fix a nearby issue you noticed. Do not add imports not specified. Execute the plan as written.

If the plan has a mistake: stop, report it, ask the user to update the plan before continuing.

### Stopping Conditions

STOP IMMEDIATELY and seek clarification when:
- A required file does not exist
- A test fails unexpectedly and it is not the intended failing test
- A verification command fails
- An instruction is ambiguous
- A dependency is missing

Do not proceed past a blocker. Report what you were doing, what happened, and what you need to continue.

---

## Mode: INLINE

Use when the user picks inline sequential execution with checkpoints.

### Step 1 — Load and Review the Plan

Read the plan document completely. Check for any concerns or blockers. If questions exist: raise them with the user BEFORE starting. Create a task list from the plan tasks using TaskCreate.

### Step 2 — Execute Each Task (in order)

1. Mark task in_progress in the task list
2. Execute each step in the task precisely as written
3. Do not improvise or add steps not in the task
4. Apply ${PROJECT_NAME}-tdd for each implementation step
5. Run the task's verification command
6. Apply ${PROJECT_NAME}-verification before marking the task complete
7. Commit as specified in the task
8. Mark task completed

### Revisiting Earlier Steps (INLINE)

Return to Step 1 when:
- The user updates the plan based on your feedback
- The fundamental approach needs rethinking

Do not force through blockers — stop and ask.

---

## Mode: SUBAGENT

Use when the user picks subagent orchestration with two-stage review.

Core pattern: **Fresh subagent per task + two-stage review (spec compliance first, then code quality) = high quality, fast iteration.** Each subagent gets only what it needs: its specific task, the relevant design spec section, and no session history.

### Step 1 — Prepare Task Context

Extract the complete task text from the plan. Spec compliance reviewers need the **original requirements**, not your summary.

### Step 2 — Dispatch Implementer Subagent

Use \\\`\${CLAUDE_SKILL_DIR}[[/references/implementer-prompt.md]]\\\` as the base for the implementer subagent prompt.

Dispatch via the Agent tool with a prompt that includes:
- The exact task text from the plan (complete, word for word)
- The design spec section relevant to this task
- The branch and worktree path
- Explicit instruction: "Use ${PROJECT_NAME}-tdd. Write the test first, verify it fails, then implement."
- Explicit instruction: "Use ${PROJECT_NAME}-verification before reporting completion."
- What to report back: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

### Step 3 — Handle Implementer Status

| Status | Response |
|--------|----------|
| DONE | Proceed to spec review |
| DONE_WITH_CONCERNS | Note the concern, proceed to spec review, include concern in review context |
| NEEDS_CONTEXT | Provide the missing information, re-dispatch the same task |
| BLOCKED | Assess root cause: (1) context problem: provide more context, re-dispatch same model; (2) needs more reasoning: re-dispatch with more capable model; (3) task too large: break into smaller pieces; (4) plan is wrong: escalate to user |

### Step 4 — Spec Compliance Review

Use \\\`\${CLAUDE_SKILL_DIR}[[/references/spec-reviewer-prompt.md]]\\\` for the spec reviewer prompt.

Dispatch a spec reviewer subagent:
- Provide: the original task requirements, the design spec section, the git diff of changes made
- Ask: "Do the changes fully satisfy the task requirements? Yes/No. If no, what is missing?"
- If reviewer finds gaps: dispatch implementer again with specific gap description. Re-review.

### Step 5 — Code Quality Review

Use \\\`\${CLAUDE_SKILL_DIR}[[/references/quality-review-prompt.md]]\\\` for the quality reviewer prompt.

Dispatch the ${PROJECT_NAME}-code-reviewer agent:
- Provide: the git diff, the task context
- Severity-ranked findings (CRITICAL / HIGH / MEDIUM / LOW)
- CRITICAL and HIGH findings must be fixed before proceeding
- MEDIUM noted; LOW noted

### Step 6 — Mark Task Complete

Update task tracking. Move to the next task.

### Model Selection (SUBAGENT)

Choose model complexity based on task:
- **Simple, isolated changes** (1 file, clear spec): faster model
- **Integration changes** (multiple files, coordination): standard model
- **Architecture or design decisions**: most capable model available

### What Never to Do (SUBAGENT)

- Never dispatch multiple implementer subagents in parallel (review is sequential; feedback loops require order)
- Never skip a review stage because "the task was simple"
- Never proceed with DONE_WITH_CONCERNS without including the concern in review context
- Never let subagents read plan files directly — extract and provide the specific task text
- Never start code quality review before spec compliance is done (wrong order)
- Never move to the next task while either review has open issues
- Never let implementer self-review replace actual review (both stages required)
- Never reuse a subagent from a previous task (fresh context is essential)
- Never give the implementer access to the full plan (only the specific task)
- Never accept DONE_WITH_CONCERNS without noting the concern in the review context
- Never let review cycles run more than 3 iterations without escalating or decomposing the task

---

## After All Tasks (both modes)

1. Run full test suite via ${PROJECT_NAME}-verification: report pass/fail with counts
2. **SUBAGENT mode only**: dispatch ${PROJECT_NAME}-code-reviewer agent for the complete changeset
3. Invoke ${PROJECT_NAME}-branch-finish for cleanup and merge options

## Integration

- **Requires**: ${PROJECT_NAME}-worktrees (workspace), ${PROJECT_NAME}-plan-writer (plan)
- **Uses**: ${PROJECT_NAME}-tdd (implementation steps), ${PROJECT_NAME}-verification (task completion), ${PROJECT_NAME}-code-reviewer agent (SUBAGENT mode reviews)
- **Invokes**: ${PROJECT_NAME}-branch-finish (after all tasks)
- **Never starts** implementation on main/master without explicit user consent
`;
