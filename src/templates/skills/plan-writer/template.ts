import { PROJECT_NAME, SUPPORTED_PLATFORMS_YAML } from "#src/constants.js";

export const template = `---
name: {{name}}
description: |
  Implementation plan generator. Use after brainstorming produces an approved design spec.
  Breaks the spec into atomic 2-5 minute TDD tasks with exact file paths, complete code,
  and verification commands. Produces an executable plan document.
category: Developer Workflow
compatibility: ${SUPPORTED_PLATFORMS_YAML}
managed_by: ${PROJECT_NAME}
version: 5
---

# {{name}}

**Announce at start:** "I'm using ${PROJECT_NAME}-plan-writer to create the implementation plan."

## When to Activate

- After ${PROJECT_NAME}-brainstorming produces an approved design spec
- User asks to break a spec or requirements into atomic implementation tasks
- User provides a design document and wants an execution plan

## Iron Law

> **NO PLACEHOLDERS. Every task must contain executable code, exact file paths, and runnable verification commands. A task with "handle edge cases here" is not a task — it is a failure.**

## Input

Read the design spec document from docs/ (provided by ${PROJECT_NAME}-brainstorming). If no spec exists, ask the user to provide requirements or run ${PROJECT_NAME}-brainstorming first.

## Scope Check

If the spec covers multiple independent subsystems, it should have been decomposed during ${PROJECT_NAME}-brainstorming. If it was not, suggest breaking this into separate plans - one per subsystem. Each plan should produce working, testable software on its own.

## File Structure Mapping

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- Prefer smaller, focused files over large ones that do too much. Keep files under the project's line limit.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If a file you are modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Plan Structure

The plan is saved to \\\`docs/YYYYMMDD_HHMMSS_[PLAN]_<feature-name>-impl.md\\\`.

**Every plan MUST start with this header:**

\\\`\\\`\\\`markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** Use \\\`${PROJECT_NAME}-subagent-dev\\\` (recommended) or \\\`${PROJECT_NAME}-plan-executor\\\` to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
\\\`\\\`\\\`

Each task follows this exact structure:

\\\`\\\`\\\`
### Task N: <imperative title>

**Files**: \\\`path/to/file.ts\\\`, \\\`path/to/test.ts\\\`
**Est**: 2-5 minutes

**Steps**:
1. Write failing test in \\\`path/to/test.ts\\\`:
   \\\`\\\`\\\`typescript
   // Complete, runnable test code here
   \\\`\\\`\\\`
2. Verify test fails: \\\`pnpm test path/to/test.ts\\\` — expected: "X failing"
3. Implement in \\\`path/to/file.ts\\\`:
   \\\`\\\`\\\`typescript
   // Complete, runnable implementation code here
   \\\`\\\`\\\`
4. Verify test passes: \\\`pnpm test path/to/test.ts\\\` — expected: "X passing"
5. Commit: \\\`git add <files> && git commit -m "feat(scope): description"\\\`

**Verification**: \\\`pnpm test\\\` — expected: all tests passing
\\\`\\\`\\\`

## Task Granularity Rules

- Each task is one logical unit: write test, implement, verify, commit
- 2-5 minutes per task
- Writing a test IS a task. Verifying it fails IS a step. Implementing IS a task. These are never combined.
- If a task feels big, split it. A task should touch at most 2-3 files.
- Commit at the end of each task — never accumulate uncommitted changes

## What "Complete Code" Means

Every step must contain the actual content needed. These are **plan failures** - never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code - the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

Every code block must be copy-pasteable and runnable:
- No "// ... existing code ..." — show the actual lines
- No "add import for X" — show the exact import statement
- No "update the Y function to handle Z" — show the updated function
- No "similar to the above" — repeat the pattern explicitly
- Types must be consistent across tasks (if Task 1 defines a type, Task 2 uses the exact same name)

## Pre-Write Self-Review

After writing the complete plan, look at it with fresh eyes. This is a checklist you run yourself - not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for the red flags listed in the "What Complete Code Means" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called \\\`clearLayers()\\\` in Task 3 but \\\`clearFullLayers()\\\` in Task 7 is a bug.

**4. Task quality:** For each task, verify:
- Does it have a real test with actual assertions?
- Does it have the exact files to edit?
- Does it have runnable verification commands?
- Does it follow TDD order (test first, then implementation)?
- Is the commit message conventional (\\\`feat:\\\`, \\\`fix:\\\`, \\\`test:\\\`, \\\`refactor:\\\`)?

If you find issues, fix them inline. If you find a spec requirement with no task, add the task.

After self-review passes, dispatch a subagent with \\\`\${CLAUDE_SKILL_DIR}[[/references/plan-document-reviewer-prompt.md]]\\\` to do a final check before presenting the plan to the user.

## Execution Options

After writing the plan, present two options:
1. **${PROJECT_NAME}-subagent-dev** (recommended) — fresh subagent per task, two-stage review after each
2. **${PROJECT_NAME}-plan-executor** — execute tasks sequentially in this session with checkpoints

Ask the user which they prefer.

## Integration

- Consumes: output spec from ${PROJECT_NAME}-brainstorming
- References: ${PROJECT_NAME}-tdd cycle in every task structure
- Invokes: ${PROJECT_NAME}-subagent-dev or ${PROJECT_NAME}-plan-executor (user's choice)
- Both execution skills require ${PROJECT_NAME}-worktrees as a prerequisite (worktree or branch)
`;
