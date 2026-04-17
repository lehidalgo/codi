import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML, SKILL_CATEGORY } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Sequential plan execution with checkpoints. Use after
  ${PROJECT_NAME}-plan-writer produces an approved implementation plan and
  subagent orchestration is not preferred. Also activate for phrases like
  "execute this plan", "implement the plan", "run the plan inline", "walk
  through the plan step by step", "TDD per task". Executes tasks inline
  with mandatory verification at each checkpoint and strict
  no-improvisation discipline. Do NOT activate without an approved plan
  (use ${PROJECT_NAME}-plan-writer first), when subagents are available
  and the plan has independent tasks (use ${PROJECT_NAME}-subagent-dev),
  or for exploratory / single-file edits that don't need a plan.
category: ${SKILL_CATEGORY.DEVELOPER_WORKFLOW}
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
user-invocable: true
disable-model-invocation: false
version: 5
---

# {{name}} — Plan Executor

**Announce at start:** "I'm using ${PROJECT_NAME}-plan-executor to implement this plan."

## When to Activate

- After ${PROJECT_NAME}-plan-writer produces an implementation plan
- Subagents are not available or not preferred
- User wants to watch implementation happen inline
- Note: ${PROJECT_NAME}-subagent-dev is recommended when subagents are available

## Skip When

- No approved plan yet — run ${PROJECT_NAME}-brainstorming → ${PROJECT_NAME}-plan-writer first
- Plan has many independent tasks and subagents are available — use ${PROJECT_NAME}-subagent-dev for parallel execution
- Exploratory or single-file edits that don't warrant a plan — just edit directly
- Bug investigation without a fix plan — use ${PROJECT_NAME}-debugging

## Prerequisites

1. A plan document in docs/ (from ${PROJECT_NAME}-plan-writer)
2. ${PROJECT_NAME}-worktrees has set up a clean workspace or branch
3. Baseline tests confirmed passing (worktree path only)

## Execution Flow

**Step 1: Load and review the plan**
Read the plan document completely. Check for any concerns or blockers. If questions exist: raise them with the user BEFORE starting. Create a task list from the plan tasks using TaskCreate.

**Step 2: For each task (in order)**
1. Mark task in_progress in the task list
2. Execute each step in the task precisely as written
3. Do not improvise or add steps not in the task
4. Apply ${PROJECT_NAME}-tdd for each implementation step
5. Run the task's verification command
6. Apply ${PROJECT_NAME}-verification before marking the task complete
7. Commit as specified in the task
8. Mark task completed

## Stopping Conditions

STOP IMMEDIATELY and seek clarification when:
- A required file doesn't exist
- A test fails unexpectedly and it is not the intended failing test
- A verification command fails
- An instruction is ambiguous
- A dependency is missing

Do not proceed past a blocker. Report it clearly: what you were doing, what happened, what you need to continue.

## No Improvisation

If a task says "add X to file Y", add ONLY X to file Y. Do not also refactor Y. Do not also fix a nearby issue you noticed. Do not add imports not specified. Execute the plan as written.

If the plan has a mistake: stop, report the mistake, ask the user to update the plan before continuing.

## When to Revisit Earlier Steps

**Return to Step 1 (Load and Review) when:**
- The user updates the plan based on your feedback
- The fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## After All Tasks

1. Run full test suite via ${PROJECT_NAME}-verification: report pass/fail with counts
2. Invoke ${PROJECT_NAME}-branch-finish

## Remember

- Review the plan critically before starting - raise concerns with the user before touching code
- Follow plan steps exactly - do not improvise or add unrequested changes
- Do not skip verifications - they are the checkpoints that catch mistakes early
- Reference skills when the plan says to invoke them
- Stop when blocked - never guess your way through an unclear instruction
- Never start implementation on main/master branch without explicit user consent

## Integration

- Requires: ${PROJECT_NAME}-worktrees, ${PROJECT_NAME}-plan-writer output
- Uses: ${PROJECT_NAME}-tdd (each implementation step), ${PROJECT_NAME}-verification (each task completion)
- Invokes: ${PROJECT_NAME}-branch-finish (after all tasks)
`;
